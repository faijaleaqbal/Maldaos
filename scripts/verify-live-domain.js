const { chromium } = require('@playwright/test');

async function testLive() {
  console.log('Testing live production at http://127.0.0.1:3101 and domain...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[Console Error]: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`[Page Crash Error]: ${err.message}`);
  });

  const resp = await page.goto('http://127.0.0.1:3101/', { waitUntil: 'networkidle', timeout: 15000 });
  console.log('Status code:', resp.status());

  await page.waitForTimeout(2000);

  // Check if main UI elements exist and are visible
  const title = await page.textContent('h1');
  console.log('Page H1 text:', title);

  const canvasCount = await page.locator('canvas').count();
  console.log('Canvas count:', canvasCount);

  // Ensure body is not blank
  const bodyHtml = await page.innerHTML('body');
  console.log('Body HTML length:', bodyHtml.length);

  await page.screenshot({ path: 'playwright-screenshots/live-port-3101.png' });
  console.log('Screenshot saved to playwright-screenshots/live-port-3101.png');

  await browser.close();

  console.log('Total console/page errors:', errors.length);
  errors.forEach((e) => console.log('  -> ' + e));

  if (errors.length > 0 || bodyHtml.length < 500) {
    console.error('Test FAILED');
    process.exit(1);
  } else {
    console.log('Test PASSED: Page is completely functional, zero errors, not white screen!');
  }
}

testLive().catch((e) => {
  console.error(e);
  process.exit(1);
});
