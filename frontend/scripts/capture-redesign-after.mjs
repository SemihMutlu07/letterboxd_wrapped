import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const outDir = '/home/parkermutsuz/.gemini/antigravity-cli/brain/6610288b-35fb-4e4a-a875-14c6e23c6a17/screenshots_redesign';
await mkdir(outDir, { recursive: true });

console.log('Capturing redesigned UI screenshots from localhost:3005...');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

try {
  // Load SMT fixture
  await page.goto('http://localhost:3005/smt', { waitUntil: 'networkidle' });
  await page.waitForURL(url => url.pathname.includes('/results'), { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Chapter 1 Identity
  await page.screenshot({ path: `${outDir}/chapter1_identity.png` });

  // Chapter 2 Habits
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/chapter2_habits.png` });

  // Chapter 3 Tastes
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/chapter3_tastes.png` });

  // Chapter 4 Finale & Share Hub
  await page.evaluate(() => window.scrollTo(0, 2600));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/chapter4_share_hub.png` });

  console.log('REDESIGN SCREENSHOTS CAPTURED SUCCESSFULLY!');
} catch (err) {
  console.error('Error capturing screenshots:', err);
} finally {
  await browser.close();
}
