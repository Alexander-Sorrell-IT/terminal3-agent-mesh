The write-contract.md page gave me the verbatim WIT world, Cargo.toml, lib.rs dispatch skeleton, and the exact Rust binding paths (`crate::bindings::t3n::host::kv_store`, `http_iface`, `http_with_placeholders`). This upgrades the Rust surface from INFERRED to doc-VERIFIED for structure. The exact `logging::audit` signature is still not in the doc (only prose), so I'll label that one INFERRED.

I now have all ground truth needed. The deliverable is my final text response (no .md file per instructions). Let me write the definitive build plan.

---

# TERMINAL 3 AGENT MESH — DEFINITIVE BUILD PLAN

Lead architect's build doc. Every symbol below is tagged **[VERIFIED-SDK]** (read from `index.d.ts`), **[VERIFIED-DOC]** (quoted from a docs.terminal3.io page), **[INFERRED]** (reasoned, not seen in source), or **[EMPIRICAL]** (proven by a recon probe run). Divergences flagged inline with **⚠BUG**.

---

## 1. CREDENTIALS VERDICT

**Plain answer: Your ONE claimed key is enough to BUILD AND DEMO the full mesh. A second tenant is *nice-to-have*, not required, and is obtainable for free from the web claim page — just not programmatically from a bare key.** Tiered:

| Path | Outcome | Evidence |
|---|---|---|
| **Two credit-bearing tenants from your ONE key, programmatically** (`becomeDevTenant`) | **NO.** | [EMPIRICAL] Recon ran it 3×. `submitUserInput({ becomeDevTenant: true })` throws HTTP 400 `email_not_verified`; the self-admit side-effect runs *after* the profile commit, which is gated on a verified email. Testnet email OTP delivery was down (6/6 `host/otp.verify: Email provider temporarily unavailable`), SMS is gated behind email. No SDK-level self-admit exists — [VERIFIED-SDK] the ONLY self-admit entry point is `T3nClient.submitUserInput`/`runOtpThenUserInput` with `becomeDevTenant?: boolean` (index.d.ts:594, 1868); `TenantClient` has no admit method. |
| **A genuine second tenant** | **YES — claim a second key from the web page.** Free, immediate, almost certainly works. | [VERIFIED-DOC] request-test-tokens.md: "sign in with your work email... your developer key appears immediately." That web flow is *how you got key #1* — signing in with a work email satisfies the very email gate the bare-key path fails. The recon only disproved the *programmatic* path, not the web path. **Acceptance check before relying on it: register a trivial contract under the second key (Build Plan step 1).** |
| **Fallback: one admitted tenant owns BOTH contracts; BUYER is a second authenticated-only DID from a free fresh ETH key** | **YES, proven.** | [EMPIRICAL] A fresh random ETH key self-authenticates to its own distinct DID with zero website interaction, 3×. `DID = eth address hex minus "0x"`. You keep two distinct DIDs, cross-DID + cross-contract invocation, the full delegation-credential system, and the audit trail. You lose only "two separately *provisioned* (credit-bearing) tenants." |

**Do you need anything else (more tokens / a wallet)?**
- **Wallet:** No external wallet needed. The claimed key *is* a secp256k1 ETH private key ([EMPIRICAL] ⚠BUG-05, already filed). `eth_get_address(key)` derives the address; that's the whole signer. For fresh agent identities, `ethers.Wallet.createRandom().privateKey` (import `ethers` from project `node_modules`, not `/tmp`).
- **More tokens:** Only the admitted tenant pays. Contract `register` and (in the fallback) cross-tenant `execute` charge the *caller*. [VERIFIED-SDK] watch balance via `client.getUsage()` → `UsagePage`; `ChargeReason` carries `kind:"contract_register"`. If you go two-web-claims, both parties are credit-bearing and the "who pays for cross-tenant invoke" question is moot. **Mitigation if low:** the claim page has a campaign-code field for extra tokens (⚠GAP-06: code not published to bounty entrants — ask organizers).

**Recommendation:** Spend 5 minutes claiming a **second work-email key** (e.g. an alias) for the cleanest "two real tenants" story. If that's blocked, ship the fallback — it satisfies every architectural requirement in the brief (separate DIDs, bounded delegation in TEE, host-injected PII, cross-tenant invocation, audit trail).

---

## 2. ARCHITECTURE

**Two TEE contracts + two off-chain "agent" processes + the T3N enclave host as the trust anchor.**

```
  SELLER human (DID_S, claimed key #1 = admitted tenant)
        │ owns + registers
        ▼
  ┌─────────────────────────────┐        ┌──────────────────────────────┐
  │ SELLER contract              │        │ BUYER contract (optional)     │
  │ z:<tid_S>:mesh/seller        │        │ z:<tid_B>:mesh/buyer          │
  │  • fn "purchase"             │        │  • fn "buy" (delegated entry) │
  │  • verifies buyer delegation │        │  • bounded-delegation checks  │
  │  • enforces spend cap (Rust) │        │  • cumulative-spend KV tracker│
  │  • logging::audit on outcome │        │  • calls SELLER cross-tenant  │
  │  • http-with-placeholders →  │        └──────────────────────────────┘
  │    payment/fulfillment host  │
  │    (PII injected in-enclave) │     KV maps (per tenant, TEE-encrypted):
  └─────────────────────────────┘       • "secrets"  → payment_api_key, etc.
        ▲                                 • "spend"    → cumulative cents per (agent,vc_id)
        │ executeAndDecode (z:namespace)
  ┌─────────────────────────────┐
  │ BUYER agent (TS process)    │  authenticates as DID_B (its own key)
  │  - never sees PII or secret  │  holds a user-signed DelegationCredential
  │  - holds delegation cred     │  (spend cap + approved seller in metadata)
  └─────────────────────────────┘
        ▲
        │ user-signed mandate (signCredential / DelegationCustodialClient)
  BUYER human (DID_U) — signs the bounded delegation; sets org grant via OrgDataClient
```

**Components**

1. **SELLER tenant + contract** (`z:<tid_S>:mesh/seller`, fn `purchase`): the counterparty. On invocation it (a) reads the delegated envelope, (b) [INFERRED Rust] enforces the spend cap and approved-counterparty rule, (c) emits `logging::audit`, (d) optionally calls an external payment/fulfillment endpoint via `http-with-placeholders` so buyer PII is injected by the host *inside* the enclave.
2. **BUYER tenant + contract** (`z:<tid_B>:mesh/buyer`, fn `buy`) — *optional in fallback*: the bounded-delegation gate. Verifies the user's `DelegationCredential`, tracks cumulative spend in a KV map, then invokes the seller. In the fallback (one tenant), fold this logic into the seller, or have the BUYER agent call the seller directly with the delegation envelope in the request body.
3. **BUYER agent (TS)** and **SELLER agent (TS)**: thin Node/tsx orchestrators. Each authenticates as its own DID and drives `executeAndDecode`. They are deliberately "dumb" — they never hold the payment secret or plaintext PII.
4. **Trust anchor = the T3N host/enclave**: stamps `subject`/`actor`/`vc_id` on audit events (uncforgeable), resolves `{{profile.*}}` placeholders, holds secrets in encrypted KV. This is *why* the demo's three wow-moments are credible.

**End-to-end transaction flow**

1. BUYER human signs a `DelegationCredential` (cap + approved seller in `metadata`) → hands the JCS bytes + signature to the BUYER agent. [VERIFIED-SDK]
2. (Org-side) admin writes a matching `UserGrant` via `OrgDataClient.setGrants`. [VERIFIED-SDK]
3. BUYER agent authenticates as DID_B, builds the per-call agent signature, and calls the buyer/seller contract with `{ envelope, request }`. [VERIFIED-SDK shape from Payroll types; INFERRED for a generic contract]
4. Inside the enclave: contract verifies the user signature (EIP-191 over JCS), checks function/scope/expiry/metadata, then **enforces the numeric spend cap in Rust** (string-equality grants can't do `<=`).
5. On approve → cross-tenant invoke seller `purchase`; seller may call the external payment host with `{{profile.*}}` placeholders resolved in-enclave. On over-cap → `outcome:"denied"`.
6. Both steps emit `logging::audit`; host stamps identity. BUYER human later reads the trail via `getAuditEvents`. [VERIFIED-SDK]

---

## 3. BUILD PLAN (ordered)

Confidence tags: **HIGH** = verified shape + (where noted) proven run. **RISKY** = unproven empirically or doc-only surface.

> **Step 0 — Bridge auth → TenantClient. [HIGH, but ⚠GAP-02 + ⚠BUG]**
> The recon's `new TenantClient({ environment, tenantDid })` **does not work** — [VERIFIED-SDK] `TenantClient` dispatches through `config.t3n` (a `TenantBaseClient`). You must pass the authenticated `T3nClient`:
> ```typescript
> import { T3nClient, TenantClient, loadWasmComponent, createEthAuthInput,
>          eth_get_address, metamask_sign, setEnvironment, getNodeUrl } from "@terminal3/t3n-sdk";
> setEnvironment("testnet");                       // BEFORE getNodeUrl/handshake (default is production)
> const wasmComponent = await loadWasmComponent();
> const key = process.env.SELLER_KEY!;             // the claimed key (an ETH privkey)
> const address = eth_get_address(key);
> const t3n = new T3nClient({ wasmComponent, handlers: { EthSign: metamask_sign(address, undefined, key) } });
> await t3n.handshake();
> const did = await t3n.authenticate(createEthAuthInput(address));   // did:t3n:<address-hex-no-0x>
> const tenant = new TenantClient({ environment: "testnet", t3n });  // ⚠ t3n is REQUIRED; tenantDid alone is inert
> ```
> ⚠BUG-DOC: docs never show how to get `tenant` from `t3n` (GAP-02). ⚠BUG-TYPE: `TenantClientConfig.t3n` is typed optional but is functionally required for any dispatch.

**1. SMOKE TEST: register one trivial contract under the claimed key, then invoke it. [RISKY-untested → gates everything]**
Your own BUGS_AND_GAPS line 88 lists register→invoke as not-yet-run; recon "high confidence" is about *shape*, not an empirical run. Prove it before building two contracts.
```typescript
import { readFile } from "fs/promises";
const wasmBytes = await readFile("target/wasm32-wasip2/release/seller.wasm");
const reg = await tenant.contracts.register({   // [VERIFIED-SDK] (publish() is an identical alias)
  tail: "mesh/seller", version: "0.1.0", wasm: wasmBytes,
});                                               // ⚠ returns Promise<unknown>; contract_id field is doc-only
const tid = did.toString().slice("did:t3n:".length);
const scriptName = `z:${tid}:mesh/seller`;
const ver = await getScriptVersion(getNodeUrl(), scriptName);   // [VERIFIED-SDK] never pass literal "latest"
const out = await t3n.executeAndDecode({ script_name: scriptName, script_version: ver,
  function_name: "ping", input: {} });
```
**Fallback if register fails:** check `getUsage()` for balance/charge errors; bump `version` (must be strictly higher than any prior); confirm wasm is a valid component (`wasm-tools validate`). If still failing, file as a bug and demo with a pre-registered contract.

**2. Author the Rust contracts. [HIGH structure (VERIFIED-DOC skeleton), INFERRED host-call details]**
WIT world, Cargo.toml, and dispatch are **[VERIFIED-DOC]** verbatim from write-contract.md:
```wit
// wit/world.wit
package mesh:seller-contract@0.1.0;
world contract {
  import t3n:host/kv-store@0.1.0;
  import t3n:host/logging@0.1.0;
  import t3n:host/tenant-context@0.1.0;
  import t3n:host/http-iface@0.1.0;
  import t3n:host/http-with-placeholders@0.1.0;
  export t3n:contract/dispatch@0.1.0;
}
```
```rust
// lib.rs — [VERIFIED-DOC] dispatch skeleton
wit_bindgen::generate!({ world: "contract", path: "wit" });
use exports::t3n::contract::dispatch::{Guest, ContractInput, ContractOutput, ContractError};
struct Component;
impl Guest for Component {
  fn dispatch(input: ContractInput) -> Result<ContractOutput, ContractError> {
    match input.function.as_str() {
      "purchase" => purchase(input),
      other => Err(ContractError::UnknownFunction { name: other.to_string() }),
    }
  }
}
export!(Component);
```
Host calls — paths **[VERIFIED-DOC]**, signatures partly **[INFERRED]**:
```rust
use crate::bindings::t3n::host::kv_store;                  // [VERIFIED-DOC] path
let api_key = kv_store::get("secrets", "payment_api_key")? // [VERIFIED-DOC] note Option return:
    .ok_or(ContractError::CredentialsNotConfigured)?;
use crate::bindings::t3n::host::http_with_placeholders as hwp;  // [INFERRED name] for PII
// body uses "{{profile.first_name}}", "{{profile.verified_contacts.email.value}}" — [VERIFIED-DOC]
use crate::bindings::t3n::host::logging;                   // [VERIFIED-DOC path]
logging::audit("purchase.approve", &order_id, "success", Some(&details_json));  // [INFERRED signature]
```
**Spend-cap enforcement is hand-rolled Rust** (see step 5). Build: `cargo build --target wasm32-wasip2 --release` → `target/wasm32-wasip2/release/seller.wasm`. **[VERIFIED-DOC + EMPIRICAL toolchain].**
⚠BUG: `logging::audit` exact arity/param names are nowhere in docs/SDK — derived from `AuditEvent` fields. Verify against generated `bindings.rs` after first `wit-bindgen` run; treat as INFERRED until then. **Fallback:** if `logging::audit` isn't in the generated bindings, the audit wow-moment degrades to whatever audit the host emits automatically on dispatch — still queryable via `getAuditEvents`.

**3. Create KV maps + seed secrets. [HIGH for maps (VERIFIED-SDK), HIGH for seed (VERIFIED-DOC)]**
```typescript
await tenant.maps.create({                         // [VERIFIED-SDK] MapCreateInput
  tail: "secrets", visibility: "private",
  writers: { only: [contractNumericId] },          // ⚠ numeric contract id (origin unproven — see Risks)
  readers: { only: [contractNumericId] },           // ⚠ omitting readers = deny-all at runtime
});
await tenant.executeControl("map-entry-set", {     // [VERIFIED-DOC] seed-api-key.md, verbatim
  map_name: tenant.canonicalName("secrets"),       // ⚠ must use canonicalName(); raw "secrets" fails
  key: "payment_api_key", value: process.env.PAYMENT_SECRET!,
});
```
Repeat a `spend` map (writers/readers = contract id) for the cumulative-spend tracker.
**Fallback if numeric contract id is unknown:** see Risk #1 — read it back from `getUsage()`/`me()`, or grant by DID via `extraReadGrants`/`extraWriteGrants` (string[]) instead of numeric `only`.

**4. Authorize outbound hosts (only if the seller calls an external API). [RISKY — doc-only surface]**
[VERIFIED-DOC] invoke-contract.md, verbatim — NOT in the SDK, call via raw `execute()`:
```typescript
const v = await getScriptVersion(getNodeUrl(), "tee:user/contracts");
await userClient.execute({                          // signed by the USER/data-owner, not the agent
  script_name: "tee:user/contracts", script_version: v, function_name: "agent-auth-update",
  input: { agents: [{ agentDid,                     // ⚠ envelope snake_case, input camelCase (doc footgun)
    scripts: [{ scriptName: SELLER_SCRIPT, versionReq: scriptVersion,
      functions: ["purchase"], allowedHosts: ["webhook.site"] }] }] },  // exact host
});
```
Error if unset: `host/http.egress_denied: host '<host>' is not in the authorised_hosts allowlist` [VERIFIED-DOC common-errors]. ⚠GAP-04: no get-started page teaches this.
**Fallback:** skip outbound HTTP entirely — have the contract *return* a redacted/hashed echo of the resolved PII (proves in-enclave resolution without needing egress auth). This makes the PII wow-moment self-contained.

**5. Bounded delegation: build/sign credential, write grant, enforce cap in Rust. [HIGH SDK shapes; INFERRED contract wiring]**
```typescript
import { buildDelegationCredential, signCredential, canonicaliseCredential,
         OrgDataClient } from "@terminal3/t3n-sdk";
const cred = buildDelegationCredential({           // [VERIFIED-SDK]
  user_did, agent_pubkey,                           // 33-byte compressed secp256k1
  org_did, contract: "mesh:seller", functions: ["purchase"],
  scopes: ["buyer/counterparty-list"],
  metadata: { max_spend_cents: "100000", approved_seller: sellerDid },  // strings only
  not_before_secs: BigInt(Math.floor(Date.now()/1000)),
  not_after_secs:  BigInt(Math.floor(Date.now()/1000) + 86400),
  vc_id: randomBytes16,
});
const { sig } = signCredential(canonicaliseCredential(cred), userPrivKeyBytes);  // EIP-191
// OIDC users instead: new DelegationCustodialClient(t3n, baseUrl).signCustodial(wireBody)
const org = new OrgDataClient(baseUrl, adminEthSecretBytes, adminDid);  // [VERIFIED-SDK]
await org.setGrants({ orgDid: org_did, contractId: "mesh:seller", grants: [{
  user_did: agentDid, functions: ["purchase"], scopes: ["buyer/counterparty-list"],
  constraints: { max_spend_cents: "100000", approved_seller: sellerDid },  // EXACT-string match only
  expires_at_secs: Math.floor(Date.now()/1000) + 86400,
}] });
```
⚠**Critical:** [VERIFIED-SDK] `UserGrant.constraints` is `Record<string,string>` with **exact-string-equality** matching only — **no `<=`**. The numeric spend cap MUST be enforced inside the Rust contract: parse `metadata["max_spend_cents"]`, compare to request amount, and track cumulative spend in the `spend` KV map keyed by `(agent_did, vc_id)`. The grant is a coarse allowlist; the contract is the real enforcer.
**Fallback for generic (non-payroll) invocation:** the SDK's invocation builders (`buildPayrollInvocation`/`buildInvocationPreimage`) are payroll-typed. For a generic body, reuse `buildInvocationPreimage(vcId, nonce, reqHash)` + `signAgentInvocation` + your own JCS canonicalisation of the request, and pass `{ envelope, request }`. If wiring the full delegation envelope into a generic contract proves too heavy for the demo window, fall back to **self-call/direct mode** (caller's own DID + an `OrgContractGrants` entry) — you keep audit + cap enforcement, you lose the cryptographic user-mandate layer.

**6. Cross-tenant invoke from BUYER agent. [HIGH — VERIFIED-SDK, corrects recon]**
⚠ The recon's `tenantClient.executeBusinessContract({ tenant, contract, functionName, input })` is **WRONG**. [VERIFIED-SDK] the real signature is `executeBusinessContract(session, options)` — two args. Use the lower-level call:
```typescript
const sellerTid = sellerDid.slice("did:t3n:".length);
const SELLER_SCRIPT = `z:${sellerTid}:mesh/seller`;
const ver = await getScriptVersion(getNodeUrl(), SELLER_SCRIPT);
const resp = await buyerClient.executeAndDecode({          // snake_case envelope is mandatory
  script_name: SELLER_SCRIPT, script_version: ver,
  function_name: "purchase",
  input: { envelope, request },                            // delegation envelope + request body
});
```
[VERIFIED-SDK] camelCase keys (`scriptName`, etc.) → `Invalid action request: missing field` 400. Cross-tenant works because agents authenticate as themselves.

**7. Read the audit trail. [HIGH — VERIFIED-SDK, corrects recon]**
[VERIFIED-SDK] response is **nested** `AuditPage { batches: AuditBatch[], next_cursor? }` — NOT the flat `{ events }` the cross-tenant recon finding implied:
```typescript
const page = await userClient.getAuditEvents({ pii_did: agentDid, limit: 50 });
for (const b of page.batches) {
  if (!b.committed) continue;                  // ⚠ committed:false = contract claim, not durable fact
  for (const e of b.events) console.log(e.ts_ms, e.actor, e.subject, e.vc_id, e.action, e.outcome);
}
```
`pii_did` reads require a live `agent-auth` grant from that user.

---

## 4. THE DEMO

**One-screen setup:** split terminal — left = BUYER agent stdout, right = a live capture host (e.g. `webhook.site` URL) showing what actually left the enclave. Pre-register both contracts (step 1 proven) so the live run is fast.

**Sequence:**
1. `npm run mesh:setup` — auth both DIDs, create maps, seed `payment_api_key`, write grant, `agent-auth-update`. Show two distinct `did:t3n:...` printed.
2. `npm run mesh:buy -- --amount 99.99` — under-cap purchase. Succeeds.
3. `npm run mesh:buy -- --amount 9999.99` — over-cap. Refused.
4. `npm run mesh:audit` — print the trail.

**Wow-moment 1 — PII never leaks.**
- *Proof:* The contract source (show it on screen) contains only `{{profile.first_name}}` / `{{profile.verified_contacts.email.value}}` — no PII. The BUYER agent stdout shows only the placeholder string / order id. The webhook.site pane shows the **real resolved name + email** that the host injected *inside the enclave*. Contrast = proof.
- *Command/output:* `mesh:buy` agent log → `request body: { ... given_name: "{{profile.first_name}}" }`; webhook.site → `given_name: "Alice"`. **[RISKY — depends on `agent-auth-update` (doc-only) + egress.] Fallback:** contract returns `sha256(resolved_email)`; agent prints the hash, never the email — proves in-enclave resolution with zero egress.

**Wow-moment 2 — Hardware policy-refusal (bounded delegation in TEE).**
- *Proof:* Same `purchase` function, two amounts. $99.99 → `{ outcome: "success" }`; $9,999.99 → contract returns `outcome:"denied"` because Rust parsed `metadata["max_spend_cents"]="100000"` and the request exceeded it. The agent cannot bypass it — the cap lives in the enclave, not the agent.
- *Command/output:* step 2 prints `APPROVED order #...`; step 3 prints `DENIED: over spend cap`. Then `mesh:audit` shows the **denied** event with the agent's `vc_id`. **[HIGH for contract-side cap; RISKY only for the full crypto envelope — fallback in BUILD step 5.]**

**Wow-moment 3 — Tamper-proof audit trail.**
- *Proof:* `getAuditEvents` returns host-stamped events. Show that `actor` = buyer agent DID, `subject` = user DID, `vc_id` = the delegation credential id — none of which the contract can forge ([VERIFIED-SDK] host stamps them). Show one `success` and one `denied`, both with `committed:true`.
- *Command/output:* `mesh:audit` →
  `{ actor:"did:t3n:<buyer>", subject:"did:t3n:<user>", vc_id:"<b64u>", action:"purchase.approve", outcome:"success", committed:true }`
  `{ ... action:"purchase.deny", outcome:"denied", committed:true }`
  **[HIGH — VERIFIED-SDK shapes.]** Caveat to mention: `logging::audit` arity is INFERRED; if the explicit emit isn't wired, the host's automatic dispatch audit still shows actor/subject/vc_id.

---

## 5. RISKS & UNKNOWNS (ranked)

1. **Numeric contract id origin is undocumented.** [VERIFIED-SDK] `contracts.register` returns `Promise<unknown>`; maps' `writers/readers.only` need a **number[]**. We don't know how a registered contract's numeric id is obtained. **This blocks map ACLs (step 3).** *Mitigation:* (a) inspect the actual register response at runtime (log `JSON.stringify(reg)` — doc claims `contract_id`); (b) read it from `tenant.tenant.me()` / `getUsage()` `ChargeReason`; (c) bypass numeric ids entirely — grant the contract by **DID string** via `MapUpdateInput.extraReadGrants`/`extraWriteGrants` (string[]).

2. **`agent-auth-update` is doc-only, never run.** [VERIFIED-DOC] shape exists but is absent from the SDK and unproven empirically; the entire egress/PII wow-moment depends on it. *Mitigation:* test it in isolation early; **fallback = no-egress PII proof** (contract returns redacted/hashed echo), removing the dependency.

3. **Generic (non-payroll) delegation envelope is INFERRED.** All SDK invocation builders are payroll-typed (`buildPayrollInvocation`, `PayrollRunRequest`). Wiring a generic `{envelope,request}` into a Rust contract + verifying user/agent sigs in-enclave is the heaviest unproven piece. *Mitigation:* reuse `buildInvocationPreimage`+`signAgentInvocation`+`canonicaliseCredential` (all VERIFIED-SDK primitives); **fallback = direct/self-call mode** (own DID + `OrgContractGrants`) — keeps cap + audit, drops the crypto mandate.

4. **`logging::audit` Rust signature is INFERRED.** Param order/names derived from `AuditEvent`, not seen in any WIT. *Mitigation:* read the generated `bindings.rs` after the first `wit-bindgen` build; **fallback** = rely on host's automatic dispatch audit.

5. **register→invoke never empirically proven with the claimed key.** *Mitigation:* the step-1 smoke test gates the whole build; if it fails, file as bug and demo with a pre-registered contract.

6. **Second tenant via web claim is "almost certainly" but unconfirmed.** *Mitigation:* claim it and run step-1 smoke under it before relying on it; **fallback = one-tenant + fresh authenticated-only buyer DID** (proven 3×).

7. **Testnet email OTP delivery was down during recon.** Blocks `becomeDevTenant` and any OTP-bound user-profile setup; could block `{{profile.*}}` if profile fields require a verified user. *Mitigation:* don't depend on programmatic admit; use claimed/web keys whose profiles already exist; if `{{profile.*}}` fails (`placeholder not permitted`), fall back to a `secrets`-stored value instead of a profile field for the PII demo.

---

## 6. NEW DOC/SDK BUGS FOUND DURING RECON ($200 track, consolidated)

Net-new findings from this recon pass (not already in BUGS_AND_GAPS.md):

- **BUG-A — `executeBusinessContract` signature is mis-shaped in every doc/example.** [VERIFIED-SDK index.d.ts:3174] real signature is `executeBusinessContract<T>(session: TenantExecutionSession, options: ExecuteBusinessContractOptions<T>)` — **two args**. All recon/doc examples pass a single `{ tenant, contract, functionName, input }` object, which is a type error and won't compile. *Fix:* document the `(session, options)` arity and what `session` must be (an authenticated client exposing `executeAndDecode`).

- **BUG-B — `TenantClient` is undispatchable without `t3n`, yet `TenantClientConfig.t3n` is typed optional.** [VERIFIED-SDK:3005] Every recon example `new TenantClient({ environment, tenantDid })` produces an inert client. *Fix:* either make `t3n` required at the type level, or document that `tenantDid`-only construction cannot dispatch. (Compounds existing GAP-02: no bridge shown from `T3nClient` to `TenantClient`.)

- **BUG-C — `register()` / `publish()` return `Promise<unknown>`; no response interface; numeric `contract_id` is doc-only.** [VERIFIED-SDK:3112-3113] Callers can't typed-extract the id that map ACLs then require as `number`. *Fix:* export `interface ContractRegisterResult { contract_id: number; ... }` and type the methods; document the id→map-ACL linkage end to end.

- **BUG-D — `WriterSet`/`ReaderSet` leak Rust serde casing into the type.** [VERIFIED-SDK:3029-3038] both `{ only: number[] }` and `{ Only: number[] }` (and `"all"`/`"All"`) are valid; docs show only lowercase. *Fix:* normalize the union or document the casing leak.

- **BUG-E — `MapCreateInput.readers` is typed optional but runtime-required (deny-all if omitted).** [VERIFIED-SDK:3043] type/runtime divergence. *Fix:* make `readers` required, or document the deny-all default at the type level.

- **BUG-F — `agent-auth-update` mixes snake_case envelope with camelCase input in one example, and is entirely absent from the SDK.** [VERIFIED-DOC invoke-contract.md] envelope (`script_name`/`function_name`) is snake_case but input (`agentDid`/`scriptName`/`versionReq`/`allowedHosts`) is camelCase — a footgun — and there's no typed SDK helper, forcing raw `execute()` with hand-built JSON. *Fix:* add a typed `agentAuthUpdate()` helper; pick one casing convention. (Extends existing GAP-04.)

- **BUG-G — typed-error contract not honored on HTTP-400.** [EMPIRICAL] `submitUserInput` is documented `@throws {UserUpsertError}` with `kind:"EmailNotVerified"`, and `UserUpsertError.fromWire("email_not_verified: …")` parses correctly — but at runtime the 400 path threw a **generic `Error`** (`instanceof UserUpsertError === false`, `instanceof RpcError === false`), with the JSON-RPC body merely stringified into `.message`. Callers lose `.kind`/`.detail`/`.requestId`. *Fix:* route HTTP-400 contract errors through `UserUpsertError.fromWire`/`RpcError` so the documented typed-error contract holds.

- **BUG-H — testnet email OTP delivery non-functional; the only documented bare-key path to clear the email gate is untraversable.** [EMPIRICAL] `otpRequest({emailChannel})` failed 6/6 with `host/otp.verify: Email provider temporarily unavailable`; SMS is gated behind email (`Email must be verified before starting phone OTP verification`). The README happy path (`otpRequest → otpVerify → submitUserInput`) cannot complete on testnet, and it's the sole documented way to `becomeDevTenant` from a bare key. *Fix:* restore testnet email, or document an alternate gate-satisfier (and whether testnet is `skip_otp` — `OtpRequestResult.expiresAtSec` was never observable).

- **BUG-I (doc) — `host-api.md` and the outbound-http-auth tip omit the actual API surface.** [VERIFIED-DOC] host-api.md gives prose only (no WIT world, no `kv-store`/`logging::audit` signatures); outbound-http-auth-by-user.md defers the `agent-auth-update` shape to other pages. The exact `logging::audit` signature exists nowhere in docs or SDK. *Fix:* publish the WIT worlds + host-call signatures (esp. `logging::audit`) on host-api.md.

---

**Ground-truth file paths (absolute):**
- SDK types: `/Users/broodierchip-m1air/Documents/Hackthon/dorahacks/Terminal 3 Agent Dev Kit Bounty Challenge (beta)/node_modules/@terminal3/t3n-sdk/dist/index.d.ts`
- SDK README: `/Users/broodierchip-m1air/Documents/Hackthon/dorahacks/Terminal 3 Agent Dev Kit Bounty Challenge (beta)/node_modules/@terminal3/t3n-sdk/README.md`
- Existing bug log to extend: `/Users/broodierchip-m1air/Documents/Hackthon/dorahacks/Terminal 3 Agent Dev Kit Bounty Challenge (beta)/BUGS_AND_GAPS.md`
- Existing auth probe to reuse: `/Users/broodierchip-m1air/Documents/Hackthon/dorahacks/Terminal 3 Agent Dev Kit Bounty Challenge (beta)/src/auth-test.ts`

**Key doc pages (verbatim sources):** invoke-contract.md (agent-auth-update + cross-tenant invoke), write-contract.md (WIT world + Cargo.toml + dispatch skeleton), seed-api-key.md (`map-entry-set`), request-test-tokens.md (claim flow), outbound-http-auth-by-user.md + common-errors (`host/http.egress_denied`).