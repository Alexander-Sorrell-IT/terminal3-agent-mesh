/** Build cast.html — an animated terminal "player" of the agent run, for recording.
 *  usage: tsx src/gen-cast.ts [transcript.json] [out.html] */
import { readFileSync, writeFileSync } from "fs";

const IN = process.argv[2] || "agent-transcript.json";
const OUT = process.argv[3] || "cast.html";
const t = JSON.parse(readFileSync(IN, "utf8"));
const money = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

type Line = { t: string; c?: string; gap?: number };
const lines: Line[] = [];
lines.push({ t: "$ npm run agent", c: "cmd", gap: 700 });
lines.push({ t: "━━━ TERMINAL 3 AGENT MESH — autonomous agent vs hardware governance ━━━", c: "cyan", gap: 500 });
lines.push({ t: `buyer agent · ${t.buyerDid}`, c: "dim" });
lines.push({ t: `governed by contract · ${t.contract}`, c: "dim" });
lines.push({ t: `policy enforced INSIDE the enclave (the agent is NOT told these): max ${money(t.policy.max_per_tx_cents)}/tx · ${money(t.policy.max_total_cents)} total`, c: "dim", gap: 900 });
lines.push({ t: "", gap: 200 });

let turn = 0;
for (const x of t.transcript) {
  const d = x.decision || {}; const r = x.result;
  turn++;
  lines.push({ t: `🤖 agent: ${d.reasoning || ""}`, c: "purple", gap: 600 });
  if (d.action === "stop") { lines.push({ t: "   → stop", c: "b", gap: 500 }); continue; }
  lines.push({ t: `   → purchase("${d.item}", ${money(d.amount_cents)})`, c: "dim", gap: 500 });
  if (r && r.outcome === "approved")
    lines.push({ t: `   ✔ APPROVED   paid ${r.paid_with}   · cumulative ${money(r.cumulative_cents)}`, c: "green", gap: 800 });
  else
    lines.push({ t: `   ✘ DENIED by the enclave — ${r ? r.reason : ""}${r && r.detail && r.detail.max_per_tx_cents ? "  (cap " + money(r.detail.max_per_tx_cents) + ")" : ""}`, c: "red", gap: 800 });
}
lines.push({ t: "", gap: 300 });
lines.push({ t: `🔒 payment secret in anything the agent saw: ${t.secretNeverLeaked ? "0 matches — it never left the enclave" : "LEAKED"}`, c: t.secretNeverLeaked ? "green" : "red", gap: 700 });
lines.push({ t: "✅ An autonomous AI agent tried to overspend, was hardware-blocked, and complied.", c: "cyanb", gap: 600 });

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  body{margin:0;background:#05070d;display:flex;align-items:center;justify-content:center;height:100vh;font-family:ui-monospace,Menlo,monospace}
  .term{width:1080px;background:#0b0f17;border:1px solid #1f2937;border-radius:12px;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden}
  .bar{display:flex;gap:8px;padding:12px 14px;background:#0e1626;border-bottom:1px solid #1f2937}
  .bar i{width:12px;height:12px;border-radius:50%}.r{background:#ff5f56}.y{background:#ffbd2e}.g{background:#27c93f}
  .bar span{color:#9aa4b2;font-size:12px;margin-left:10px}
  .body{padding:18px 20px;min-height:560px;font-size:15px;line-height:1.7}
  .ln{white-space:pre-wrap;opacity:0;transform:translateY(4px);transition:opacity .25s,transform .25s}
  .ln.show{opacity:1;transform:none}
  .cmd{color:#e5e7eb}.cyan{color:#38bdf8}.cyanb{color:#38bdf8;font-weight:700}.dim{color:#9aa4b2}
  .purple{color:#c4b5fd}.green{color:#34d399}.red{color:#f87171}.b{font-weight:700;color:#e5e7eb}
</style></head><body>
  <div class="term"><div class="bar"><i class="r"></i><i class="y"></i><i class="g"></i><span>terminal3-agent-mesh — npm run agent</span></div>
  <div class="body" id="b"></div></div>
  <div id="done" style="display:none"></div>
  <script>
    const L = ${JSON.stringify(lines)};
    const b = document.getElementById("b");
    let i = 0;
    function step(){
      if(i>=L.length){ setTimeout(()=>{document.getElementById("done").setAttribute("data-done","1");}, 1200); return; }
      const o=L[i]; const d=document.createElement("div");
      d.className="ln "+(o.c||"dim"); d.textContent=o.t||" ";
      b.appendChild(d); requestAnimationFrame(()=>d.classList.add("show"));
      i++; setTimeout(step, o.gap||450);
    }
    setTimeout(step, 400);
  </script></body></html>`;

writeFileSync(OUT, html);
const total = lines.reduce((s, l) => s + (l.gap || 450), 0) + 2000;
console.log(`wrote ${OUT} (~${Math.round(total / 1000)}s)`);
