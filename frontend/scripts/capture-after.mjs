import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDir = resolve('/home/parkermutsuz/.gemini/antigravity-cli/brain/019a452a-78e7-4930-af55-881aa24549fe/after_screenshots');
await mkdir(outputDir, { recursive: true });

async function capture() {
  const browser = await chromium.launch();

  for (const vp of [{ name: 'desktop_1440', width: 1440, height: 900 }, { name: 'mobile_390', width: 390, height: 844 }]) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    console.log(`[${vp.name}] Capturing After Results...`);
    await page.goto('http://127.0.0.1:3107/smt');
    await page.waitForTimeout(3000); // allow redirect + load
    await page.screenshot({ path: `${outputDir}/3_results_${vp.name}.png`, fullPage: true });

    // HeroStats section zoomed screenshot
    const heroSec = page.locator('section').first();
    if (await heroSec.isVisible()) {
      await heroSec.screenshot({ path: `${outputDir}/hero_stats_${vp.name}.png` });
    }

    await context.close();
  }

  await browser.close();
  console.log('Done capturing after screenshots!');
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
