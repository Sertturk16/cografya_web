import { chromium } from "playwright";
import { copyFileSync } from "fs";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:3000/v2/araclar/mesafe-olcme", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // 1. Focus on coordinate input
  const input = page.locator("input[placeholder*='39.92']");
  await input.focus();
  await page.screenshot({ path: "/tmp/focus_input_v2.png" });

  // 2. Click on custom select to open and focus
  const select = page.locator("button[aria-haspopup='listbox']").first();
  await select.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/tmp/focus_select_v2.png" });

  await browser.close();

  copyFileSync("/tmp/focus_input_v2.png", "/mnt/c/Users/sertturk16/.gemini/antigravity-ide/brain/c143fd29-3fdd-46ce-bc37-f9f7822de6d6/focus_input_v2.png");
  copyFileSync("/tmp/focus_select_v2.png", "/mnt/c/Users/sertturk16/.gemini/antigravity-ide/brain/c143fd29-3fdd-46ce-bc37-f9f7822de6d6/focus_select_v2.png");

  console.log("Screenshots saved to brain directory!");
}

run().catch(console.error);
