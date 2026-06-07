/**
 * SMOKE TEST — the gate. Proves register -> invoke works with our claimed key.
 * Every step is wrapped in devlog.step() so any error is auto-captured with
 * full SDK error fields into encountered-issues.jsonl.
 */
import "dotenv/config";
import { readFile } from "fs/promises";
import {
  T3nClient,
  TenantClient,
  loadWasmComponent,
  createEthAuthInput,
  eth_get_address,
  metamask_sign,
  setEnvironment,
  getNodeUrl,
} from "@terminal3/t3n-sdk";
import { step, logIssue } from "./devlog.js";

const WASM_PATH = "contracts/smoke/target/wasm32-wasip2/release/smoke.wasm";
const TAIL = "smoke";
const VERSION = "0.1.0";

async function main() {
  const key = process.env.T3N_API_KEY;
  if (!key) throw new Error("T3N_API_KEY missing");
  const privateKey = key.startsWith("0x") ? key : `0x${key}`;
  const address = eth_get_address(privateKey);

  setEnvironment("testnet");
  const wasmComponent = await loadWasmComponent();

  // --- auth ---
  const t3n = new T3nClient({
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, privateKey) },
  });
  await step("auth.handshake", async () => t3n.handshake());
  const did = await step("auth.authenticate", async () =>
    t3n.authenticate(createEthAuthInput(address))
  );
  const didStr = (did as any).value ?? String(did);
  console.log("DID:", didStr);

  // --- tenant client: control ops need t3n + tenantDid + baseUrl (node URL) ---
  const baseUrl = getNodeUrl();
  console.log("node baseUrl:", baseUrl);
  const tenant = new TenantClient({ environment: "testnet", t3n, tenantDid: didStr, baseUrl });

  // --- am I already an admitted tenant? ---
  let meOk = false;
  try {
    const me = await step("tenant.me", async () => tenant.tenant.me());
    console.log("tenant.me():", JSON.stringify(me));
    meOk = true;
  } catch (e) {
    logIssue({ area: "tenant.me", severity: "warning", summary: "me() failed — may not be admitted yet", error: e });
  }

  // --- if not admitted, try the control-plane claim() path (NOT the OTP-gated becomeDevTenant) ---
  if (!meOk) {
    try {
      const claimed = await step("tenant.claim", async () => tenant.tenant.claim());
      console.log("tenant.claim():", JSON.stringify(claimed));
    } catch (e) {
      logIssue({ area: "tenant.claim", severity: "bug", summary: "claim() failed — cannot self-admit", error: e });
    }
  }

  // --- register the smoke contract ---
  const wasm = await readFile(WASM_PATH);
  console.log(`wasm: ${wasm.length} bytes`);
  const reg = await step("contracts.register", async () =>
    tenant.contracts.register({ tail: TAIL, version: VERSION, wasm })
  );
  console.log("register result:", JSON.stringify(reg));

  // --- invoke ping (own-tenant path) ---
  const out = await step("contracts.execute(ping)", async () =>
    tenant.contracts.execute(TAIL, {
      version: VERSION,
      functionName: "ping",
      input: { hello: "world", from: didStr },
    })
  );
  console.log("\n🎉 INVOKE RESULT:", JSON.stringify(out));
  logIssue({ area: "SMOKE", severity: "success", summary: "register -> invoke round-trip COMPLETE" });
}

main().catch((e) => {
  console.error("\n💥 SMOKE FAILED:", e?.message ?? e);
  process.exit(1);
});
