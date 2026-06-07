/**
 * Can we mint a SECOND real tenant for free via the control-plane claim() path
 * (NOT the OTP-gated becomeDevTenant the recon found broken)?
 * Generates a fresh throwaway ETH key, authenticates, and tries tenant.claim().
 * A signed API call — sends NO email.
 */
import "dotenv/config";
import { Wallet } from "ethers";
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

async function main() {
  const privateKey = Wallet.createRandom().privateKey; // fresh, throwaway
  const address = eth_get_address(privateKey);
  console.log("fresh seller address:", address);

  setEnvironment("testnet");
  const wasmComponent = await loadWasmComponent();
  const t3n = new T3nClient({
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, privateKey) },
  });
  await step("seller.handshake", async () => t3n.handshake());
  const did = await step("seller.authenticate", async () => t3n.authenticate(createEthAuthInput(address)));
  const didStr = (did as any).value ?? String(did);
  console.log("fresh seller DID:", didStr);

  const tenant = new TenantClient({ environment: "testnet", t3n, tenantDid: didStr, baseUrl: getNodeUrl() });

  // try the control-plane claim
  try {
    const claimed = await step("seller.claim", async () => tenant.tenant.claim());
    console.log("✅ claim() result:", JSON.stringify(claimed));
    const me = await step("seller.me", async () => tenant.tenant.me());
    console.log("✅ seller.me():", JSON.stringify(me));
    logIssue({ area: "SECOND-TENANT", severity: "success", summary: "claim() minted a fresh tenant — TWO real tenants possible" });
    console.log("\n>>> SELLER_KEY=" + privateKey);
    console.log(">>> SELLER_DID=" + didStr);
  } catch (e) {
    logIssue({ area: "seller.claim", severity: "bug", summary: "claim() failed for fresh key", error: e });
    console.log("\n❌ claim() did not admit a fresh key. Fall back to one-tenant mesh or web-claim a 2nd key.");
  }
}

main().catch((e) => { console.error("💥", e?.message ?? e); process.exit(1); });
