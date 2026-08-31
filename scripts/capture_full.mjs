import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/mnt/c/Users/sertturk16/.gemini/antigravity-ide/brain/0ad323c4-48bb-47e4-aff1-0f40cbe57595';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/v2/turkiye');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'turkiye_v2_region_grouped.png'), fullPage: true });
  await browser.close();
  console.log('Capture saved successfully!');
}

capture().catch(console.error);
