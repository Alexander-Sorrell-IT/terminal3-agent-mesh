/**
 * Terminal 3 Agent Mesh — narrated demo.
 * Exercises ALL governance paths in the enclave: approvals, per-tx cap,
 * cumulative cap, identity rejection, secret-blindness, and the audit trail.
 * Writes demo-transcript.json for the visual report.
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import {
  T3nClient, TenantClient, loadWasmComponent, createEthAuthInput,
  eth_get_address, metamask_sign, setEnvironment, getNodeUrl, getScriptVersion,
} from "@terminal3/t3n-sdk";

const TAIL = "mesh_seller";
const SECRET = "sk_live_T3RM1NAL3_demo_9f2a7c";
const DUMMY_DID = "did:t3n:00000000000000000000000000000000deadbeef";

const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", x: "\x1b[0m" };
const money = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

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
  const scriptName = `z:${didStr.slice("did:t3n:".length)}:${TAIL}`;
  const VERSION = await getScriptVersion(getNodeUrl(), scriptName); // current registered version
  const buy = (item: string, amount_cents: number) =>
    tenant.contracts.execute(TAIL, { version: VERSION, functionName: "purchase", input: { item, amount_cents, currency: "USD" } }) as Promise<any>;
  const setPolicy = (key: string, value: string) =>
    tenant.executeControl("map-entry-set", { map_name: tenant.canonicalName("policy"), key, value });

  const moments: any[] = [];
  const record = (label: string, prompt: string, result: any) => { moments.push({ label, prompt, result }); };

  console.log(`\n${C.b}${C.c}━━━ TERMINAL 3 AGENT MESH ━━━${C.x}`);
  console.log(`${C.dim}buyer agent: ${didStr}`);
  console.log(`policy (enforced inside the enclave): max/tx ${money(100000)} · cumulative ${money(30000)}${C.x}\n`);

  const approve = async (item: string, cents: number) => {
    const r = await buy(item, cents);
    const ok = r.outcome === "approved";
    console.log(`${ok ? C.g + "✔ APPROVED" : C.r + "✘ " + r.outcome.toUpperCase()}${C.x}  ${money(cents).padStart(11)}  ${item}` +
      (ok ? `  ${C.dim}paid ${r.paid_with} · cumulative ${money(r.cumulative_cents)}${C.x}` : `  ${C.r}(${r.reason})${C.x}`));
    return r;
  };

  console.log(`${C.b}① Buyer agent buys within budget${C.x}`);
  record("approved", "buy GPU-cluster hour ($99)", await approve("GPU-cluster hour", 9900));
  record("approved", "buy GPU-cluster hour ($99)", await approve("GPU-cluster hour", 9900));
  record("approved", "buy GPU-cluster hour ($99)", await approve("GPU-cluster hour", 9900));

  console.log(`\n${C.b}② Cumulative budget cap (would exceed ${money(30000)})${C.x}`);
  record("denied", "buy GPU-cluster hour ($99) — over cumulative budget", await approve("GPU-cluster hour", 9900));

  console.log(`\n${C.b}③ Per-transaction cap — agent goes rogue${C.x}`);
  record("denied", "buy an entire datacenter ($9,999)", await approve("entire datacenter", 999900));

  console.log(`\n${C.b}④ Identity check — an unapproved agent tries to buy${C.x}`);
  await setPolicy("approved_buyers", DUMMY_DID); // temporarily remove our agent from the allowlist
  try {
    record("denied", "purchase while not on the approved list", await approve("coffee", 500));
  } finally {
    await setPolicy("approved_buyers", didStr); // restore
    console.log(`${C.dim}   (allowlist restored)${C.x}`);
  }

  console.log(`\n${C.b}⑤ Auditor: the full decision trail${C.x}`);
  const audit = await tenant.contracts.execute(TAIL, { version: VERSION, functionName: "get-audit", input: {} }) as any;
  for (const e of audit.events) {
    const mark = e.outcome === "approved" ? `${C.g}✔` : `${C.r}✘`;
    console.log(`   ${mark} seq ${e.seq}  ${e.outcome.padEnd(8)} ${money(e.amount_cents).padStart(11)}  ${e.item}${e.reason ? "  (" + e.reason + ")" : ""}${C.x}`);
  }

  const agentVisible = JSON.stringify({ moments, audit });
  const leaked = agentVisible.includes(SECRET);
  console.log(`\n${C.b}🔒 Secret check${C.x}: payment token in any agent-visible output? ${leaked ? C.r + "❌ LEAKED" : C.g + "✅ NO — it never left the enclave"}${C.x}\n`);

  writeFileSync("demo-transcript.json", JSON.stringify({
    title: "Terminal 3 Agent Mesh",
    buyerDid: didStr,
    contract: `z:${didStr.slice("did:t3n:".length)}:${TAIL}`,
    policy: { max_per_tx_cents: 100000, max_total_cents: 30000 },
    moments,
    auditEvents: audit.events,
    secretNeverLeaked: !leaked,
    network: "Terminal 3 testnet",
  }, null, 2));
  console.log(`${C.dim}wrote demo-transcript.json${C.x}`);
}

main().catch((e) => { console.error("\n💥 DEMO FAILED:", e?.message ?? e); process.exit(1); });
