import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/mnt/c/Users/sertturk16/.gemini/antigravity-ide/brain/0ad323c4-48bb-47e4-aff1-0f40cbe57595';

async function auditDunya() {
  const browser = await chromium.launch({ headless: true });
  const auditData = {
    v1: { desktop: {}, mobile: {} },
    v2: { desktop: {}, mobile: {}, interactions: {} },
  };

  // 1. AUDIT V1 /dunya (Desktop)
  console.log('--- AUDITING V1 /dunya (Desktop) ---');
  const v1Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await v1Page.goto('http://localhost:3000/dunya');
  await v1Page.waitForTimeout(1000);

  auditData.v1.desktop.title = await v1Page.title();
  auditData.v1.desktop.h1 = await v1Page.locator('h1').allInnerTexts();
  auditData.v1.desktop.headings = await v1Page.locator('h2, h3').allInnerTexts();
  auditData.v1.desktop.countryLinks = await v1Page.locator('a[href*="/dunya/"]').count();
  
  await v1Page.screenshot({ path: path.join(ARTIFACTS_DIR, 'dunya_v1_desktop.png'), fullPage: true });

  // 2. AUDIT V1 /dunya (Mobile)
  console.log('--- AUDITING V1 /dunya (Mobile) ---');
  const v1Mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await v1Mobile.goto('http://localhost:3000/dunya');
  await v1Mobile.waitForTimeout(1000);
  await v1Mobile.screenshot({ path: path.join(ARTIFACTS_DIR, 'dunya_v1_mobile.png'), fullPage: true });

  // 3. AUDIT V2 /v2/dunya (Desktop)
  console.log('--- AUDITING V2 /v2/dunya (Desktop) ---');
  const v2Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await v2Page.goto('http://localhost:3000/v2/dunya');
  await v2Page.waitForTimeout(1000);

  auditData.v2.desktop.title = await v2Page.title();
  auditData.v2.desktop.h1 = await v2Page.locator('h1').allInnerTexts();
  auditData.v2.desktop.headings = await v2Page.locator('h2, h3').allInnerTexts();
  auditData.v2.desktop.countryLinks = await v2Page.locator('a[href*="/v2/dunya/"]').count();

  await v2Page.screenshot({ path: path.join(ARTIFACTS_DIR, 'dunya_v2_desktop.png'), fullPage: true });

  // 4. TEST V2 /v2/dunya INTERACTIONS
  console.log('--- TESTING V2 /v2/dunya INTERACTIONS ---');
  
  // Test Continent Filter (Avrupa / Asya / Afrika)
  const avrupaBtn = v2Page.locator('button:has-text("Avrupa"), button:has-text("Europe")').first();
  if (await avrupaBtn.isVisible()) {
    await avrupaBtn.click();
    await v2Page.waitForTimeout(500);
    await v2Page.screenshot({ path: path.join(ARTIFACTS_DIR, 'dunya_v2_avrupa_filtered.png') });
  }

  // Test Search query (ör. "Almanya" veya "Japonya")
  const searchInput = v2Page.locator('input[placeholder*="ara"], input[type="text"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill('Japonya');
    await v2Page.waitForTimeout(500);
    await v2Page.screenshot({ path: path.join(ARTIFACTS_DIR, 'dunya_v2_search_japonya.png') });
    await searchInput.fill('');
    await v2Page.waitForTimeout(300);
  }

  // Test World Map Hover
  const trCountryPath = v2Page.locator('svg path[data-iso="TR"], svg path[data-iso="DE"], svg path[data-iso="US"], svg path[data-iso="FR"]').first();
  if (await trCountryPath.isVisible()) {
    const box = await trCountryPath.boundingBox();
    if (box) {
      await v2Page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await v2Page.waitForTimeout(400);
      await v2Page.screenshot({ path: path.join(ARTIFACTS_DIR, 'dunya_v2_map_hover.png') });
    }
  }

  // 5. AUDIT V2 /v2/dunya (Mobile)
  console.log('--- AUDITING V2 /v2/dunya (Mobile) ---');
  const v2Mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await v2Mobile.goto('http://localhost:3000/v2/dunya');
  await v2Mobile.waitForTimeout(1000);
  await v2Mobile.screenshot({ path: path.join(ARTIFACTS_DIR, 'dunya_v2_mobile.png'), fullPage: true });

  await browser.close();

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'dunya_audit_raw.json'),
    JSON.stringify(auditData, null, 2)
  );

  console.log('World audit completed successfully!');
}

auditDunya().catch(err => {
  console.error('World audit error:', err);
  process.exit(1);
});
