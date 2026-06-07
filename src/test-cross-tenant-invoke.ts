/**
 * Decisive architecture test: can a FRESH (0-credit, non-tenant) buyer DID
 * invoke another tenant's already-registered contract cross-tenant?
 * Invokes z:<sellerTid>:smoke::ping where sellerTid = our admitted tenant.
 */
import "dotenv/config";
import { Wallet } from "ethers";
import {
  T3nClient, loadWasmComponent, createEthAuthInput, eth_get_address,
  metamask_sign, setEnvironment, getNodeUrl, getScriptVersion,
} from "@terminal3/t3n-sdk";
import { step, logIssue } from "./devlog.js";

const SELLER_DID = process.env.T3N_TENANT_DID!; // our admitted tenant that owns `smoke`
const TAIL = "smoke";

async function main() {
  const sellerTid = SELLER_DID.slice("did:t3n:".length);
  const scriptName = `z:${sellerTid}:${TAIL}`;

  // fresh buyer identity (0 credits, not a tenant)
  const privateKey = Wallet.createRandom().privateKey;
  const address = eth_get_address(privateKey);
  setEnvironment("testnet");
  const wasmComponent = await loadWasmComponent();
  const buyer = new T3nClient({ wasmComponent, handlers: { EthSign: metamask_sign(address, undefined, privateKey) } });
  await step("buyer.handshake", async () => buyer.handshake());
  const did = await step("buyer.authenticate", async () => buyer.authenticate(createEthAuthInput(address)));
  console.log("fresh buyer DID:", (did as any).value ?? did, "(0 credits, not a tenant)");
  console.log("target script:", scriptName);

  const ver = await step("getScriptVersion", async () => getScriptVersion(getNodeUrl(), scriptName));
  console.log("script_version:", ver);

  try {
    const out = await step("buyer.executeAndDecode(cross-tenant ping)", async () =>
      buyer.executeAndDecode({
        script_name: scriptName,
        script_version: ver,
        function_name: "ping",
        input: { from: "fresh-buyer", note: "cross-tenant invoke test" },
      })
    );
    console.log("\n🎉 CROSS-TENANT INVOKE WORKED:", JSON.stringify(out));
    logIssue({ area: "CROSS-TENANT", severity: "success", summary: "fresh 0-credit DID invoked another tenant's contract — two-DID mesh viable" });
  } catch (e) {
    logIssue({ area: "buyer.executeAndDecode", severity: "bug", summary: "fresh DID cross-tenant invoke failed", error: e });
    console.log("\n❌ fresh DID could not invoke. Caller likely needs credits → use one-tenant mesh.");
  }
}
main().catch((e) => { console.error("💥", e?.message ?? e); process.exit(1); });
