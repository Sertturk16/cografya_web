import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = '/mnt/c/Users/sertturk16/.gemini/antigravity-ide/brain/0ad323c4-48bb-47e4-aff1-0f40cbe57595';

async function audit() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    v1: { errors: [], meta: {}, interactive: {} },
    v2: { errors: [], meta: {}, interactive: {} },
    comparison: {}
  };

  // 1. Audit V1 Homepage Desktop
  console.log('--- AUDITING V1 HOMEPAGE (Desktop) ---');
  const pageV1 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  pageV1.on('console', msg => {
    if (msg.type() === 'error') report.v1.errors.push(msg.text());
  });
  pageV1.on('pageerror', err => report.v1.errors.push(err.message));

  await pageV1.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await pageV1.waitForTimeout(1500);
  await pageV1.screenshot({ path: path.join(ARTIFACTS_DIR, 'v1_desktop_full.png'), fullPage: true });

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
    const navItems = Array.from(document.querySelectorAll('nav a, header a')).map(a => ({
      text: a.textContent?.trim().replace(/\s+/g, ' ') || '',
      href: a.getAttribute('href') || ''
    }));
    const sections = Array.from(document.querySelectorAll('section, main > div, .container > section, .container > div')).map((s, idx) => ({
      index: idx,
      id: s.id || '',
      className: (s.className || '').toString().slice(0, 80),
      heading: s.querySelector('h1, h2, h3, h4')?.textContent?.trim().replace(/\s+/g, ' ') || '',
      textSample: s.textContent?.trim().replace(/\s+/g, ' ').slice(0, 150) || ''
    }));
    return { title: document.title, headings, linksCount: links.length, links: links.slice(0, 30), navItems, buttons, sections };
  });
  report.v1.meta = v1Data;

  // Audit V1 Mobile
  console.log('--- AUDITING V1 HOMEPAGE (Mobile) ---');
  const mobileV1 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mobileV1.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await mobileV1.waitForTimeout(1000);
  await mobileV1.screenshot({ path: path.join(ARTIFACTS_DIR, 'v1_mobile_full.png'), fullPage: true });
  await mobileV1.close();

  // 2. Audit V2 Homepage Desktop
  console.log('--- AUDITING V2 HOMEPAGE (Desktop) ---');
  const pageV2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  pageV2.on('console', msg => {
    if (msg.type() === 'error') report.v2.errors.push(msg.text());
  });
  pageV2.on('pageerror', err => report.v2.errors.push(err.message));

  await pageV2.goto('http://localhost:3000/v2', { waitUntil: 'domcontentloaded' });
  await pageV2.waitForTimeout(1500);
  await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_desktop_full.png'), fullPage: true });

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
    const navItems = Array.from(document.querySelectorAll('nav a, header a')).map(a => ({
      text: a.textContent?.trim().replace(/\s+/g, ' ') || '',
      href: a.getAttribute('href') || ''
    }));
    const sections = Array.from(document.querySelectorAll('main > section, main > div')).map((s, idx) => ({
      index: idx,
      id: s.id || '',
      className: (s.className || '').toString().slice(0, 80),
      heading: s.querySelector('h1, h2, h3, h4')?.textContent?.trim().replace(/\s+/g, ' ') || '',
      textSample: s.textContent?.trim().replace(/\s+/g, ' ').slice(0, 150) || ''
    }));

    const docWidth = document.documentElement.offsetWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const hasHorizontalOverflow = bodyScrollWidth > window.innerWidth;

    return { 
      title: document.title, 
      headings, 
      linksCount: links.length, 
      links: links.slice(0, 30), 
      navItems, 
      buttons, 
      sections,
      docWidth,
      bodyScrollWidth,
      hasHorizontalOverflow
    };
  });
  report.v2.meta = v2Data;

  // Interacting with V2 elements
  console.log('--- TESTING V2 INTERACTIONS ---');
  
  // Test Header Dropdowns
  try {
    const atlasBtn = pageV2.locator('button', { hasText: 'Atlas & Harita' }).first();
    if (await atlasBtn.isVisible()) {
      await atlasBtn.click();
      await pageV2.waitForTimeout(400);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_dropdown_atlas.png') });
    }
  } catch(e) { console.log('Atlas dropdown error:', e.message); }

  try {
    const telemetriBtn = pageV2.locator('button', { hasText: 'Canlı Telemetri' }).first();
    if (await telemetriBtn.isVisible()) {
      await telemetriBtn.click();
      await pageV2.waitForTimeout(400);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_dropdown_telemetri.png') });
    }
  } catch(e) { console.log('Telemetri dropdown error:', e.message); }

  try {
    const araclarBtn = pageV2.locator('button', { hasText: 'Etkileşim & Araçlar' }).first();
    if (await araclarBtn.isVisible()) {
      await araclarBtn.click();
      await pageV2.waitForTimeout(400);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_dropdown_araclar.png') });
    }
  } catch(e) { console.log('Araclar dropdown error:', e.message); }

  // Test Favorite Button Click
  try {
    const favBtn = pageV2.locator('button', { hasText: 'Favori' }).first();
    if (await favBtn.isVisible()) {
      await favBtn.click();
      await pageV2.waitForTimeout(500);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_favorite_dialog.png') });
      await pageV2.keyboard.press('Escape');
      await pageV2.waitForTimeout(300);
    }
  } catch(e) { console.log('Favorite click error:', e.message); }

  // Test Search Trigger (Ctrl+K or search button)
  try {
    const searchTrigger = pageV2.locator('header button', { hasText: 'Ara...' }).or(pageV2.locator('button:has-text("Ara...")')).first();
    if (await searchTrigger.isVisible()) {
      await searchTrigger.click();
      await pageV2.waitForTimeout(500);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_search_dialog.png') });
      await pageV2.keyboard.press('Escape');
      await pageV2.waitForTimeout(300);
    }
  } catch(e) { console.log('Search trigger error:', e.message); }

  // Test Hero search input typing
  try {
    const heroInput = pageV2.locator('input[placeholder*="Bursa"]').first();
    if (await heroInput.isVisible()) {
      await heroInput.fill('Burs');
      await pageV2.waitForTimeout(500);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_hero_search_dropdown.png') });
      await heroInput.fill('');
    }
  } catch(e) { console.log('Hero search typing error:', e.message); }

  // Test Günün Sorusu Interaction
  try {
    const quizOption = pageV2.locator('button', { hasText: 'Ege Bölgesi' }).or(pageV2.locator('button:has-text("Bölgesi")')).first();
    if (await quizOption.isVisible()) {
      await quizOption.click();
      await pageV2.waitForTimeout(500);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_quiz_answered.png') });
    }
  } catch(e) { console.log('Quiz click error:', e.message); }

  // Test Region Filter on Map Preview
  try {
    const egeBtn = pageV2.locator('button', { hasText: 'Bölgeler' }).or(pageV2.locator('button:has-text("Siyasi")')).first();
    if (await egeBtn.isVisible()) {
      await egeBtn.click();
      await pageV2.waitForTimeout(500);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_map_mode_changed.png') });
    }
  } catch(e) { console.log('Region filter error:', e.message); }

  // Test Distance Calculator Widget on Homepage
  try {
    const selectCityA = pageV2.locator('select').first();
    if (await selectCityA.isVisible()) {
      await selectCityA.selectOption('izmir');
      await pageV2.waitForTimeout(300);
      await pageV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_distance_calculator.png') });
    }
  } catch(e) { console.log('Distance calc error:', e.message); }

  // Test Mobile V2 Inspection
  console.log('--- TESTING V2 MOBILE ---');
  const mobileV2 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  mobileV2.on('console', msg => {
    if (msg.type() === 'error') report.v2.errors.push('Mobile: ' + msg.text());
  });
  await mobileV2.goto('http://localhost:3000/v2', { waitUntil: 'domcontentloaded' });
  await mobileV2.waitForTimeout(1000);
  await mobileV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_mobile_full.png'), fullPage: true });

  // Open mobile menu
  try {
    const hamburger = mobileV2.locator('header button').last();
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await mobileV2.waitForTimeout(500);
      await mobileV2.screenshot({ path: path.join(ARTIFACTS_DIR, 'v2_mobile_menu_open.png') });
    }
  } catch(e) { console.log('Mobile menu error:', e.message); }
  await mobileV2.close();

  // Save report
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'audit_raw_data.json'), JSON.stringify(report, null, 2));
  console.log('Audit completed successfully! Saved all screenshots and data to artifacts dir.');
  await browser.close();
}

audit().catch(err => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
