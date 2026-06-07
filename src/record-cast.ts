/** Record cast.html to a webm video via Playwright. usage: tsx src/record-cast.ts [cast.html] [out.webm] */
import { chromium } from "playwright";
import { renameSync, rmSync, mkdirSync } from "fs";
import { resolve } from "path";

async function main() {
  const castPath = resolve(process.argv[2] || "cast.html");
  const out = process.argv[3] || "agent-demo.webm";
  const W = 1180, H = 760;
  mkdirSync(".rec", { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: ".rec", size: { width: W, height: H } } });
  const page = await ctx.newPage();
  await page.goto("file://" + castPath, { waitUntil: "load" });
  // wait until the player signals it finished (max 90s)
  await page.waitForFunction(() => document.getElementById("done")?.getAttribute("data-done") === "1", null, { timeout: 90000 });
  await page.waitForTimeout(600);
  const video = page.video();
  await ctx.close(); // finalizes the video file
  await browser.close();
  if (video) { renameSync(await video.path(), out); }
  rmSync(".rec", { recursive: true, force: true });
  console.log("wrote " + out);
}
main().catch((e) => { console.error("record failed:", e?.message ?? e); process.exit(1); });
