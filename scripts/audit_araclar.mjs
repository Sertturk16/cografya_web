import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = '/mnt/c/Users/sertturk16/.gemini/antigravity-ide/brain/c143fd29-3fdd-46ce-bc37-f9f7822de6d6';
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function auditAraclar() {
  console.log('Starting deep audit with Playwright...');
  const browser = await chromium.launch({ headless: true });
  const results = {
    v1Hub: {},
    v1Distance: {},
    v1Coordinate: {},
    v1Area: {},
    v2Araclar: {},
    v2Interactions: {},
    overflows: {},
    consoleErrors: []
  };

  // Helper to collect errors
  const attachListeners = (page, prefix) => {
    page.on('console', msg => {
      if (msg.type() === 'error') results.consoleErrors.push(`[${prefix}] ${msg.text()}`);
    });
    page.on('pageerror', err => results.consoleErrors.push(`[${prefix} PAGEERROR] ${err.message}`));
  };

  // 1. AUDIT V1 HUB (/araclar)
  console.log('--- AUDITING V1 HUB (/araclar) ---');
  const pageV1Hub = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachListeners(pageV1Hub, 'V1 Hub');
  await pageV1Hub.goto('http://localhost:3000/araclar', { waitUntil: 'domcontentloaded' });
  await pageV1Hub.waitForTimeout(1000);
  await pageV1Hub.screenshot({ path: path.join(ARTIFACTS_DIR, 'v1_araclar_hub_desktop.png'), fullPage: true });

  results.v1Hub = await pageV1Hub.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('li.card, ul > li')).map(li => ({
      title: li.querySelector('h2, a')?.textContent?.trim(),
      href: li.querySelector('a')?.getAttribute('href'),
      text: li.textContent?.trim()
    }));
    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim(),
      intro: document.querySelector('.lede')?.textContent?.trim(),
      cardsCount: cards.length,
      cards,
      hasMapOnHub: !!document.querySelector('svg')
    };
  });
  await pageV1Hub.close();

  // 2. AUDIT V1 DISTANCE (/araclar/mesafe-olcme)
  console.log('--- AUDITING V1 DISTANCE (/araclar/mesafe-olcme) ---');
  const pageV1Dist = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachListeners(pageV1Dist, 'V1 Distance');
  await pageV1Dist.goto('http://localhost:3000/araclar/mesafe-olcme', { waitUntil: 'domcontentloaded' });
  await pageV1Dist.waitForTimeout(1000);
  await pageV1Dist.screenshot({ path: path.join(ARTIFACTS_DIR, 'v1_mesafe_desktop_initial.png'), fullPage: true });

  // Test map click and controls in V1 Distance
  const v1Map = pageV1Dist.locator('svg').first();
  if (await v1Map.isVisible()) {
    const box = await v1Map.boundingBox();
    if (box) {
      await pageV1Dist.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4);
      await pageV1Dist.waitForTimeout(400);
      await pageV1Dist.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.5);
      await pageV1Dist.waitForTimeout(600);
      await pageV1Dist.screenshot({ path: path.join(ARTIFACTS_DIR, 'v1_mesafe_points_added.png') });
    }
  }

  // Test Province Picker dropdown in V1
  const provSelect = pageV1Dist.locator('select').first();
  if (await provSelect.isVisible()) {
    const options = await provSelect.evaluate(s => Array.from(s.options).map(o => o.text));
    results.v1Distance.provinceOptionsSample = options.slice(0, 5);
  }

  results.v1Distance.details = await pageV1Dist.evaluate(() => {
    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim(),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean),
      hasZoomControls: !!document.querySelector('[aria-label*="yakınlaştır"], [class*="zoom"], [class*="Zoom"]'),
      hasScaleBar: !!document.querySelector('[class*="scaleBar"], [class*="scale"]'),
      measurementOutput: document.body.innerText.match(/\d+[\.,]?\d*\s*(?:km|metre|km²)/g),
      allHeadings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim())
    };
  });
  await pageV1Dist.close();

  // 3. AUDIT V1 COORDINATE (/araclar/koordinat-bulma)
  console.log('--- AUDITING V1 COORDINATE (/araclar/koordinat-bulma) ---');
  const pageV1Coord = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachListeners(pageV1Coord, 'V1 Coord');
  await pageV1Coord.goto('http://localhost:3000/araclar/koordinat-bulma', { waitUntil: 'domcontentloaded' });
  await pageV1Coord.waitForTimeout(1000);
  const v1CoordMap = pageV1Coord.locator('svg').first();
  if (await v1CoordMap.isVisible()) {
    const box = await v1CoordMap.boundingBox();
    if (box) {
      await pageV1Coord.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
      await pageV1Coord.waitForTimeout(500);
      await pageV1Coord.screenshot({ path: path.join(ARTIFACTS_DIR, 'v1_koordinat_clicked.png') });
    }
  }
  results.v1Coordinate = await pageV1Coord.evaluate(() => ({
    title: document.title,
    buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean),
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim())
  }));
  await pageV1Coord.close();

  // 4. AUDIT V1 AREA (/araclar/alan-hesaplama)
  console.log('--- AUDITING V1 AREA (/araclar/alan-hesaplama) ---');
  const pageV1Area = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachListeners(pageV1Area, 'V1 Area');
  await pageV1Area.goto('http://localhost:3000/araclar/alan-hesaplama', { waitUntil: 'domcontentloaded' });
  await pageV1Area.waitForTimeout(1000);
  const v1AreaMap = pageV1Area.locator('svg').first();
  if (await v1AreaMap.isVisible()) {
    const box = await v1AreaMap.boundingBox();
    if (box) {
      await pageV1Area.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.3);
      await pageV1Area.waitForTimeout(200);
      await pageV1Area.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.35);
      await pageV1Area.waitForTimeout(200);
      await pageV1Area.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
      await pageV1Area.waitForTimeout(500);
      await pageV1Area.screenshot({ path: path.join(ARTIFACTS_DIR, 'v1_alan_triangle_added.png') });
    }
  }
  results.v1Area = await pageV1Area.evaluate(() => ({
    title: document.title,
    buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean),
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim())
  }));
  await pageV1Area.close();

  // 5. AUDIT V2 ARACLAR HUB & WORKBENCH (/v2/araclar)
  console.log('--- AUDITING V2 ARACLAR (/v2/araclar) ---');
  const pageV2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachListeners(pageV2, 'V2 Araclar');
  await pageV2.goto('http://localhost:3000/v2/araclar', { waitUntil: 'domcontentloaded' });
  await pageV2.waitForTimeout(1200);
  await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_araclar_desktop_initial.png'), fullPage: true });

  results.v2Araclar = await pageV2.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
      tag: h.tagName,
      text: h.textContent?.trim().replace(/\s+/g, ' ')
    }));
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim().replace(/\s+/g, ' ')).filter(Boolean);
    const badges = Array.from(document.querySelectorAll('[class*="badge"], [class*="Badge"]')).map(b => b.textContent?.trim().replace(/\s+/g, ' '));
    const breadcrumb = document.querySelector('nav[aria-label="Breadcrumb"]')?.textContent?.trim();

    // Check zoom controls, province select, etc. in V2
    const hasZoomControls = !!document.querySelector('[aria-label*="yakınlaştır"], [class*="zoom"], [class*="Zoom"]');
    const hasProvinceSelect = !!document.querySelector('select');
    const hasUndoButton = buttons.some(b => b.toLowerCase().includes('geri al') || b.toLowerCase().includes('undo'));
    const hasSaveButton = buttons.some(b => b.toLowerCase().includes('kaydet') || b.toLowerCase().includes('save'));
    const hasPngExport = buttons.some(b => b.toLowerCase().includes('png') || b.toLowerCase().includes('indir') || b.toLowerCase().includes('export'));

    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim(),
      breadcrumb,
      headings,
      buttons,
      badges,
      hasZoomControls,
      hasProvinceSelect,
      hasUndoButton,
      hasSaveButton,
      hasPngExport
    };
  });

  // 6. DETAILED INTERACTION TESTS ON V2 ARACLAR
  console.log('--- TESTING V2 PRESETS & WORKBENCH ---');
  
  // Test Preset: Istanbul - Ankara
  const istAnkBtn = pageV2.locator('button:has-text("İstanbul - Ankara")').first();
  if (await istAnkBtn.isVisible()) {
    await istAnkBtn.click();
    await pageV2.waitForTimeout(400);
    await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_preset_istanbul_ankara.png') });
    results.v2Interactions.presetIstAnk = await pageV2.evaluate(() => {
      return {
        distMatches: document.body.innerText.match(/\d+[\.,]?\d*\s*km/g),
        circlesCount: document.querySelectorAll('svg circle').length,
        polylinesCount: document.querySelectorAll('svg polyline').length,
        outputCardText: document.querySelector('[class*="border-primary/30"]')?.innerText
      };
    });
  }

  // Test Preset: Izmir - Van
  const izmVanBtn = pageV2.locator('button:has-text("İzmir - Van")').first();
  if (await izmVanBtn.isVisible()) {
    await izmVanBtn.click();
    await pageV2.waitForTimeout(400);
    await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_preset_izmir_van.png') });
  }

  // Test Preset: Tuz Golu (Area)
  const tuzGoluBtn = pageV2.locator('button:has-text("Tuz Gölü Alanı")').first();
  if (await tuzGoluBtn.isVisible()) {
    await tuzGoluBtn.click();
    await pageV2.waitForTimeout(400);
    await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_preset_tuz_golu_area.png') });
    results.v2Interactions.presetTuzGolu = await pageV2.evaluate(() => {
      return {
        areaMatches: document.body.innerText.match(/\d+[\.,]?\d*\s*(?:km²|ha|dönüm)/g),
        circlesCount: document.querySelectorAll('svg circle').length,
        polygonCount: document.querySelectorAll('svg polygon').length,
        outputCardText: document.querySelector('[class*="border-primary/30"]')?.innerText
      };
    });
  }

  // Test Preset: Turkiye Agirlik Merkezi (Coordinates)
  const merkezBtn = pageV2.locator('button:has-text("Türkiye Ağırlık Merkezi")').first();
  if (await merkezBtn.isVisible()) {
    await merkezBtn.click();
    await pageV2.waitForTimeout(400);
    await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_preset_merkez_coord.png') });
    results.v2Interactions.presetMerkez = await pageV2.evaluate(() => {
      return {
        coordMatches: document.body.innerText.match(/\d+[\.,]?\d*°/g),
        circlesCount: document.querySelectorAll('svg circle').length,
        outputCardText: document.querySelector('[class*="border-primary/30"]')?.innerText
      };
    });
  }

  // Test Copy Summary button
  const copyBtn = pageV2.locator('button:has-text("Özeti Kopyala")').first();
  if (await copyBtn.isVisible()) {
    await copyBtn.click();
    await pageV2.waitForTimeout(300);
    results.v2Interactions.copyBtnText = await copyBtn.textContent();
  }

  // Test Temizle button
  const clearBtn = pageV2.locator('button:has-text("Temizle")').first();
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await pageV2.waitForTimeout(300);
    results.v2Interactions.afterClearCircles = await pageV2.evaluate(() => document.querySelectorAll('svg circle').length);
  }

  // Test Manual Map Click for Area Mode
  const areaTabBtn = pageV2.locator('button:has-text("Alan Hesaplama Aracı")').first();
  if (await areaTabBtn.isVisible()) {
    await areaTabBtn.click();
    await pageV2.waitForTimeout(300);
    const svgEl = pageV2.locator('svg[aria-label="Türkiye CBS Ölçüm Haritası"]').first();
    const box = await svgEl.boundingBox();
    if (box) {
      await pageV2.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.3);
      await pageV2.waitForTimeout(200);
      await pageV2.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.35);
      await pageV2.waitForTimeout(200);
      await pageV2.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.6);
      await pageV2.waitForTimeout(200);
      await pageV2.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.55);
      await pageV2.waitForTimeout(300);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_manual_area_polygon.png') });
    }
  }

  // Test Live mouse coordinates on map hover
  const svgEl = pageV2.locator('svg[aria-label="Türkiye CBS Ölçüm Haritası"]').first();
  const box = await svgEl.boundingBox();
  if (box) {
    await pageV2.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await pageV2.waitForTimeout(300);
    results.v2Interactions.hoverText = await pageV2.evaluate(() => {
      const hoverEl = document.querySelector('.font-mono.text-muted-foreground');
      return hoverEl ? hoverEl.textContent?.trim() : null;
    });
  }

  // 7. RESPONSIVENESS & OVERFLOW CHECKS
  console.log('--- TESTING RESPONSIVENESS & OVERFLOWS ---');
  const viewports = [
    { name: 'desktop_1440', width: 1440, height: 900 },
    { name: 'laptop_1024', width: 1024, height: 768 },
    { name: 'tablet_768', width: 768, height: 1024 },
    { name: 'mobile_390', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    const p = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    attachListeners(p, `V2_${vp.name}`);
    await p.goto('http://localhost:3000/v2/araclar', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(800);
    const overflow = await p.evaluate(() => {
      return {
        docScrollWidth: document.documentElement.scrollWidth,
        winInnerWidth: window.innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
        overflowDelta: Math.max(0, document.documentElement.scrollWidth - window.innerWidth, document.body.scrollWidth - window.innerWidth)
      };
    });
    results.overflows[vp.name] = overflow;
    if (vp.name === 'mobile_390') {
      await p.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_araclar_mobile_390.png'), fullPage: true });
    }
    await p.close();
  }

  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'audit_araclar_results.json'), JSON.stringify(results, null, 2));
  console.log('=== AUDIT ARACLAR FINISHED SUCCESSFULLY ===');
  await browser.close();
}

auditAraclar().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
