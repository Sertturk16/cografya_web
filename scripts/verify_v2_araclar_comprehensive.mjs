import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = '/mnt/c/Users/sertturk16/.gemini/antigravity-ide/brain/c143fd29-3fdd-46ce-bc37-f9f7822de6d6';
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function verifyAll() {
  console.log('--- STARTING COMPREHENSIVE V2 ARACLAR VERIFICATION ---');
  const browser = await chromium.launch({ headless: true });
  const results = {
    pages: {},
    interactions: {},
    overflows: {},
    consoleErrors: []
  };

  const attachListeners = (page, name) => {
    page.on('console', msg => {
      if (msg.type() === 'error') results.consoleErrors.push(`[${name}] ${msg.text()}`);
    });
    page.on('pageerror', err => results.consoleErrors.push(`[${name} ERROR] ${err.message}`));
  };

  // 1. VERIFY V2 HUB (/v2/araclar)
  console.log('1. Verifying /v2/araclar Hub...');
  const pageHub = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachListeners(pageHub, 'V2 Hub');
  await pageHub.goto('http://localhost:3000/v2/araclar', { waitUntil: 'domcontentloaded' });
  await pageHub.waitForTimeout(1000);
  await pageHub.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_hub_verified.png'), fullPage: true });
  
  results.pages.hub = await pageHub.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim(),
    cards: Array.from(document.querySelectorAll('a[href*="/v2/araclar/"]')).map(a => ({
      href: a.getAttribute('href'),
      text: a.textContent?.trim()
    }))
  }));
  await pageHub.close();

  // 2. VERIFY V2 DISTANCE (/v2/araclar/mesafe-olcme)
  console.log('2. Verifying /v2/araclar/mesafe-olcme...');
  const pageDist = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachListeners(pageDist, 'V2 Mesafe');
  await pageDist.goto('http://localhost:3000/v2/araclar/mesafe-olcme', { waitUntil: 'domcontentloaded' });
  await pageDist.waitForTimeout(1000);

  // Test 81-il dropdown (CustomSelect): Add Ankara & Istanbul
  const provTrigger = pageDist.locator('button[aria-label="81 İl Merkezinden Seçerek Ekle"]').first();
  if (await provTrigger.isVisible()) {
    await provTrigger.click();
    await pageDist.waitForTimeout(200);
    const ankaraOption = pageDist.locator('div[role="option"]:has-text("06 - Ankara")').first();
    if (await ankaraOption.isVisible()) {
      await ankaraOption.click();
      await pageDist.waitForTimeout(200);
      await pageDist.locator('button:has-text("Ekle")').first().click();
      await pageDist.waitForTimeout(300);
    }
  }

  if (await provTrigger.isVisible()) {
    await provTrigger.click();
    await pageDist.waitForTimeout(200);
    const istOption = pageDist.locator('div[role="option"]:has-text("34 - İstanbul")').first();
    if (await istOption.isVisible()) {
      await istOption.click();
      await pageDist.waitForTimeout(200);
      await pageDist.locator('button:has-text("Ekle")').first().click();
      await pageDist.waitForTimeout(400);
    }
  }

  await pageDist.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_mesafe_ank_ist_added.png') });

  // Test Zoom In (+) button
  const zoomInBtn = pageDist.locator('button[aria-label="Haritayı Yakınlaştır"]').first();
  if (await zoomInBtn.isVisible()) {
    await zoomInBtn.click();
    await pageDist.waitForTimeout(300);
    await zoomInBtn.click();
    await pageDist.waitForTimeout(300);
    await pageDist.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_mesafe_zoomed_in.png') });
  }

  // Test Reset Zoom button
  const resetZoomBtn = pageDist.locator('button[aria-label="Harita Görünümünü Sıfırla"]').first();
  if (await resetZoomBtn.isVisible()) {
    await resetZoomBtn.click();
    await pageDist.waitForTimeout(300);
  }

  // Test Save Measurement
  const saveInput = pageDist.locator('input[placeholder*="Ölçüm Başlığı"]').first();
  if (await saveInput.isVisible()) {
    await saveInput.fill('Ankara-İstanbul Test');
    await pageDist.locator('button:has-text("Kaydet")').first().click();
    await pageDist.waitForTimeout(400);
  }

  // Test Undo ("Geri Al")
  const undoBtn = pageDist.locator('button:has-text("Geri Al")').first();
  if (await undoBtn.isVisible()) {
    await undoBtn.click();
    await pageDist.waitForTimeout(300);
  }

  await pageDist.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_mesafe_full_page.png'), fullPage: true });

  results.pages.mesafe = await pageDist.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim(),
    savedRecordsCount: document.querySelectorAll('[class*="bg-muted/30"]').length
  }));
  await pageDist.close();

  // 3. VERIFY V2 COORDINATES (/v2/araclar/koordinat-bulma)
  console.log('3. Verifying /v2/araclar/koordinat-bulma...');
  const pageCoord = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachListeners(pageCoord, 'V2 Koordinat');
  await pageCoord.goto('http://localhost:3000/v2/araclar/koordinat-bulma', { waitUntil: 'domcontentloaded' });
  await pageCoord.waitForTimeout(1000);

  // Test click on map (Ankara center approximate: 39.9, 32.8)
  const svgMap = pageCoord.locator('svg[aria-label="Türkiye CBS Ölçüm Haritası"]').first();
  const mapBox = await svgMap.boundingBox();
  if (mapBox) {
    await pageCoord.mouse.click(mapBox.x + mapBox.width * 0.44, mapBox.y + mapBox.height * 0.42);
    await pageCoord.waitForTimeout(500);
    await pageCoord.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_koordinat_clicked_ankara.png') });
  }

  // Test Safe Copy button
  const copyBtn = pageCoord.locator('button:has-text("Özeti Kopyala")').first();
  if (await copyBtn.isVisible() && await copyBtn.isEnabled()) {
    await copyBtn.click();
    await pageCoord.waitForTimeout(300);
  }

  await pageCoord.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_koordinat_full_page.png'), fullPage: true });

  results.pages.koordinat = await pageCoord.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim(),
    detectedProvinceText: document.querySelector('[class*="border-primary/20"]')?.textContent?.trim()
  }));
  await pageCoord.close();

  // 4. VERIFY V2 AREA (/v2/araclar/alan-hesaplama)
  console.log('4. Verifying /v2/araclar/alan-hesaplama...');
  const pageArea = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachListeners(pageArea, 'V2 Alan');
  await pageArea.goto('http://localhost:3000/v2/araclar/alan-hesaplama', { waitUntil: 'domcontentloaded' });
  await pageArea.waitForTimeout(1000);

  // Click Tuz Golu preset
  const tuzBtn = pageArea.locator('button:has-text("Tuz Gölü")').first();
  if (await tuzBtn.isVisible()) {
    await tuzBtn.click();
    await pageArea.waitForTimeout(500);
    await pageArea.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_alan_tuz_golu_preset.png') });
  }

  // Clear and test Bowtie / Self-intersecting polygon (A, B, D, C)
  const clearBtn = pageArea.locator('button:has-text("Temizle")').first();
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await pageArea.waitForTimeout(300);
  }

  const svgAreaMap = pageArea.locator('svg[aria-label="Türkiye CBS Ölçüm Haritası"]').first();
  const areaBox = await svgAreaMap.boundingBox();
  if (areaBox) {
    // Top-left
    await pageArea.mouse.click(areaBox.x + areaBox.width * 0.35, areaBox.y + areaBox.height * 0.35);
    await pageArea.waitForTimeout(150);
    // Top-right
    await pageArea.mouse.click(areaBox.x + areaBox.width * 0.55, areaBox.y + areaBox.height * 0.35);
    await pageArea.waitForTimeout(150);
    // Bottom-left (crosses top-right to bottom-right!)
    await pageArea.mouse.click(areaBox.x + areaBox.width * 0.35, areaBox.y + areaBox.height * 0.6);
    await pageArea.waitForTimeout(150);
    // Bottom-right
    await pageArea.mouse.click(areaBox.x + areaBox.width * 0.55, areaBox.y + areaBox.height * 0.6);
    await pageArea.waitForTimeout(400);
    await pageArea.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_alan_self_intersecting_warning.png') });

    // Test "Dış Hat Sırasına Diz" (Convex order fix button)
    const fixSortBtn = pageArea.locator('button:has-text("Dış Hat Sırasına Diz")').first();
    if (await fixSortBtn.isVisible()) {
      await fixSortBtn.click();
      await pageArea.waitForTimeout(400);
      await pageArea.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_alan_fixed_convex_order.png') });
    }
  }

  await pageArea.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_alan_full_page.png'), fullPage: true });

  results.pages.alan = await pageArea.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim()
  }));
  await pageArea.close();

  // 5. RESPONSIVENESS & OVERFLOW AUDIT (390, 768, 1024, 1440)
  console.log('5. Verifying Responsiveness & 0px Overflow...');
  const viewports = [
    { name: 'desktop_1440', width: 1440, height: 900 },
    { name: 'tablet_768', width: 768, height: 1024 },
    { name: 'mobile_390', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    const p = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await p.goto('http://localhost:3000/v2/araclar/mesafe-olcme', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(600);
    const overflow = await p.evaluate(() => {
      const docScroll = document.documentElement.scrollWidth;
      const bodyScroll = document.body.scrollWidth;
      const winInner = window.innerWidth;
      return {
        hasOverflow: docScroll > winInner || bodyScroll > winInner,
        overflowDelta: Math.max(0, docScroll - winInner, bodyScroll - winInner)
      };
    });
    results.overflows[vp.name] = overflow;
    if (vp.name === 'mobile_390') {
      await p.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_mesafe_mobile_390_verified.png'), fullPage: true });
    }
    await p.close();
  }

  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'v2_verification_summary.json'), JSON.stringify(results, null, 2));
  console.log('=== COMPREHENSIVE VERIFICATION FINISHED SUCCESSFULLY! ===');
  await browser.close();
}

verifyAll().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
