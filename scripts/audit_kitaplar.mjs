import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACTS_DIR =
  "/mnt/c/Users/sertturk16/.gemini/antigravity-ide/brain/6f7861f3-7b14-4030-a98e-f9aa6d5ac5df";
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function audit() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    v1_hub: { errors: [], meta: {} },
    v1_detail: { errors: [], meta: {} },
    v2_hub: { errors: [], meta: {} },
    v2_detail: { errors: [], meta: {}, authModalShown: false },
  };

  // 1. AUDIT V1 HUB (/kitaplar)
  console.log("=== AUDITING V1 HUB (/kitaplar) ===");
  const p1 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  p1.on("console", (msg) => {
    if (msg.type() === "error") report.v1_hub.errors.push(msg.text());
  });
  p1.on("pageerror", (err) => report.v1_hub.errors.push(err.message));

  await p1.goto("http://localhost:3000/kitaplar", { waitUntil: "domcontentloaded" });
  await p1.waitForTimeout(1000);
  await p1.screenshot({ path: path.join(ARTIFACTS_DIR, "v1_hub_desktop.png"), fullPage: true });

  report.v1_hub.meta = await p1.evaluate(() => ({
    title: document.title,
    h1: document.querySelector("h1")?.textContent?.trim(),
    cards: Array.from(document.querySelectorAll('a[class*="card"]')).map((a) => ({
      href: a.getAttribute("href"),
      text: a.textContent?.trim().replace(/\s+/g, " "),
    })),
  }));
  await p1.close();

  // 2. AUDIT V2 HUB (/v2/kitaplar)
  console.log("=== AUDITING V2 HUB (/v2/kitaplar) ===");
  const p3 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  p3.on("console", (msg) => {
    if (msg.type() === "error") report.v2_hub.errors.push(msg.text());
  });
  p3.on("pageerror", (err) => report.v2_hub.errors.push(err.message));

  await p3.goto("http://localhost:3000/v2/kitaplar", { waitUntil: "domcontentloaded" });
  await p3.waitForTimeout(1000);
  await p3.screenshot({ path: path.join(ARTIFACTS_DIR, "v2_hub_desktop.png"), fullPage: true });

  report.v2_hub.meta = await p3.evaluate(() => ({
    title: document.title,
    h1: document.querySelector("h1")?.textContent?.trim(),
    cards: Array.from(document.querySelectorAll('a[href*="/v2/kitaplar/"]')).map((a) => ({
      href: a.getAttribute("href"),
      text: a.textContent?.trim().replace(/\s+/g, " "),
      img: a.querySelector("img")?.getAttribute("src"),
    })),
    bodyScrollWidth: document.body.scrollWidth,
    hasOverflow: document.body.scrollWidth > window.innerWidth,
  }));

  // Mobile V2 Hub
  const p3_mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p3_mob.goto("http://localhost:3000/v2/kitaplar", { waitUntil: "domcontentloaded" });
  await p3_mob.waitForTimeout(800);
  await p3_mob.screenshot({ path: path.join(ARTIFACTS_DIR, "v2_hub_mobile.png"), fullPage: true });
  await p3_mob.close();
  await p3.close();

  // 3. AUDIT V2 DETAIL (/v2/kitaplar/ayt-cografya-konu-ozetli-brans-denemeleri)
  console.log("=== AUDITING V2 DETAIL (/v2/kitaplar/...) ===");
  const p4 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  p4.on("console", (msg) => {
    if (msg.type() === "error") report.v2_detail.errors.push(msg.text());
  });
  p4.on("pageerror", (err) => report.v2_detail.errors.push(err.message));

  await p4.goto("http://localhost:3000/v2/kitaplar/ayt-cografya-konu-ozetli-brans-denemeleri", {
    waitUntil: "domcontentloaded",
  });
  await p4.waitForTimeout(1200);
  await p4.screenshot({ path: path.join(ARTIFACTS_DIR, "v2_detail_desktop.png"), fullPage: true });

  report.v2_detail.meta = await p4.evaluate(() => ({
    title: document.title,
    h1: document.querySelector("h1")?.textContent?.trim(),
    jumpItemsCount: document.querySelectorAll('[class*="jumpItem"]').length,
    denemeArticlesCount: document.querySelectorAll("article[data-deneme]").length,
    questionLinksCount: document.querySelectorAll('a[href*="#deneme-"]').length,
    bodyScrollWidth: document.body.scrollWidth,
    hasOverflow: document.body.scrollWidth > window.innerWidth,
  }));

  // Test Auth Gating: click on Question 2 of Deneme 1 when signed out -> V2AuthDialog should open!
  console.log("--- Testing Auth Gating Modal on Video Click ---");
  try {
    const q2Link = p4.locator('a[href="#deneme-1-soru-2"]').first();
    if (await q2Link.isVisible()) {
      await q2Link.click();
      await p4.waitForTimeout(600);
      await p4.screenshot({ path: path.join(ARTIFACTS_DIR, "v2_detail_auth_modal_open.png") });

      const isDialogVisible =
        (await p4.locator('[role="dialog"], dialog[open], [data-state="open"]').count()) > 0;
      report.v2_detail.authModalShown = isDialogVisible;
      console.log(
        "Auth modal popup test result:",
        isDialogVisible ? "SUCCESS (Modal opened)" : "FAILED (Modal not detected)",
      );

      // Close modal
      await p4.keyboard.press("Escape");
      await p4.waitForTimeout(400);
    }
  } catch (e) {
    console.log("Auth modal test error:", e.message);
  }

  // Mobile V2 Detail
  const p4_mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p4_mob.goto("http://localhost:3000/v2/kitaplar/ayt-cografya-konu-ozetli-brans-denemeleri", {
    waitUntil: "domcontentloaded",
  });
  await p4_mob.waitForTimeout(800);
  await p4_mob.screenshot({
    path: path.join(ARTIFACTS_DIR, "v2_detail_mobile.png"),
    fullPage: true,
  });
  await p4_mob.close();
  await p4.close();

  // Save report
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, "books_verified_report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("Audit completed and saved to books_verified_report.json!");
  await browser.close();
}

audit().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
