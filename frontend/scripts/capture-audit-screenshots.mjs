import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const outDir = '/home/parkermutsuz/.gemini/antigravity-cli/brain/6610288b-35fb-4e4a-a875-14c6e23c6a17/screenshots';
await mkdir(outDir, { recursive: true });

console.log('Launching browser for UX audit screenshots...');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

try {
  // 1. Landing Page
  console.log('1. Capturing Landing Page...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${outDir}/01_landing_desktop.png`, fullPage: false });

  // 2. Loading / Wait Flow
  console.log('2. Capturing Loading / Wait flow...');
  const input = page.locator('input[type="text"], input[placeholder*="username"]').first();
  if (await input.isVisible()) {
    await input.fill('semihmutsuz');
    const submitBtn = page.locator('button:has-text("Analyze"), button:has-text("Get Wrapped"), button:has-text("Generate")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${outDir}/02_loading_flow.png`, fullPage: false });
    }
  }

  // 3. Load SMT fixture for Results
  console.log('3. Loading fixture for Results page...');
  await page.goto('http://localhost:3000/smt', { waitUntil: 'networkidle' });
  await page.waitForURL(url => url.pathname.includes('/results'), { timeout: 10000 });
  await page.waitForTimeout(2000); // allow animations/lazy components

  // Screenshot Results Hero
  await page.screenshot({ path: `${outDir}/03_results_hero.png` });

  // Scroll down to capture mid sections
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/04_results_mid_sections.png` });

  // Scroll down to capture bottom sections
  await page.evaluate(() => window.scrollTo(0, 2600));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/05_results_bottom_sections.png` });

  // Full page screenshot of results
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${outDir}/06_results_full_page.png`, fullPage: true });

  // 4. Share Modal
  console.log('4. Capturing Share Modal...');
  const shareBtn = page.locator('button:has-text("Share your Wrapped"), button:has-text("Share Your Wrapped")').first();
  if (await shareBtn.isVisible()) {
    await shareBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${outDir}/07_share_modal.png` });
    // close modal
    const closeBtn = page.locator('button[aria-label="Close"], button:has-text("✕"), button:has-text("Close")').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
  }

  // 5. Watchlist Page
  console.log('5. Capturing Watchlist Page...');
  await page.goto('http://localhost:3000/watchlist', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/08_watchlist_page.png` });

  // 6. FindFilm Page
  console.log('6. Capturing FindFilm Page...');
  await page.goto('http://localhost:3000/findfilm', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/09_findfilm_page.png` });

  // 7. Story Page
  console.log('7. Capturing Story Page...');
  await page.goto('http://localhost:3000/story', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/10_story_page.png` });

  console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
} catch (err) {
  console.error('Error taking screenshots:', err);
} finally {
  await browser.close();
}
