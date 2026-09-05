const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:3101';
const QA_DIR = path.resolve(__dirname, '../playwright-screenshots/deep-qa');

if (!fs.existsSync(QA_DIR)) {
  fs.mkdirSync(QA_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '1440x900_desktop', width: 1440, height: 900 },
  { name: '1024x768_tablet_landscape', width: 1024, height: 768 },
  { name: '768x1024_tablet_portrait', width: 768, height: 1024 },
  { name: '428x926_mobile_large', width: 428, height: 926 },
  { name: '390x844_mobile_standard', width: 390, height: 844 },
  { name: '375x667_mobile_se2', width: 375, height: 667 },
  { name: '320x568_mobile_se1', width: 320, height: 568 },
];

async function runDeepAudit() {
  console.log('=== STARTING DEEP VISUAL & INTERACTION QA ===');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--use-gl=swiftshader', '--enable-webgl', '--no-sandbox', '--disable-setuid-sandbox'],
  });

  const auditResults = {
    routes: {},
    viewports: {},
    chapters: [],
    mapAudit: {},
    fps: null,
    failures: {},
    observations: [],
  };

  // 1. ROUTE VERIFICATION
  console.log('\n--- 1. VERIFYING ALL KEY ROUTES ---');
  const routesToTest = ['/', '/map', '/dashboard', '/issues', '/report', '/admin', '/admin/map'];
  const testPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  for (const r of routesToTest) {
    try {
      const resp = await testPage.goto(`${BASE_URL}${r}`, { waitUntil: 'networkidle', timeout: 12000 });
      auditResults.routes[r] = {
        status: resp.status(),
        ok: resp.ok(),
      };
      console.log(`Route ${r}: HTTP ${resp.status()}`);
    } catch (e) {
      auditResults.routes[r] = { status: 'ERR', error: e.message };
      console.error(`Route ${r}: FAILED (${e.message})`);
    }
  }
  await testPage.close();

  // 2. LANDING PAGE VIEWPORTS & OVERFLOW AUDIT
  console.log('\n--- 2. LANDING PAGE VIEWPORTS AUDIT ---');
  for (const vp of VIEWPORTS) {
    const vpPage = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const consoleErrors = [];
    vpPage.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    vpPage.on('pageerror', (err) => consoleErrors.push(err.message));

    await vpPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await vpPage.waitForTimeout(1500);

    const metrics = await vpPage.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const canvas = document.querySelector('canvas');
      const h1 = document.querySelector('h1');
      const h1Rect = h1 ? h1.getBoundingClientRect() : null;
      return {
        docW,
        scrollW,
        hasOverflow: scrollW > docW + 1,
        hasCanvas: !!canvas,
        canvasSize: canvas ? { w: canvas.clientWidth, h: canvas.clientHeight } : null,
        h1Visible: h1Rect ? h1Rect.top >= 0 && h1Rect.bottom <= window.innerHeight : false,
      };
    });

    const shotPath = path.join(QA_DIR, `landing_${vp.name}.png`);
    await vpPage.screenshot({ path: shotPath });

    auditResults.viewports[vp.name] = {
      ...metrics,
      consoleErrors,
      screenshot: shotPath,
    };
    console.log(`Viewport ${vp.name}: Overflow=${metrics.hasOverflow ? 'YES (FAIL)' : 'None'}, Canvas=${metrics.hasCanvas}, Errors=${consoleErrors.length}`);
    await vpPage.close();
  }

  // 3. SIX-CHAPTER STORY AUDIT
  console.log('\n--- 3. SIX-CHAPTER STORY AUDIT ---');
  const storyPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await storyPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await storyPage.waitForTimeout(2000);

  const nextBtn = storyPage.locator('button[aria-label="Next Chapter"]');

  for (let ch = 1; ch <= 6; ch++) {
    const chapterData = await storyPage.evaluate(() => {
      const h1 = document.querySelector('h1')?.textContent;
      const step = document.querySelector('.font-mono.font-bold')?.textContent;
      const subtitle = document.querySelector('p.font-serif')?.textContent;
      const focus = document.querySelector('.font-serif.font-bold.text-maroon-950')?.textContent;
      return { h1, step, subtitle, focus };
    });

    const chShot = path.join(QA_DIR, `chapter_0${ch}.png`);
    await storyPage.screenshot({ path: chShot });

    auditResults.chapters.push({
      chapterNumber: ch,
      ...chapterData,
      screenshot: chShot,
    });
    console.log(`Chapter ${ch}: "${chapterData.h1}" -> Focus: ${chapterData.focus}`);

    if (ch < 6 && await nextBtn.isVisible()) {
      await nextBtn.click();
      await storyPage.waitForTimeout(1000); // allow camera interpolation
    }
  }
  await storyPage.close();

  // 4. /MAP DEEP VISUAL & INTERACTION AUDIT
  console.log('\n--- 4. /MAP INTERACTION AUDIT ---');
  const mapPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mapPage.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle' });
  await mapPage.waitForTimeout(2500);

  // Initial Overview shot
  const mapInitialShot = path.join(QA_DIR, 'map_01_overview.png');
  await mapPage.screenshot({ path: mapInitialShot });

  // Test Building Presets
  const buildingSelect = mapPage.locator('select').first();
  const presetsToTest = [
    { code: 'CENT-ADM', name: 'Centenary' },
    { code: 'VID-BHAVAN', name: 'Science' },
    { code: 'LIB-CENTRAL', name: 'Library' },
    { code: 'RAB-BHAVAN', name: 'Auditorium' },
    { code: 'BCA-COMPLEX', name: 'IT_Complex' },
    { code: 'HOSTEL-BOYS', name: 'Hostel' }
  ];

  auditResults.mapAudit.presetTests = [];
  for (const preset of presetsToTest) {
    await buildingSelect.selectOption(preset.code);
    await mapPage.waitForTimeout(1200);

    // Check if building diagnostic ledger is rendered
    const cardData = await mapPage.evaluate(() => {
      const cardTitle = document.querySelector('.font-serif.font-bold.text-sm.text-ink')?.textContent;
      const cardCode = document.querySelector('.font-mono.text-\\[10px\\].font-bold.text-maroon-800')?.textContent;
      return { cardTitle, cardCode };
    });

    const shot = path.join(QA_DIR, `map_preset_${preset.name}.png`);
    await mapPage.screenshot({ path: shot });

    auditResults.mapAudit.presetTests.push({
      preset: preset.code,
      expected: preset.name,
      cardFound: cardData.cardCode === preset.code,
      screenshot: shot,
    });
    console.log(`Map Preset ${preset.code}: Focused and Ledger Card=${cardData.cardTitle}`);
  }

  // Test Severity Filters
  const urgentFilterBtn = mapPage.locator('button:has-text("Urgent Hazards")');
  if (await urgentFilterBtn.isVisible()) {
    await urgentFilterBtn.click();
    await mapPage.waitForTimeout(800);
    const shot = path.join(QA_DIR, 'map_filter_urgent.png');
    await mapPage.screenshot({ path: shot });
    console.log('Tested Urgent Hazards filter button');
  }

  await mapPage.close();

  // 5. MEASURE FPS IN BROWSER
  console.log('\n--- 5. MEASURING REAL RAF FRAME RATE & TIMING ---');
  const perfPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await perfPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await perfPage.waitForTimeout(1000);

  const fpsMetrics = await perfPage.evaluate(() => {
    return new Promise((resolve) => {
      const deltas = [];
      let lastTime = performance.now();
      let frames = 0;

      function measure(now) {
        const dt = now - lastTime;
        deltas.push(dt);
        lastTime = now;
        frames++;

        if (frames < 60) {
          requestAnimationFrame(measure);
        } else {
          const avgDt = deltas.slice(5).reduce((a, b) => a + b, 0) / (deltas.length - 5);
          const fps = 1000 / avgDt;
          const slowFrames = deltas.filter(d => d > 33.3).length;
          resolve({ fps: Math.round(fps), avgDtMs: Math.round(avgDt * 10) / 10, slowFrames, totalFrames: frames });
        }
      }
      requestAnimationFrame(measure);
    });
  });

  auditResults.fps = fpsMetrics;
  console.log(`Measured Performance: ${fpsMetrics.fps} FPS, Avg frame time: ${fpsMetrics.avgDtMs}ms, Slow frames: ${fpsMetrics.slowFrames}/${fpsMetrics.totalFrames}`);
  await perfPage.close();

  // 6. REDUCED MOTION AUDIT
  console.log('\n--- 6. TESTING REDUCED MOTION ---');
  const rmContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const rmPage = await rmContext.newPage();
  await rmPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await rmPage.waitForTimeout(1000);
  const rmShot = path.join(QA_DIR, 'reduced_motion_landing.png');
  await rmPage.screenshot({ path: rmShot });
  console.log('Tested reduced motion preferences.');
  await rmPage.close();
  await rmContext.close();

  await browser.close();

  fs.writeFileSync(path.join(QA_DIR, 'audit-summary.json'), JSON.stringify(auditResults, null, 2));
  console.log('\n=== AUDIT RUN COMPLETED ===');
  console.log('Results written to:', path.join(QA_DIR, 'audit-summary.json'));
}

runDeepAudit().catch((err) => {
  console.error('Audit run crashed:', err);
  process.exit(1);
});
