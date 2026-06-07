//! mesh-seller — Terminal 3 Agent Mesh seller contract.
//!
//! All governance runs INSIDE the enclave:
//!   * caller identity from `tenant_context::calling_user_did()` (unforgeable),
//!   * spend caps read from the `policy` KV map and enforced in Rust,
//!   * the payment secret read from `secrets` INSIDE the enclave — only a masked
//!     proof is ever returned, so the agent never sees the real token,
//!   * every decision appended to a contract-only `audit` KV map.
#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]

extern crate alloc;

use alloc::format;
use alloc::string::{String, ToString};
use alloc::vec::Vec;

wit_bindgen::generate!({
    world: "mesh-seller",
    path: "wit",
    additional_derives: [serde::Deserialize, serde::Serialize],
    generate_all,
});

#[cfg(target_arch = "wasm32")]
use crate::host::{
    interfaces::{kv_store, logging},
    tenant::tenant_context,
};

struct Component;

// ----------------------------------------------------------------------------
// Helpers (wasm-only — they call host imports)
// ----------------------------------------------------------------------------
#[cfg(target_arch = "wasm32")]
mod imp {
    use super::*;
    use serde_json::{json, Value};

    fn tid_hex() -> String {
        hex::encode(tenant_context::tenant_did())
    }

    fn buyer_did() -> String {
        match tenant_context::calling_user_did() {
            Some(b) => format!("did:t3n:{}", hex::encode(b)),
            None => "anonymous".to_string(),
        }
    }

    fn kv_get_string(map: &str, key: &[u8]) -> Result<Option<String>, String> {
        match kv_store::get(map, key).map_err(|e| format!("kv get {map}: {e}"))? {
            Some(bytes) => Ok(Some(String::from_utf8(bytes).map_err(|e| e.to_string())?)),
            None => Ok(None),
        }
    }

    fn u64_from(map: &str, key: &[u8], default: u64) -> Result<u64, String> {
        match kv_get_string(map, key)? {
            Some(s) => s.trim().parse::<u64>().map_err(|e| format!("parse {map}/{:?}: {e}", core::str::from_utf8(key))),
            None => Ok(default),
        }
    }

    /// Mask a secret so the caller sees PROOF the contract read it, never the value.
    fn mask(secret: &str) -> String {
        let n = secret.chars().count();
        if n <= 8 {
            return "****".to_string();
        }
        let first: String = secret.chars().take(4).collect();
        let last: String = secret.chars().skip(n - 4).collect();
        format!("{first}\u{2026}****\u{2026}{last}")
    }

    fn audit_write(map: &str, seq: u64, record: &Value) -> Result<(), String> {
        let key = format!("{:020}", seq);
        let val = serde_json::to_vec(record).map_err(|e| e.to_string())?;
        kv_store::put(map, key.as_bytes(), &val).map_err(|e| format!("audit put: {e}"))
    }

    pub fn purchase(input: &[u8]) -> Result<Vec<u8>, String> {
        let req: Value = serde_json::from_slice(input).map_err(|e| format!("bad request json: {e}"))?;
        let item = req.get("item").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
        let amount_cents = req.get("amount_cents").and_then(|v| v.as_u64()).ok_or("amount_cents (number) required")?;
        let currency = req.get("currency").and_then(|v| v.as_str()).unwrap_or("USD").to_string();

        let tid = tid_hex();
        let policy_map = format!("z:{tid}:policy");
        let secrets_map = format!("z:{tid}:secrets");
        let spend_map = format!("z:{tid}:ledger");
        let audit_map = format!("z:{tid}:trail");

        let buyer = buyer_did();
        let ts = tenant_context::cluster_timestamp_secs();
        let seq = tenant_context::seq_no();

        let max_per_tx = u64_from(&policy_map, b"max_per_tx_cents", 0)?;
        let max_total = u64_from(&policy_map, b"max_total_cents", 0)?;
        let approved = kv_get_string(&policy_map, b"approved_buyers")?.unwrap_or_default();
        let spent = u64_from(&spend_map, buyer.as_bytes(), 0)?;

        // ---- governance, enforced in-enclave ----
        let deny = |reason: &str, detail: Value| -> Result<Vec<u8>, String> {
            let rec = json!({
                "seq": seq, "ts": ts, "outcome": "denied", "reason": reason,
                "buyer": buyer, "item": item, "amount_cents": amount_cents,
                "currency": currency, "detail": detail
            });
            audit_write(&audit_map, seq, &rec)?;
            let _ = logging::info(&format!("AUDIT denied buyer={buyer} item={item} amount={amount_cents} reason={reason}"));
            serde_json::to_vec(&rec).map_err(|e| e.to_string())
        };

        let approved_ok = approved.trim() == "*"
            || approved.split(',').map(|s| s.trim()).any(|s| s == buyer);
        if !approved_ok {
            // do NOT echo the approved_buyers allowlist back to a rejected caller
            return deny("buyer_not_approved", json!({}));
        }
        // fail CLOSED: both caps must be configured, else deny
        if max_per_tx == 0 || max_total == 0 {
            return deny("policy_not_configured", json!({ "hint": "set max_per_tx_cents and max_total_cents" }));
        }
        if amount_cents > max_per_tx {
            return deny("over_per_tx_cap", json!({ "max_per_tx_cents": max_per_tx }));
        }
        let new_total = spent.saturating_add(amount_cents);
        if new_total > max_total {
            return deny("over_total_budget", json!({ "max_total_cents": max_total, "spent_cents": spent }));
        }

        // ---- approved: touch the secret ONLY inside the enclave ----
        let token = kv_get_string(&secrets_map, b"payment_token")?
            .ok_or("payment_token not configured in secrets map")?;
        let masked = mask(&token);

        kv_store::put(&spend_map, buyer.as_bytes(), new_total.to_string().as_bytes())
            .map_err(|e| format!("spend put: {e}"))?;

        let order_id = format!("ord-{ts}-{seq}");
        let rec = json!({
            "seq": seq, "ts": ts, "outcome": "approved", "order_id": order_id,
            "buyer": buyer, "item": item, "amount_cents": amount_cents, "currency": currency,
            "paid_with": masked, "cumulative_cents": new_total
        });
        audit_write(&audit_map, seq, &rec)?;
        let _ = logging::info(&format!("AUDIT approved buyer={buyer} order={order_id} amount={amount_cents}"));
        serde_json::to_vec(&rec).map_err(|e| e.to_string())
    }

    pub fn get_audit(_input: &[u8]) -> Result<Vec<u8>, String> {
        let tid_bytes = tenant_context::tenant_did();
        let tid = hex::encode(&tid_bytes);
        let policy_map = format!("z:{tid}:policy");

        // AUTHORIZE: only the tenant owner (caller == tenant) or a DID listed
        // in policy `auditors` may read the audit trail.
        let authorized = match tenant_context::calling_user_did() {
            Some(c) => {
                c == tid_bytes || {
                    let caller_did = format!("did:t3n:{}", hex::encode(&c));
                    kv_get_string(&policy_map, b"auditors")?
                        .unwrap_or_default()
                        .split(',')
                        .map(|s| s.trim())
                        .any(|s| s == caller_did)
                }
            }
            None => false,
        };
        if !authorized {
            return serde_json::to_vec(&json!({
                "error": "not_authorized",
                "hint": "audit is restricted to the tenant owner or designated auditors"
            }))
            .map_err(|e| e.to_string());
        }

        let audit_map = format!("z:{tid}:trail");
        let rows = kv_store::scan(&audit_map, &[0u8], &[0xffu8], 500)
            .map_err(|e| format!("audit scan: {e}"))?;
        let events: Vec<Value> = rows
            .into_iter()
            .filter_map(|(_k, v)| serde_json::from_slice::<Value>(&v).ok())
            .collect();
        serde_json::to_vec(&json!({ "events": events })).map_err(|e| e.to_string())
    }

    pub fn reset(_input: &[u8]) -> Result<Vec<u8>, String> {
        let tid_bytes = tenant_context::tenant_did();
        let tid = hex::encode(&tid_bytes);
        // owner-only
        let is_owner = matches!(tenant_context::calling_user_did(), Some(c) if c == tid_bytes);
        if !is_owner {
            return Err("reset: owner only".to_string());
        }
        let mut cleared = 0u32;
        for map_tail in ["ledger", "trail"] {
            let map = format!("z:{tid}:{map_tail}");
            let rows = kv_store::scan(&map, &[0u8], &[0xffu8], 1000)
                .map_err(|e| format!("scan {map}: {e}"))?;
            for (k, _v) in rows {
                kv_store::delete(&map, &k).map_err(|e| format!("delete {map}: {e}"))?;
                cleared += 1;
            }
        }
        serde_json::to_vec(&json!({ "reset": true, "cleared": cleared })).map_err(|e| e.to_string())
    }
}

#[cfg(target_arch = "wasm32")]
impl exports::z::mesh_seller::contracts::Guest for Component {
    fn purchase(
        req: exports::z::mesh_seller::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("purchase: missing input")?;
        imp::purchase(&input)
    }

    fn get_audit(
        req: exports::z::mesh_seller::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        let input = req.input.unwrap_or_default();
        imp::get_audit(&input)
    }

    fn reset(
        req: exports::z::mesh_seller::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        let input = req.input.unwrap_or_default();
        imp::reset(&input)
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);
