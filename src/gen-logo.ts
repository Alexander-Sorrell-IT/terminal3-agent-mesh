/** Render a 480x480 BUIDL logo to logo.png */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { resolve } from "path";

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0} body{width:480px;height:480px;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(420px 320px at 50% 28%,#16233f,#0a0e16);font-family:ui-monospace,Menlo,monospace}
  .wrap{display:flex;flex-direction:column;align-items:center;gap:18px}
  .badge{filter:drop-shadow(0 14px 34px rgba(56,189,248,.35))}
  .title{color:#e8edf5;font-size:46px;font-weight:800;letter-spacing:1px;line-height:1}
  .title b{color:#38bdf8}
  .sub{color:#9aa4b2;font-size:15px;letter-spacing:3px;text-transform:uppercase}
</style></head><body>
  <div class="wrap">
    <svg class="badge" width="180" height="200" viewBox="0 0 100 112">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#22d3a6"/></linearGradient></defs>
      <path d="M50 3 L93 20 V55 C93 83 74 100 50 109 C26 100 7 83 7 55 V20 Z"
        fill="rgba(56,189,248,0.10)" stroke="url(#g)" stroke-width="3.5"/>
      <!-- lock body -->
      <rect x="33" y="52" width="34" height="27" rx="5" fill="url(#g)"/>
      <path d="M39 52 V44 a11 11 0 0 1 22 0 V52" fill="none" stroke="url(#g)" stroke-width="5"/>
      <circle cx="50" cy="64" r="4.5" fill="#0a0e16"/><rect x="48" y="64" width="4" height="9" rx="2" fill="#0a0e16"/>
    </svg>
    <div class="title"><b>AGENT</b> MESH</div>
    <div class="sub">Terminal 3 · TEE-governed</div>
  </div>
</body></html>`;

async function main() {
  writeFileSync("logo.html", html);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 480, height: 480 }, deviceScaleFactor: 2 });
  await p.goto("file://" + resolve("logo.html"), { waitUntil: "load" });
  await p.waitForTimeout(300);
  await p.screenshot({ path: "logo.png" });
  await b.close();
  console.log("wrote logo.png (480x480 @2x)");
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
