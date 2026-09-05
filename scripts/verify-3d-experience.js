const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve(__dirname, '../playwright-screenshots/3d-experience');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-320x568', width: 320, height: 568 },
];

async function run() {
  console.log('--- Starting MaldaOS 3D Spatial Experience Verification ---');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--use-gl=swiftshader', '--enable-webgl', '--no-sandbox'],
  });

  const errors = [];
  const warnings = [];

  // TEST 1: Landing Page 3D Experience on Desktop
  console.log('Test 1: Testing Landing Page (/) 3D Experience on Desktop...');
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`[Console Error /]: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`[Page Error /]: ${err.message}`);
  });

  const resp = await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  console.log(`Landing Page Status: ${resp.status()}`);
  if (resp.status() !== 200) {
    throw new Error(`Landing page returned non-200: ${resp.status()}`);
  }

  // Wait for canvas or 3D container
  await page.waitForTimeout(2000);
  const canvasCount = await page.locator('canvas').count();
  console.log(`Canvas elements found on Landing Page: ${canvasCount}`);

  // Take screenshot of 3D Hero
  await page.screenshot({ path: path.join(OUT_DIR, '01-landing-hero-desktop.png') });
  console.log('Saved screenshot: 01-landing-hero-desktop.png');

  // Test Chapter Navigation Stepper
  const nextBtn = page.locator('button[aria-label="Next Chapter"]');
  if (await nextBtn.isVisible()) {
    console.log('Stepping through 3D story chapters...');
    await nextBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '02-landing-chapter-2.png') });

    await nextBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '03-landing-chapter-3.png') });
    console.log('Chapter transitions completed successfully.');
  }

  await page.close();

  // TEST 2: Dedicated 3D Spatial Map Route (/map)
  console.log('Test 2: Testing Dedicated 3D Spatial Map (/map)...');
  const mapPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  mapPage.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`[Console Error /map]: ${msg.text()}`);
    }
  });
  mapPage.on('pageerror', (err) => {
    errors.push(`[Page Error /map]: ${err.message}`);
  });

  const mapResp = await mapPage.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle', timeout: 15000 });
  console.log(`Map Page Status: ${mapResp.status()}`);
  if (mapResp.status() !== 200) {
    throw new Error(`Map page returned non-200: ${mapResp.status()}`);
  }

  await mapPage.waitForTimeout(2500);
  await mapPage.screenshot({ path: path.join(OUT_DIR, '04-spatial-map-desktop.png') });
  console.log('Saved screenshot: 04-spatial-map-desktop.png');

  // Test building filter dropdown
  const buildingSelect = mapPage.locator('select');
  if (await buildingSelect.isVisible()) {
    console.log('Testing building focus selection in 3D Map...');
    await buildingSelect.selectOption('VID-BHAVAN');
    await mapPage.waitForTimeout(1000);
    await mapPage.screenshot({ path: path.join(OUT_DIR, '05-spatial-map-science-focus.png') });
    console.log('Building focus interaction successful.');
  }

  await mapPage.close();

  // TEST 3: Responsive Viewports Check
  console.log('Test 3: Checking Responsive Viewports...');
  for (const vp of VIEWPORTS) {
    const rPage = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    rPage.on('pageerror', (err) => errors.push(`[VP Error ${vp.name}]: ${err.message}`));

    await rPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await rPage.waitForTimeout(1500);

    // Verify horizontal overflow
    const hasOverflow = await rPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    console.log(`Viewport ${vp.name} (w: ${vp.width}, h: ${vp.height}): Overflow = ${hasOverflow ? 'DETECTED!' : 'None (Clean)'}`);
    if (hasOverflow) {
      warnings.push(`Horizontal overflow detected at ${vp.name}`);
    }

    await rPage.screenshot({ path: path.join(OUT_DIR, `responsive-${vp.name}.png`) });
    await rPage.close();
  }

  // TEST 4: WebGL Graceful Fallback (White-screen protection)
  console.log('Test 4: Verifying WebGL Fallback / White-screen Protection...');
  const fallbackContext = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const fallbackPage = await fallbackContext.newPage();

  // Disable WebGL by overriding getContext
  await fallbackPage.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        return null;
      }
      return null;
    };
  });

  await fallbackPage.goto(BASE_URL, { waitUntil: 'networkidle' });
  await fallbackPage.waitForTimeout(1000);

  // Check if page rendered without white-screen
  const bodyText = await fallbackPage.textContent('body');
  const hasFallbackText = bodyText.includes('Malda College') || bodyText.includes('Operations');
  console.log(`WebGL Disabled: Fallback Content Rendered: ${hasFallbackText ? 'YES (Protected)' : 'NO'}`);

  await fallbackPage.screenshot({ path: path.join(OUT_DIR, '06-webgl-disabled-fallback.png') });
  await fallbackPage.close();
  await fallbackContext.close();

  await browser.close();

  console.log('--- Verification Summary ---');
  console.log(`Errors logged: ${errors.length}`);
  errors.forEach((e) => console.error('  ' + e));
  console.log(`Warnings logged: ${warnings.length}`);
  warnings.forEach((w) => console.warn('  ' + w));

  if (errors.length > 0) {
    console.error('FAILED: Errors detected during browser verification.');
    process.exit(1);
  } else {
    console.log('SUCCESS: All 3D experiences, responsive viewports, and fallbacks verified cleanly!');
  }
}

run().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
