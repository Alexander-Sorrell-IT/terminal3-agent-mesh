/**
 * Mesh setup: register the seller contract, create its KV maps with
 * contract-scoped ACLs, and seed the policy + payment secret.
 * Idempotent-ish: tolerates "already exists" / version-bump errors.
 */
import "dotenv/config";
import { readFile } from "fs/promises";
import {
  T3nClient, TenantClient, loadWasmComponent, createEthAuthInput,
  eth_get_address, metamask_sign, setEnvironment, getNodeUrl,
} from "@terminal3/t3n-sdk";
import { step, logIssue } from "./devlog.js";

const WASM = "contracts/mesh-seller/target/wasm32-wasip2/release/mesh_seller.wasm";
const TAIL = "mesh_seller";
const VERSION = process.env.SELLER_VERSION || "0.3.0";

// demo policy
const MAX_PER_TX_CENTS = "100000";   // $1,000 per transaction
const MAX_TOTAL_CENTS = "30000";     // $300 cumulative budget (so the total cap fires in a short demo)
const PAYMENT_TOKEN = "sk_live_T3RM1NAL3_demo_9f2a7c";

async function main() {
  const key = process.env.T3N_API_KEY!;
  const pk = key.startsWith("0x") ? key : `0x${key}`;
  const address = eth_get_address(pk);
  setEnvironment("testnet");
  const wasmComponent = await loadWasmComponent();
  const t3n = new T3nClient({ wasmComponent, handlers: { EthSign: metamask_sign(address, undefined, pk) } });
  await t3n.handshake();
  const did = await t3n.authenticate(createEthAuthInput(address));
  const didStr = (did as any).value ?? String(did);
  const tenant = new TenantClient({ environment: "testnet", t3n, tenantDid: didStr, baseUrl: getNodeUrl() });
  console.log("tenant DID:", didStr);

  // 1) register the seller contract — auto-bump to the next free version
  const wasm = await readFile(WASM);
  let [maj, min, pat] = VERSION.split(".").map(Number);
  let reg: any, usedVersion = VERSION;
  for (let i = 0; i < 50; i++) {
    usedVersion = `${maj}.${min}.${pat}`;
    try { reg = await tenant.contracts.register({ tail: TAIL, version: usedVersion, wasm }); break; }
    catch (e: any) { if (String(e?.message).includes("not higher")) { pat++; continue; } throw e; }
  }
  if (!reg) throw new Error("register failed after version bumps");
  const contractId: number = reg?.contract_id;
  logIssue({ area: "register", severity: "success", summary: `registered ${TAIL} v${usedVersion} (contract_id ${contractId})` });
  console.log("registered:", JSON.stringify(reg), "version", usedVersion, "→ contract_id:", contractId);
  if (typeof contractId !== "number") throw new Error("no contract_id from register");

  // 2) ensure the four maps, ACL-scoped to the CURRENT contract id (a version
  //    bump changes the id, which would orphan old ACLs). Never delete maps
  //    (deletion lingers in a "Deleting" state) — clear ENTRIES via reset() below.
  const acl = { visibility: "private", writers: { only: [contractId] }, readers: { only: [contractId] } };
  async function ensureMap(tail: string) {
    try {
      await tenant.maps.create({ tail, ...acl });
      logIssue({ area: `maps.ensure(${tail})`, severity: "success", summary: "created" });
    } catch (e: any) {
      if (String(e?.message).includes("already exists")) {
        await tenant.maps.update(tail, { ...acl });
        logIssue({ area: `maps.ensure(${tail})`, severity: "success", summary: "acl updated" });
      } else throw e;
    }
  }
  for (const tail of ["policy", "secrets", "ledger", "trail"]) {
    await step(`ensure ${tail}`, async () => ensureMap(tail));
  }

  // 2b) clear stateful entries for a deterministic demo (owner-gated contract fn)
  await step("reset(ledger+trail)", async () =>
    tenant.contracts.execute(TAIL, { version: usedVersion, functionName: "reset", input: {} })
  );

  // 3) seed policy + secret via control-plane map-entry-set (bypasses ACL)
  const seed = async (mapTail: string, key: string, value: string) =>
    step(`seed ${mapTail}/${key}`, async () =>
      tenant.executeControl("map-entry-set", {
        map_name: tenant.canonicalName(mapTail),
        key,
        value,
      })
    );

  await seed("policy", "max_per_tx_cents", MAX_PER_TX_CENTS);
  await seed("policy", "max_total_cents", MAX_TOTAL_CENTS);
  await seed("policy", "approved_buyers", didStr); // the buyer agent (our funded DID)
  await seed("policy", "auditors", didStr);        // who may read the audit trail
  await seed("secrets", "payment_token", PAYMENT_TOKEN);

  logIssue({ area: "MESH-SETUP", severity: "success", summary: `seller live: ${reg.name} (contract_id ${contractId})` });
  console.log("\n✅ MESH SETUP COMPLETE");
  console.log("   contract:", reg.name);
  console.log("   policy: max_per_tx=$" + (+MAX_PER_TX_CENTS / 100) + " max_total=$" + (+MAX_TOTAL_CENTS / 100));
  console.log("   approved buyer:", didStr);
}

main().catch((e) => { console.error("\n💥 SETUP FAILED:", e?.message ?? e); process.exit(1); });
