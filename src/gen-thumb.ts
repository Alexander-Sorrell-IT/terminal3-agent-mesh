/** Render a 1280x720 YouTube thumbnail to thumbnail.png */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { resolve } from "path";

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0} body{width:1280px;height:720px;overflow:hidden;
    background:radial-gradient(1100px 700px at 78% 12%,#15233f,#080b12);
    font-family:ui-monospace,Menlo,monospace;color:#e8edf5;position:relative}
  .pad{padding:64px 70px;display:flex;flex-direction:column;height:100%;box-sizing:border-box}
  .top{display:flex;align-items:center;gap:18px}
  .top .sub{color:#9aa4b2;font-size:24px;letter-spacing:5px;text-transform:uppercase}
  h1{font-size:96px;line-height:1.02;margin:26px 0 0;font-weight:800;letter-spacing:-1px}
  h1 .hl{color:#f87171}
  h1 .c{color:#38bdf8}
  .term{margin-top:auto;background:#0b0f17;border:1px solid #25324a;border-radius:16px;padding:24px 28px;
    box-shadow:0 24px 60px rgba(0,0,0,.5);font-size:30px;line-height:1.6;width:max-content;max-width:100%}
  .g{color:#34d399}.r{color:#f87171}.d{color:#9aa4b2}.b{font-weight:700}
  .foot{position:absolute;right:70px;bottom:60px;text-align:right}
  .foot .t{color:#38bdf8;font-weight:800;font-size:30px;letter-spacing:1px}
  .foot .s{color:#9aa4b2;font-size:20px;margin-top:4px}
</style></head><body><div class="pad">
  <div class="top">
    <svg width="64" height="72" viewBox="0 0 100 112"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#22d3a6"/></linearGradient></defs>
      <path d="M50 3 L93 20 V55 C93 83 74 100 50 109 C26 100 7 83 7 55 V20 Z" fill="rgba(56,189,248,0.10)" stroke="url(#g)" stroke-width="4"/>
      <rect x="33" y="52" width="34" height="27" rx="5" fill="url(#g)"/><path d="M39 52 V44 a11 11 0 0 1 22 0 V52" fill="none" stroke="url(#g)" stroke-width="5"/></svg>
    <div class="sub">Terminal 3 · AI Agent Governance</div>
  </div>
  <h1>The AI agent<br>that <span class="hl">can't overspend</span></h1>
  <div class="term">
    <div><span class="d">agent ▸</span> buy <span class="b">$50,000</span> &nbsp; <span class="r">✘ DENIED — over cap</span></div>
    <div><span class="d">agent ▸</span> buy <span class="b">$100</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span class="g">✔ APPROVED</span></div>
    <div><span class="g">🔒 payment secret never left the enclave</span></div>
  </div>
  <div class="foot"><div class="t">AGENT MESH</div><div class="s">hardware-governed · live on testnet</div></div>
</div></body></html>`;

async function main() {
  writeFileSync("thumb.html", html);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await p.goto("file://" + resolve("thumb.html"), { waitUntil: "load" });
  await p.waitForTimeout(300);
  await p.screenshot({ path: "thumbnail.png" });
  await b.close();
  console.log("wrote thumbnail.png (1280x720)");
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
