import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDir = resolve('/home/parkermutsuz/.gemini/antigravity-cli/brain/019a452a-78e7-4930-af55-881aa24549fe/before_screenshots');
await mkdir(outputDir, { recursive: true });

const viewports = [
  { name: 'desktop_1440', width: 1440, height: 900 },
  { name: 'mobile_390', width: 390, height: 844 },
];

async function capture() {
  const browser = await chromium.launch();

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // 1. Landing
    console.log(`[${vp.name}] Capturing Landing...`);
    await page.goto('http://127.0.0.1:3107/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${outputDir}/1_landing_${vp.name}.png`, fullPage: true });

    // 2. Loading
    console.log(`[${vp.name}] Capturing Loading...`);
    // Type username and submit to enter loading state
    const input = page.locator('input[type="text"]').first();
    if (await input.isVisible()) {
      await input.fill('semihmutsuz');
      const submitBtn = page.locator('button[type="submit"]').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(600); // catch loading screen state
        await page.screenshot({ path: `${outputDir}/2_loading_${vp.name}.png`, fullPage: false });
      }
    }

    // 3. Results
    console.log(`[${vp.name}] Capturing Results...`);
    await page.goto('http://127.0.0.1:3107/smt', { waitUntil: 'networkidle' });
    await page.waitForURL(/\/results/, { timeout: 10000 });
    await page.waitForTimeout(1000); // let animations settle
    await page.screenshot({ path: `${outputDir}/3_results_${vp.name}.png`, fullPage: true });

    // 4. Share Modal
    console.log(`[${vp.name}] Capturing Share Modal...`);
    // Find share button and click
    const shareBtn = page.locator('button:has-text("Share"), button:has-text("Paylaş")').first();
    if (await shareBtn.isVisible()) {
      await shareBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${outputDir}/4_share_modal_${vp.name}.png`, fullPage: false });
    }

    // 5. Watchlist
    console.log(`[${vp.name}] Capturing Watchlist...`);
    await page.goto('http://127.0.0.1:3107/watchlist', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${outputDir}/5_watchlist_${vp.name}.png`, fullPage: true });

    // 6. FindFilm
    console.log(`[${vp.name}] Capturing FindFilm...`);
    await page.goto('http://127.0.0.1:3107/findfilm', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${outputDir}/6_findfilm_${vp.name}.png`, fullPage: true });

    await context.close();
  }

  await browser.close();
  console.log('Done capturing before screenshots!');
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
