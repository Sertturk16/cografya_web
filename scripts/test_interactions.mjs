import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/mnt/c/Users/sertturk16/.gemini/antigravity-ide/brain/0ad323c4-48bb-47e4-aff1-0f40cbe57595';

async function testInteractions() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3000/v2/turkiye');
  await page.waitForTimeout(1000);
  
  // Test Fihrist mode
  const fihristBtn = page.locator('button[title*="Fihrist"]').first();
  if (await fihristBtn.isVisible()) {
    await fihristBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'turkiye_v2_fihrist_view.png') });
  }

  // Test Region Color mode
  const paletteBtn = page.locator('button:has-text("Bölge Renkleri")').first();
  if (await paletteBtn.isVisible()) {
    await paletteBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'turkiye_v2_palette_active.png') });
  }
  
  // Test Book detail page
  const bookPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const resp = await bookPage.goto('http://localhost:3000/v2/kitaplar/ayt-cografya-konu-ozetli-brans-denemeleri');
  console.log('Book detail page status:', resp.status());
  await bookPage.waitForTimeout(1000);
  await bookPage.screenshot({ path: path.join(ARTIFACTS_DIR, 'book_detail_v2.png'), fullPage: true });

  await browser.close();
  console.log('Interaction test completed successfully!');
}

testInteractions().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
