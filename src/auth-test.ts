import "dotenv/config";
import {
  T3nClient,
  loadWasmComponent,
  createEthAuthInput,
  eth_get_address,
  metamask_sign,
  setEnvironment,
} from "@terminal3/t3n-sdk";

async function main() {
  const key = process.env.T3N_API_KEY;
  if (!key) throw new Error("T3N_API_KEY missing from .env");

  // Hypothesis: the claim-page "developer/API key" is actually the eth signing key.
  const privateKey = key.startsWith("0x") ? key : `0x${key}`;

  let address: string;
  try {
    address = eth_get_address(privateKey);
  } catch (e) {
    console.error("❌ Key is NOT a valid eth private key:", (e as Error).message);
    throw e;
  }
  console.log("✅ Derived ETH address from key:", address);

  setEnvironment("testnet");
  const wasmComponent = await loadWasmComponent();
  console.log("✅ Loaded WASM component");

  const client = new T3nClient({
    wasmComponent,
    handlers: {
      EthSign: metamask_sign(address, undefined, privateKey),
    },
  });

  console.log("→ handshake…");
  await client.handshake();
  console.log("✅ handshake complete");

  console.log("→ authenticate…");
  const did = await client.authenticate(createEthAuthInput(address));
  console.log("✅ authenticated. DID =", JSON.stringify(did));
}

main().catch((e) => {
  console.error("\n💥 FAILED:", e);
  process.exit(1);
});
