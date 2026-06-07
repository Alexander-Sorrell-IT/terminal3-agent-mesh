/** Renders a transcript JSON into a styled HTML report.
 *  usage: tsx src/gen-report.ts [input.json] [output.html] */
import { readFileSync, writeFileSync } from "fs";

const IN = process.argv[2] || "demo-transcript.json";
const OUT = process.argv[3] || "demo-report.html";
const t = JSON.parse(readFileSync(IN, "utf8"));
const money = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
const esc = (s: any) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Optional: render the LLM agent's turn-by-turn reasoning (present in agent runs)
const agentTurns = Array.isArray(t.transcript) ? t.transcript.map((x: any) => {
  const d = x.decision || {}; const r = x.result;
  const out = !r ? `<span class="reason">STOP</span>`
    : r.outcome === "approved" ? `<span class="pill approved">approved</span> <span class="reason">${money(r.amount_cents)}</span>`
    : `<span class="pill denied">denied</span> <span class="reason">${esc(r.reason || "")}</span>`;
  return `<div class="turn"><div class="think">🤖 ${esc(d.reasoning || "")}</div><div class="act">${d.action === "stop" ? "→ stop" : `→ purchase(${esc(d.item)}, ${money(d.amount_cents)})`} &nbsp; ${out}</div></div>`;
}).join("") : "";

const reasonLabel: Record<string, string> = {
  over_total_budget: "exceeds cumulative budget",
  over_per_tx_cap: "exceeds per-transaction cap",
  buyer_not_approved: "caller not on allowlist",
};

const rows = t.auditEvents.map((e: any) => `
  <tr class="${e.outcome}">
    <td>${e.seq}</td>
    <td><span class="pill ${e.outcome}">${e.outcome}</span></td>
    <td class="num">${money(e.amount_cents)}</td>
    <td>${esc(e.item)}</td>
    <td class="reason">${e.outcome === "approved" ? "paid " + esc(e.paid_with) : esc(reasonLabel[e.reason] || e.reason || "")}</td>
  </tr>`).join("");

const html = `<!doctype html><html><head><meta charset="utf8"><title>Terminal 3 Agent Mesh</title>
<style>
  :root{--bg:#0b0f17;--card:#121826;--line:#1f2937;--g:#34d399;--r:#f87171;--y:#fbbf24;--c:#38bdf8;--t:#e5e7eb;--d:#9aa4b2}
  *{box-sizing:border-box} body{margin:0;background:radial-gradient(1200px 600px at 70% -10%,#13203a,#0b0f17);color:var(--t);font:15px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;padding:42px}
  .wrap{max-width:880px;margin:0 auto}
  h1{font-size:27px;margin:0 0 4px;letter-spacing:.4px} h1 .c{color:var(--c)}
  .sub{color:var(--d);margin:0 0 22px;font-size:14px}
  .meta{display:flex;gap:10px 22px;flex-wrap:wrap;color:var(--d);font-size:12px;margin-bottom:22px}
  .meta b{color:var(--t)} .tag{background:#0e1626;border:1px solid var(--line);border-radius:6px;padding:2px 8px;color:var(--c)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:14px 0}
  .card h2{font-size:13px;text-transform:uppercase;letter-spacing:.6px;color:var(--d);margin:0 0 12px}
  .pills{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px}
  .gctrl{display:flex;align-items:center;gap:8px;font-size:13px;padding:7px 11px;border:1px solid var(--line);border-radius:8px;background:#0e1626}
  .dot{width:8px;height:8px;border-radius:50%} .dot.on{background:var(--g)} .dot.no{background:var(--r)}
  table{width:100%;border-collapse:collapse;font-size:13px} th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line)}
  th{color:var(--d);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  td.num{text-align:right} tr.denied td{color:#fca5a5} .reason{color:var(--d)}
  .pill{padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700}
  .pill.approved{background:rgba(52,211,153,.15);color:var(--g)} .pill.denied{background:rgba(248,113,113,.15);color:var(--r)}
  .turn{padding:9px 0;border-bottom:1px solid var(--line)} .turn:last-child{border:0}
  .think{color:var(--m,#c4b5fd);font-size:13px} .act{color:var(--d);font-size:12px;margin-top:3px}
  .seal{display:flex;align-items:center;gap:13px;border:1px solid var(--g);background:rgba(52,211,153,.08);border-radius:12px;padding:16px 20px;margin-top:16px}
  .seal .big{font-size:22px} .ok{color:var(--g)} .bad{color:var(--r)} .agent{color:var(--d);font-size:12px}
</style></head><body><div class="wrap">
  <h1>Terminal 3 <span class="c">Agent Mesh</span></h1>
  <p class="sub">An AI agent under hardware-enforced governance — it cannot overspend, cannot see the payment secret, and every action is audited.</p>
  <div class="meta">
    <span>buyer agent <b>${esc(t.buyerDid)}</b></span>
    <span>contract <b>${esc(t.contract)}</b></span>
    <span><span class="tag">${esc(t.network)}</span></span>
  </div>

  ${agentTurns ? `<div class="card"><h2>The autonomous agent's decisions (brain = Claude CLI)</h2>${agentTurns}
    <div class="agent" style="margin-top:8px">↑ the agent was told "secure as much GPU compute as you can" and was NOT told the caps — it discovered them by being denied, then complied</div></div>` : ""}

  <div class="card"><h2>Enclave-enforced policy</h2>
    <div class="pills">
      <div class="gctrl">per-transaction cap <b>&nbsp;${money(t.policy.max_per_tx_cents)}</b></div>
      <div class="gctrl">cumulative budget <b>&nbsp;${money(t.policy.max_total_cents)}</b></div>
      <div class="gctrl">caller identity <b>&nbsp;host-stamped, unforgeable</b></div>
    </div>
  </div>

  <div class="card"><h2>Every decision (read from the contract's audit trail)</h2>
    <table><thead><tr><th>seq</th><th>outcome</th><th>amount</th><th>item</th><th>detail</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="agent" style="margin-top:10px">↑ 3 approved within budget · 3 denied (cumulative cap, per-tx cap, unapproved caller) — all enforced inside the TEE</div>
  </div>

  <div class="seal"><span class="big">🔒</span><div>
    <b class="ok">Payment secret never left the enclave.</b>
    <div class="agent">Grep of all agent-visible output for the raw token: ${t.secretNeverLeaked ? "<span class='ok'>0 matches</span> — the agent only ever saw a masked proof" : "<span class='bad'>LEAKED</span>"}</div>
  </div></div>
</div></body></html>`;

writeFileSync(OUT, html);
console.log("wrote " + OUT);
