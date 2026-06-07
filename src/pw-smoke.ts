import { chromium } from "playwright";

async function main() {
  const url = process.argv[2] ?? "https://www.terminal3.io/claim-page";
  const out = process.argv[3] ?? "pw-proof.png";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);
  const title = await page.title();
  await page.screenshot({ path: out, fullPage: false });
  console.log(`✅ Playwright drove a real browser.`);
  console.log(`   URL:        ${url}`);
  console.log(`   Page title: ${title}`);
  console.log(`   Screenshot: ${out}`);
  await browser.close();
}
main().catch((e) => { console.error("💥 Playwright failed:", e); process.exit(1); });
