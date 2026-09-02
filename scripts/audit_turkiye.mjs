import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = '/mnt/c/Users/sertturk16/.gemini/antigravity-ide/brain/0ad323c4-48bb-47e4-aff1-0f40cbe57595';

async function audit() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    v1: { errors: [], meta: {} },
    v2: { errors: [], meta: {} },
  };

  // 1. Audit V1 /turkiye Desktop
  console.log('--- AUDITING V1 /turkiye (Desktop) ---');
  const pageV1 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  pageV1.on('console', msg => {
    if (msg.type() === 'error') report.v1.errors.push(msg.text());
  });
  pageV1.on('pageerror', err => report.v1.errors.push(err.message));

  await pageV1.goto('http://localhost:3000/turkiye', { waitUntil: 'domcontentloaded' });
  await pageV1.waitForTimeout(1500);
  await pageV1.screenshot({ path: path.join(ARTIFACTS_DIR, 'turkiye_v1_desktop.png'), fullPage: true });

  const v1Data = await pageV1.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
      tag: h.tagName,
      text: h.textContent?.trim().replace(/\s+/g, ' ') || '',
    }));
    const links = Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent?.trim().replace(/\s+/g, ' ') || '',
      href: a.getAttribute('href') || '',
    })).filter(l => l.text && l.href);
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim().replace(/\s+/g, ' ') || '').filter(Boolean);
    const provinceCardsCount = document.querySelectorAll('a[href*="/turkiye/"]').length;
    const regionFilters = Array.from(document.querySelectorAll('button, [role="tab"], .filter-chip')).map(b => b.textContent?.trim() || '').filter(Boolean);

    return { title: document.title, headings, linksCount: links.length, buttons, provinceCardsCount, regionFilters };
  });
  report.v1.meta = v1Data;

  // Mobile V1
  console.log('--- AUDITING V1 /turkiye (Mobile) ---');
  const mobileV1 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mobileV1.goto('http://localhost:3000/turkiye', { waitUntil: 'domcontentloaded' });
  await mobileV1.waitForTimeout(1000);
  await mobileV1.screenshot({ path: path.join(ARTIFACTS_DIR, 'turkiye_v1_mobile.png'), fullPage: true });
  await mobileV1.close();

  // 2. Audit V2 /v2/turkiye Desktop
  console.log('--- AUDITING V2 /v2/turkiye (Desktop) ---');
  const pageV2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  pageV2.on('console', msg => {
    if (msg.type() === 'error') report.v2.errors.push(msg.text());
  });
  pageV2.on('pageerror', err => report.v2.errors.push(err.message));

  await pageV2.goto('http://localhost:3000/v2/turkiye', { waitUntil: 'domcontentloaded' });
  await pageV2.waitForTimeout(1500);
  await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'turkiye_v2_desktop.png'), fullPage: true });

  const v2Data = await pageV2.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
      tag: h.tagName,
      text: h.textContent?.trim().replace(/\s+/g, ' ') || '',
    }));
    const links = Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent?.trim().replace(/\s+/g, ' ') || '',
      href: a.getAttribute('href') || '',
    })).filter(l => l.text && l.href);
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim().replace(/\s+/g, ' ') || '').filter(Boolean);
    const provinceCardsCount = document.querySelectorAll('a[href*="/v2/turkiye/"]').length;

    const docWidth = document.documentElement.offsetWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const hasHorizontalOverflow = bodyScrollWidth > window.innerWidth;

    return { 
      title: document.title, 
      headings, 
      linksCount: links.length, 
      buttons, 
      provinceCardsCount,
      docWidth,
      bodyScrollWidth,
      hasHorizontalOverflow
    };
  });
  report.v2.meta = v2Data;

  // Test V2 Interactions: Map Hover, Region Tabs, Province Search, Sorting
  console.log('--- TESTING V2 /v2/turkiye INTERACTIONS ---');

  // 1. Test Map Hover over a province (e.g. Ankara or Istanbul or Izmir)
  try {
    const provincePath = pageV2.locator('svg path[data-plate="06"]').or(pageV2.locator('svg path[data-code="06"]')).or(pageV2.locator('svg path').nth(10));
    if (await provincePath.isVisible()) {
      await provincePath.hover();
      await pageV2.waitForTimeout(400);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'turkiye_v2_map_hover.png') });
    }
  } catch (e) { console.log('Map hover error:', e.message); }

  // 2. Test Region Filter (e.g., "Ege" or "Marmara" or "Akdeniz")
  try {
    const egeFilter = pageV2.locator('button', { hasText: 'Ege' }).first();
    if (await egeFilter.isVisible()) {
      await egeFilter.click();
      await pageV2.waitForTimeout(500);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'turkiye_v2_ege_filtered.png') });
    }
  } catch (e) { console.log('Region filter error:', e.message); }

  // 3. Test Search Input
  try {
    const searchInput = pageV2.locator('input[placeholder*="İl ara"], input[placeholder*="ara"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Burs');
      await pageV2.waitForTimeout(500);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'turkiye_v2_search_bursa.png') });
      await searchInput.fill('');
      await pageV2.waitForTimeout(300);
    }
  } catch (e) { console.log('Search error:', e.message); }

  // 4. Test View Toggle (Grid vs Table if present)
  try {
    const tableToggle = pageV2.locator('button[aria-label*="Tablo"], button:has-text("Tablo")').first();
    if (await tableToggle.isVisible()) {
      await tableToggle.click();
      await pageV2.waitForTimeout(500);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'turkiye_v2_table_view.png') });
    }
  } catch (e) { console.log('View toggle error:', e.message); }

  // 5. Test Mobile V2 /v2/turkiye
  console.log('--- AUDITING V2 /v2/turkiye (Mobile) ---');
  const mobileV2 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  mobileV2.on('console', msg => {
    if (msg.type() === 'error') report.v2.errors.push('Mobile: ' + msg.text());
  });
  await mobileV2.goto('http://localhost:3000/v2/turkiye', { waitUntil: 'domcontentloaded' });
  await mobileV2.waitForTimeout(1000);
  await mobileV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'turkiye_v2_mobile.png'), fullPage: true });
  await mobileV2.close();

  // Save report
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'turkiye_audit_raw.json'), JSON.stringify(report, null, 2));
  console.log('Turkey audit completed successfully!');
  await browser.close();
}

audit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
