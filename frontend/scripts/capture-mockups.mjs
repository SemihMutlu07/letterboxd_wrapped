import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDir = resolve('/home/parkermutsuz/.gemini/antigravity-cli/brain/019a452a-78e7-4930-af55-881aa24549fe');
await mkdir(outputDir, { recursive: true });

async function capture() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:3107/dev/hero-mockups...');
  await page.goto('http://127.0.0.1:3107/dev/hero-mockups', { waitUntil: 'networkidle' });

  // Option A
  const optA = page.locator('#option-a');
  await optA.screenshot({ path: `${outputDir}/option_a_cinephile_darkroom.png` });

  // Option B
  const optB = page.locator('#option-b');
  await optB.screenshot({ path: `${outputDir}/option_b_modern_editorial.png` });

  // Option C
  const optC = page.locator('#option-c');
  await optC.screenshot({ path: `${outputDir}/option_c_neon_marquee.png` });

  // Full comparison page
  await page.screenshot({ path: `${outputDir}/hero_stats_art_directions_full.png`, fullPage: true });

  await browser.close();
  console.log('Done capturing art direction mockups!');
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
