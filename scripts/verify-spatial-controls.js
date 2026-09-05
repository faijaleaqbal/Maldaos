const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:3101';
const OUT_DIR = path.resolve(__dirname, '../playwright-screenshots/spatial-qa');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'desktop_1440x900', width: 1440, height: 900 },
  { name: 'laptop_1024x768', width: 1024, height: 768 },
  { name: 'tablet_768x1024', width: 768, height: 1024 },
  { name: 'mobile_large_428x926', width: 428, height: 926 },
  { name: 'mobile_standard_390x844', width: 390, height: 844 },
  { name: 'mobile_compact_375x667', width: 375, height: 667 },
  { name: 'mobile_small_320x568', width: 320, height: 568 },
];

async function runSpatialQA() {
  console.log('=== STARTING MALDAOS SPATIAL CONTROLS VISUAL QA ===\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--use-gl=swiftshader', '--enable-webgl', '--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // 1. Test Issues Feed (Filters, Tabs, Search, Primary Buttons)
    await page.goto(`${BASE_URL}/issues`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Check horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    console.log(`[${vp.name}] /issues horizontal overflow: ${hasHorizontalOverflow ? 'FAIL (Overflow)' : 'PASS (No overflow)'}`);

    // Capture initial issues feed
    const issuesShot = path.join(OUT_DIR, `issues_${vp.name}.png`);
    await page.screenshot({ path: issuesShot });

    // Test tab switching (Ledger -> Cards)
    const cardsTab = page.locator('button[role="tab"]:has-text("Cards")');
    if (await cardsTab.isVisible()) {
      await cardsTab.click();
      await page.waitForTimeout(350); // wait for 240ms tab transition
      const cardsShot = path.join(OUT_DIR, `issues_cards_${vp.name}.png`);
      await page.screenshot({ path: cardsShot });
      console.log(`[${vp.name}] Switched to Cards view smoothly`);
    }

    // Test filter selection
    const electFilter = page.locator('button[aria-pressed]:has-text("ELECTRICAL")');
    if (await electFilter.isVisible()) {
      await electFilter.click();
      await page.waitForTimeout(300);
      const filterShot = path.join(OUT_DIR, `issues_filter_electrical_${vp.name}.png`);
      await page.screenshot({ path: filterShot });
      console.log(`[${vp.name}] Selected Electrical category filter`);
    }

    // 2. Test Home Page (CTA buttons, track search, role switchers)
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const homeShot = path.join(OUT_DIR, `home_${vp.name}.png`);
    await page.screenshot({ path: homeShot });

    // Test Hover / Micro-interaction on Track button if desktop
    if (vp.width >= 1024) {
      const trackBtn = page.locator('button:has-text("Track")');
      if (await trackBtn.isVisible()) {
        const box = await trackBtn.boundingBox();
        if (box) {
          // Hover on button with slight offset from center to trigger tilt
          await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7);
          await page.waitForTimeout(200);
          const hoverShot = path.join(OUT_DIR, `home_track_hover_${vp.name}.png`);
          await trackBtn.screenshot({ path: hoverShot });
          console.log(`[${vp.name}] Captured Track button hover spatial tilt`);
        }
      }
    }

    // 3. Test Map Page (Directory items, Lodge Defect Report CTA, Spatial map)
    await page.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const mapShot = path.join(OUT_DIR, `map_${vp.name}.png`);
    await page.screenshot({ path: mapShot });

    results.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      horizontalOverflow: hasHorizontalOverflow,
      errorsCount: errors.length,
      errors,
    });

    await ctx.close();
  }

  await browser.close();

  console.log('\n=== VISUAL QA RESULTS SUMMARY ===');
  console.table(results.map(r => ({
    Viewport: r.viewport,
    Dimensions: `${r.width}x${r.height}`,
    'No Overflow': !r.horizontalOverflow ? 'PASS' : 'FAIL',
    Errors: r.errorsCount === 0 ? '0 (Clean)' : `${r.errorsCount} errors`,
  })));

  const allPassed = results.every(r => !r.horizontalOverflow && r.errorsCount === 0);
  console.log(`\nOVERALL QUALITY VERIFICATION: ${allPassed ? 'ALL PASS (100%)' : 'WARNINGS FOUND'}`);
}

runSpatialQA().catch((err) => {
  console.error('Fatal QA error:', err);
  process.exit(1);
});
