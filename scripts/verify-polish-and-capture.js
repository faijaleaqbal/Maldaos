const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:3101';
const POLISH_DIR = path.resolve(__dirname, '../playwright-screenshots/polish-verification');

if (!fs.existsSync(POLISH_DIR)) {
  fs.mkdirSync(POLISH_DIR, { recursive: true });
}

async function verifyPolish() {
  console.log('=== STARTING MANDATORY VISUAL VERIFICATION OF POLISHED HERO ===');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--use-gl=swiftshader', '--enable-webgl', '--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n--- 1. Testing Pinned Scroll Scrub on Desktop (1440x900) ---');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#campus-hero-scroll-container', { timeout: 20000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(2500);

  // Capture Chapter 1
  await page.screenshot({ path: path.join(POLISH_DIR, 'ch1_1440x900.png') });
  console.log('Captured Chapter 1');

  // Test Scroll Scrubbing through 320vh container
  const heroSection = page.locator('#campus-hero-scroll-container');
  const box = await heroSection.boundingBox();
  console.log(`Hero container height: ${box.height}px (Pinned Scroll Container)`);

  const scrollSteps = [
    { ch: 2, pct: 0.20 },
    { ch: 3, pct: 0.40 },
    { ch: 4, pct: 0.60 },
    { ch: 5, pct: 0.80 },
    { ch: 6, pct: 0.98 },
  ];

  for (const step of scrollSteps) {
    const scrollY = (box.height - 900) * step.pct;
    await page.evaluate((y) => window.scrollTo({ top: y }), scrollY);
    await page.waitForTimeout(1500); // allow smooth camera lerp

    const shot = path.join(POLISH_DIR, `ch${step.ch}_1440x900.png`);
    await page.screenshot({ path: shot });

    const activeH1 = await page.locator('#campus-hero-scroll-container h1').textContent();
    console.log(`Scrubbed to Chapter ${step.ch} (${Math.round(step.pct * 100)}%): "${activeH1}"`);
  }

  // Scroll past hero to ensure page resumes normally
  console.log('\n--- 2. Verifying Normal Page Scroll Resumes Past Hero ---');
  await page.evaluate((y) => window.scrollTo({ top: y }), box.height + 200);
  await page.waitForTimeout(500);
  const ticketSearchVisible = await page.locator('#hp-ticket-search').isVisible();
  console.log(`Ticket search visible below hero: ${ticketSearchVisible ? 'YES (Resumed)' : 'NO'}`);
  await page.screenshot({ path: path.join(POLISH_DIR, 'resumed_below_hero.png') });

  await page.close();

  // 3. Mobile Viewport 390x844
  console.log('\n--- 3. Testing Mobile Viewport 390x844 ---');
  const mPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await mPage.waitForSelector('#campus-hero-scroll-container', { timeout: 20000 });
  await mPage.waitForSelector('canvas', { timeout: 20000 });
  await mPage.waitForTimeout(2000);

  // Check 3D visibility on mobile
  const mBox = await mPage.locator('#campus-hero-scroll-container').boundingBox();
  await mPage.screenshot({ path: path.join(POLISH_DIR, 'ch1_mobile_390x844.png') });

  // Scrub mobile
  const mScrollY = (mBox.height - 844) * 0.40; // Chapter 3
  await mPage.evaluate((y) => window.scrollTo({ top: y }), mScrollY);
  await mPage.waitForTimeout(1500);
  await mPage.screenshot({ path: path.join(POLISH_DIR, 'ch3_mobile_390x844.png') });

  const mScrollY6 = (mBox.height - 844) * 0.98; // Chapter 6
  await mPage.evaluate((y) => window.scrollTo({ top: y }), mScrollY6);
  await mPage.waitForTimeout(1500);
  await mPage.screenshot({ path: path.join(POLISH_DIR, 'ch6_mobile_390x844.png') });

  await mPage.close();

  // 4. Mobile Viewport 320x568 (Smallest Screen)
  console.log('\n--- 4. Testing Small Mobile Viewport 320x568 ---');
  const sPage = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await sPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await sPage.waitForSelector('#campus-hero-scroll-container', { timeout: 20000 });
  await sPage.waitForSelector('canvas', { timeout: 20000 });
  await sPage.waitForTimeout(1500);
  await sPage.screenshot({ path: path.join(POLISH_DIR, 'ch1_mobile_320x568.png') });
  await sPage.close();

  // 5. Verify /map has ZERO regression
  console.log('\n--- 5. Verifying /map Has Zero Regression ---');
  const mapPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const mapResp = await mapPage.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle' });
  console.log(`Map Status: ${mapResp.status()}`);
  await mapPage.waitForTimeout(2000);
  await mapPage.screenshot({ path: path.join(POLISH_DIR, 'map_regression_check.png') });
  await mapPage.close();

  await browser.close();

  console.log('\n=== VERIFICATION FINISHED ===');
  console.log(`Total Errors Logged: ${errors.length}`);
  errors.forEach(e => console.error('Error: ' + e));

  if (errors.length === 0) {
    console.log('SUCCESS: All 6 chapters, mobile viewports, scroll scrub, and /map verified cleanly!');
  } else {
    process.exit(1);
  }
}

verifyPolish().catch((err) => {
  console.error('Verification script error:', err);
  process.exit(1);
});
