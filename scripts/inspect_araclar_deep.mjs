import { chromium } from "playwright";
import path from "path";

const ARTIFACTS_DIR =
  "/mnt/c/Users/sertturk16/.gemini/antigravity-ide/brain/c143fd29-3fdd-46ce-bc37-f9f7822de6d6";

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1. Inspect V1 Mesafe Detail
  const p1 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p1.goto("http://localhost:3000/araclar/mesafe-olcme", { waitUntil: "domcontentloaded" });
  await p1.waitForTimeout(1000);
  await p1.screenshot({ path: path.join(ARTIFACTS_DIR, "v1_mesafe_full.png"), fullPage: true });

  // 2. Inspect V1 Koordinat Detail
  const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p2.goto("http://localhost:3000/araclar/koordinat-bulma", { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(1000);
  await p2.screenshot({ path: path.join(ARTIFACTS_DIR, "v1_koordinat_full.png"), fullPage: true });

  // 3. Inspect V1 Alan Detail
  const p3 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p3.goto("http://localhost:3000/araclar/alan-hesaplama", { waitUntil: "domcontentloaded" });
  await p3.waitForTimeout(1000);
  await p3.screenshot({ path: path.join(ARTIFACTS_DIR, "v1_alan_full.png"), fullPage: true });

  // 4. Test V2 Details
  const p4 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p4.goto("http://localhost:3000/v2/araclar", { waitUntil: "domcontentloaded" });
  await p4.waitForTimeout(1000);
  await p4.screenshot({ path: path.join(ARTIFACTS_DIR, "v2_araclar_full.png"), fullPage: true });

  // Check SVG polygon strokeDasharray attribute vs CSS class
  const polyDashCheck = await p4.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Tuz Gölü"),
    );
    if (btn) btn.click();
    const poly = document.querySelector("svg polygon");
    return {
      className: poly?.getAttribute("class"),
      computedStrokeDasharray: poly ? window.getComputedStyle(poly).strokeDasharray : null,
    };
  });
  console.log("Polygon Dash Check:", JSON.stringify(polyDashCheck));

  // Check dark mode
  await p4.emulateMedia({ colorScheme: "dark" });
  await p4.waitForTimeout(500);
  await p4.screenshot({
    path: path.join(ARTIFACTS_DIR, "v2_araclar_dark_full.png"),
    fullPage: true,
  });

  // Check mobile 390px
  const pMobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pMobile.goto("http://localhost:3000/v2/araclar", { waitUntil: "domcontentloaded" });
  await pMobile.waitForTimeout(1000);
  // Click Istanbul Ankara preset on mobile
  const mPreset = pMobile.locator('button:has-text("İstanbul - Ankara")').first();
  if (await mPreset.isVisible()) {
    await mPreset.click();
    await pMobile.waitForTimeout(500);
  }
  await pMobile.screenshot({
    path: path.join(ARTIFACTS_DIR, "v2_araclar_mobile_preset.png"),
    fullPage: true,
  });

  console.log("All detailed screenshots and checks completed!");
  await browser.close();
}

run().catch((err) => {
  console.error("Inspection failed:", err);
  process.exit(1);
});
