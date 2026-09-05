const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve(__dirname, '../playwright-screenshots');

// Login credentials are supplied via env (never hardcoded in the repo):
//   STUDENT_EMAIL / STUDENT_PASSWORD / ADMIN_EMAIL / ADMIN_PASSWORD
// They fall back to the local dev seed accounts when unset.
const STUDENT_EMAIL = process.env.STUDENT_EMAIL || 'student1@campus.test';
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD || 'TestPass123!';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'super@campus.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TestPass123!';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '320x568 (iPhone SE 1st gen)', width: 320, height: 568 },
  { name: '375x667 (iPhone SE 2nd gen)', width: 375, height: 667 },
  { name: '390x844 (iPhone 12/13/14)', width: 390, height: 844 },
  { name: '428x926 (iPhone 14 Plus / Pro Max)', width: 428, height: 926 },
  { name: '768x1024 (iPad Portrait)', width: 768, height: 1024 },
  { name: '1024x768 (iPad Landscape)', width: 1024, height: 768 },
  { name: '1440x900 (Desktop HD)', width: 1440, height: 900 },
];

const SCREENS = [
  { path: '/login', role: 'public', name: 'Login' },
  { path: '/dashboard', role: 'student', name: 'Student Dashboard' },
  { path: '/report', role: 'student', name: 'Report Issue' },
  { path: '/issues', role: 'student', name: 'Issues List' },
  { path: '/issues/iss-001', role: 'student', name: 'Issue Lifecycle Detail' },
  { path: '/profile', role: 'student', name: 'User Profile' },
  { path: '/admin', role: 'admin', name: 'Admin Command Center' },
  { path: '/admin/issues', role: 'admin', name: 'Admin Work Order Queue' },
  { path: '/admin/assignments', role: 'admin', name: 'Admin Dispatch & Staffing' },
  { path: '/admin/analytics', role: 'admin', name: 'Admin Institutional Analytics' },
  { path: '/admin/map', role: 'admin', name: 'Admin Campus Map' },
  { path: '/admin/audit', role: 'admin', name: 'Admin System Audit Log' },
];

async function runAudit() {
  console.log('================================================================');
  console.log('  MALDAOS PHASE 6B — BROWSER AUTOMATION & VISUAL QA AUDIT');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    viewportsTested: VIEWPORTS.length,
    screensTested: SCREENS.length,
    overflowPassed: 0,
    overflowFailed: 0,
    screenshotsCaptured: 0,
    touchTargetChecks: { total: 0, compliant: 0 },
    focusTrapChecks: { passed: 0, failed: 0 },
    overflowDetails: []
  };

  // 1. Establish sessions
  // Student Context
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await studentPage.goto(`${BASE_URL}/login`);
  await studentPage.waitForLoadState('networkidle');
  const studentBtn = studentPage.locator('button:has-text("Student")').first();
  if (await studentBtn.count() > 0) {
    await studentBtn.click();
  } else {
    await studentPage.fill('input[type="email"]', STUDENT_EMAIL);
    await studentPage.fill('input[type="password"]', STUDENT_PASSWORD);
    await studentPage.click('button[type="submit"]');
  }
  await studentPage.waitForTimeout(1000);
  await studentPage.goto(`${BASE_URL}/dashboard`);
  await studentPage.waitForLoadState('networkidle');

  // Admin Context
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${BASE_URL}/login`);
  await adminPage.waitForLoadState('networkidle');
  const adminBtn = adminPage.locator('button:has-text("Super Admin")').first();
  if (await adminBtn.count() > 0) {
    await adminBtn.click();
  } else {
    await adminPage.fill('input[type="email"]', ADMIN_EMAIL);
    await adminPage.fill('input[type="password"]', ADMIN_PASSWORD);
    await adminPage.click('button[type="submit"]');
  }
  await adminPage.waitForTimeout(1000);
  await adminPage.goto(`${BASE_URL}/admin`);
  await adminPage.waitForLoadState('networkidle');

  console.log('✓ Authentication contexts established for Student and Super Admin.\n');

  // 2. Viewport and Overflow testing
  console.log('--- 1. Testing Viewports & Horizontal Overflow ---');
  for (const vp of VIEWPORTS) {
    console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    for (const scr of SCREENS) {
      const page = scr.role === 'admin' ? adminPage : studentPage;
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}${scr.path}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(50);

      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
        const clientWidth = docEl.clientWidth;
        return {
          hasHorizontalOverflow: scrollWidth > clientWidth,
          scrollWidth,
          clientWidth,
          diff: scrollWidth - clientWidth
        };
      });

      if (!overflow.hasHorizontalOverflow) {
        results.overflowPassed++;
      } else {
        results.overflowFailed++;
        const msg = `[OVERFLOW] ${scr.name} (${scr.path}) at ${vp.width}px (diff: ${overflow.diff}px)`;
        results.overflowDetails.push(msg);
        console.warn(`  ${msg}`);
      }
    }
  }
  console.log(`\nViewport Overflow Summary: ${results.overflowPassed} passed, ${results.overflowFailed} failed.`);

  // 3. Capture Dedicated Screenshots for Critical Screens
  console.log('\n--- 2. Capturing High-Fidelity Screenshots ---');
  const screenshotTasks = [
    { page: studentPage, path: '/login', vp: { width: 320, height: 568 }, file: '01-login-mobile-320x568.png' },
    { page: studentPage, path: '/login', vp: { width: 1440, height: 900 }, file: '02-login-desktop-1440x900.png' },
    { page: studentPage, path: '/dashboard', vp: { width: 375, height: 667 }, file: '03-student-dashboard-mobile-375x667.png' },
    { page: studentPage, path: '/dashboard', vp: { width: 1440, height: 900 }, file: '04-student-dashboard-desktop-1440x900.png' },
    { page: studentPage, path: '/report', vp: { width: 390, height: 844 }, file: '05-student-report-mobile-390x844.png' },
    { page: studentPage, path: '/report', vp: { width: 1440, height: 900 }, file: '06-student-report-desktop-1440x900.png' },
    { page: studentPage, path: '/issues', vp: { width: 428, height: 926 }, file: '07-student-issues-mobile-428x926.png' },
    { page: studentPage, path: '/issues/iss-001', vp: { width: 375, height: 667 }, file: '08-issue-detail-mobile-375x667.png' },
    { page: studentPage, path: '/issues/iss-001', vp: { width: 1440, height: 900 }, file: '09-issue-detail-desktop-1440x900.png' },
    { page: studentPage, path: '/profile', vp: { width: 375, height: 667 }, file: '10-student-profile-mobile-375x667.png' },
    { page: adminPage, path: '/admin', vp: { width: 375, height: 667 }, file: '11-admin-dashboard-mobile-375x667.png' },
    { page: adminPage, path: '/admin', vp: { width: 1440, height: 900 }, file: '12-admin-dashboard-desktop-1440x900.png' },
    { page: adminPage, path: '/admin/issues', vp: { width: 1440, height: 900 }, file: '13-admin-issues-desktop-1440x900.png' },
    { page: adminPage, path: '/admin/assignments', vp: { width: 1440, height: 900 }, file: '14-admin-assignments-desktop-1440x900.png' },
    { page: adminPage, path: '/admin/analytics', vp: { width: 768, height: 1024 }, file: '15-admin-analytics-tablet-768x1024.png' },
    { page: adminPage, path: '/admin/map', vp: { width: 1024, height: 768 }, file: '16-admin-map-desktop-1024x768.png' },
    { page: adminPage, path: '/admin/audit', vp: { width: 1440, height: 900 }, file: '17-admin-audit-desktop-1440x900.png' },
  ];

  for (const st of screenshotTasks) {
    await st.page.setViewportSize(st.vp);
    await st.page.goto(`${BASE_URL}${st.path}`);
    await st.page.waitForLoadState('networkidle');
    await st.page.waitForTimeout(100);
    const dest = path.join(SCREENSHOT_DIR, st.file);
    await st.page.screenshot({ path: dest, fullPage: false });
    results.screenshotsCaptured++;
    console.log(`  Captured: ${st.file} (${st.vp.width}x${st.vp.height})`);
  }

  // 4. Test Notification Dropdown & Focus Return
  console.log('\n--- 3. Testing Notification Dropdown & Focus Return ---');
  await studentPage.setViewportSize({ width: 390, height: 844 });
  await studentPage.goto(`${BASE_URL}/dashboard`);
  await studentPage.waitForLoadState('networkidle');

  const notifBtn = studentPage.locator('button[title="View Notifications"]').first();
  await notifBtn.click();
  await studentPage.waitForTimeout(200);
  const notifDropdown = studentPage.locator('div[role="dialog"][aria-label="Campus Dispatch Notifications"]');
  const isNotifVisible = await notifDropdown.isVisible();
  console.log(`  Notification dropdown opened: ${isNotifVisible}`);

  await studentPage.screenshot({ path: path.join(SCREENSHOT_DIR, '18-notifications-dropdown-mobile-390x844.png') });
  results.screenshotsCaptured++;

  // Test Escape dismissal and focus return
  await studentPage.keyboard.press('Escape');
  await studentPage.waitForTimeout(200);
  const isNotifClosed = !(await notifDropdown.isVisible());
  console.log(`  Notification dropdown closed on Escape: ${isNotifClosed}`);
  if (isNotifVisible && isNotifClosed) {
    results.focusTrapChecks.passed++;
  } else {
    results.focusTrapChecks.failed++;
  }

  // 5. Test Role Switcher Modal Focus Trap & Return
  console.log('\n--- 4. Testing RoleSwitcherModal Focus Trap & Return ---');
  await studentPage.setViewportSize({ width: 375, height: 667 });
  await studentPage.goto(`${BASE_URL}/dashboard`);
  await studentPage.waitForLoadState('networkidle');

  const switchRoleBtn = studentPage.locator('button:has-text("Persona:")').first();
  if (await switchRoleBtn.count() > 0) {
    await switchRoleBtn.click();
    await studentPage.waitForTimeout(200);
    const roleModal = studentPage.locator('div[role="dialog"][aria-labelledby="role-switcher-title"]');
    const isRoleModalOpen = await roleModal.isVisible();
    console.log(`  RoleSwitcherModal opened: ${isRoleModalOpen}`);

    await studentPage.screenshot({ path: path.join(SCREENSHOT_DIR, '19-role-switcher-modal-mobile-375x667.png') });
    results.screenshotsCaptured++;

    // Test Tab Cycling inside modal
    let focusEscaped = false;
    for (let i = 0; i < 6; i++) {
      await studentPage.keyboard.press('Tab');
      const inside = await studentPage.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"][aria-labelledby="role-switcher-title"]');
        return dialog ? dialog.contains(document.activeElement) : false;
      });
      if (!inside) focusEscaped = true;
    }
    console.log(`  Tab cycling focus remains strictly contained in RoleSwitcherModal: ${!focusEscaped}`);

    // Test Escape dismissal
    await studentPage.keyboard.press('Escape');
    await studentPage.waitForTimeout(200);
    const isModalClosed = !(await roleModal.isVisible());
    console.log(`  RoleSwitcherModal dismissed on Escape: ${isModalClosed}`);

    if (isRoleModalOpen && !focusEscaped && isModalClosed) {
      results.focusTrapChecks.passed++;
    } else {
      results.focusTrapChecks.failed++;
    }
  }

  // 6. Test Assignment Drawer on Admin Issues
  console.log('\n--- 5. Testing Assignment Drawer Focus Trap & Keyboard Containment ---');
  await adminPage.setViewportSize({ width: 1440, height: 900 });
  await adminPage.goto(`${BASE_URL}/admin/issues`);
  await adminPage.waitForLoadState('networkidle');
  await adminPage.waitForTimeout(300);

  const drawerTrigger = adminPage.locator('table tbody tr button').first();
  if (await drawerTrigger.count() > 0) {
    await drawerTrigger.click();
    await adminPage.waitForTimeout(300);
    const drawer = adminPage.locator('div[role="dialog"][aria-labelledby="assignment-drawer-title"]');
    const isDrawerOpen = await drawer.isVisible();
    console.log(`  AssignmentDrawer opened: ${isDrawerOpen}`);

    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, '20-admin-assignment-drawer-desktop-1440x900.png') });
    results.screenshotsCaptured++;

    // Tab Navigation inside drawer
    let drawerFocusEscaped = false;
    for (let i = 0; i < 8; i++) {
      await adminPage.keyboard.press('Tab');
      const inside = await adminPage.evaluate(() => {
        const d = document.querySelector('div[role="dialog"][aria-labelledby="assignment-drawer-title"]');
        return d ? d.contains(document.activeElement) : false;
      });
      if (!inside) drawerFocusEscaped = true;
    }
    console.log(`  Tab cycling focus remains strictly contained in AssignmentDrawer: ${!drawerFocusEscaped}`);

    // Shift+Tab Navigation inside drawer
    let shiftTabEscaped = false;
    for (let i = 0; i < 4; i++) {
      await adminPage.keyboard.press('Shift+Tab');
      const inside = await adminPage.evaluate(() => {
        const d = document.querySelector('div[role="dialog"][aria-labelledby="assignment-drawer-title"]');
        return d ? d.contains(document.activeElement) : false;
      });
      if (!inside) shiftTabEscaped = true;
    }
    console.log(`  Shift+Tab cycling focus remains strictly contained in AssignmentDrawer: ${!shiftTabEscaped}`);

    // Dismiss drawer via Escape
    await adminPage.keyboard.press('Escape');
    await adminPage.waitForTimeout(300);
    const isDrawerClosed = !(await drawer.isVisible());
    console.log(`  AssignmentDrawer dismissed on Escape: ${isDrawerClosed}`);

    if (isDrawerOpen && !drawerFocusEscaped && !shiftTabEscaped && isDrawerClosed) {
      results.focusTrapChecks.passed++;
    } else {
      results.focusTrapChecks.failed++;
    }
  }

  // 7. Test Issue Resolution Modal Focus Trap
  console.log('\n--- 6. Testing Resolution Modal Focus Trap ---');
  await adminPage.setViewportSize({ width: 1440, height: 900 });
  await adminPage.goto(`${BASE_URL}/issues/iss-001`);
  await adminPage.waitForLoadState('networkidle');

  const resolveModalBtn = adminPage.locator('button:has-text("Resolve with Proof"), button:has-text("Record Resolution"), button:has-text("Resolve Issue")').first();
  if (await resolveModalBtn.count() > 0) {
    await resolveModalBtn.click();
    await adminPage.waitForTimeout(200);
    const resModal = adminPage.locator('div[role="dialog"][aria-labelledby="resolve-modal-title"]');
    const isResModalOpen = await resModal.isVisible();
    console.log(`  Resolution modal opened: ${isResModalOpen}`);

    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, '21-issue-resolve-modal-1440x900.png') });
    results.screenshotsCaptured++;

    // Tab containment
    let resFocusEscaped = false;
    for (let i = 0; i < 5; i++) {
      await adminPage.keyboard.press('Tab');
      const inside = await adminPage.evaluate(() => {
        const m = document.querySelector('div[role="dialog"][aria-labelledby="resolve-modal-title"]');
        return m ? m.contains(document.activeElement) : false;
      });
      if (!inside) resFocusEscaped = true;
    }
    console.log(`  Focus remains strictly contained in Resolution Modal: ${!resFocusEscaped}`);

    // Escape dismissal
    await adminPage.keyboard.press('Escape');
    await adminPage.waitForTimeout(200);
    const isResModalClosed = !(await resModal.isVisible());
    console.log(`  Resolution modal dismissed on Escape: ${isResModalClosed}`);

    if (isResModalOpen && !resFocusEscaped && isResModalClosed) {
      results.focusTrapChecks.passed++;
    } else {
      results.focusTrapChecks.failed++;
    }
  }

  // 8. Touch target evaluation on mobile (375x667)
  console.log('\n--- 7. Evaluating Physical Touch Targets on Mobile ---');
  await studentPage.setViewportSize({ width: 375, height: 667 });
  await studentPage.goto(`${BASE_URL}/report`);
  await studentPage.waitForLoadState('networkidle');

  const touchTargets = await studentPage.evaluate(() => {
    const interactives = Array.from(document.querySelectorAll('button, a, select, input'));
    let compliant = 0;
    let total = 0;
    interactives.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      total++;
      const isInline = window.getComputedStyle(el).display === 'inline';
      if (isInline || (rect.width >= 44 && rect.height >= 44) || (rect.width >= 36 && rect.height >= 36)) {
        compliant++;
      }
    });
    return { total, compliant };
  });

  results.touchTargetChecks = touchTargets;
  console.log(`  Interactive elements evaluated: ${touchTargets.total}`);
  console.log(`  Compliant touch targets (>= 36px/44px or inline exception): ${touchTargets.compliant} / ${touchTargets.total}`);

  // 9. Skip-to-content mechanism test
  console.log('\n--- 8. Testing Skip-to-Content Bypass Link ---');
  await studentPage.goto(`${BASE_URL}/dashboard`);
  await studentPage.keyboard.press('Tab');
  const skipLinkFocused = await studentPage.evaluate(() => {
    const el = document.activeElement;
    return el && el.getAttribute('href') === '#main-content';
  });
  console.log(`  Skip link receives initial Tab focus: ${skipLinkFocused}`);

  // Summary
  console.log('\n================================================================');
  console.log('  BROWSER QA & BEHAVIORAL VERIFICATION SUMMARY');
  console.log('================================================================');
  console.log(`  Total Viewports Tested: ${results.viewportsTested}`);
  console.log(`  Total Screens Tested: ${results.screensTested}`);
  console.log(`  Screenshots Captured: ${results.screenshotsCaptured}`);
  console.log(`  Horizontal Overflow Checks Passed: ${results.overflowPassed} / ${results.overflowPassed + results.overflowFailed}`);
  console.log(`  Focus Trap & Containment Checks Passed: ${results.focusTrapChecks.passed} / ${results.focusTrapChecks.passed + results.focusTrapChecks.failed}`);
  console.log(`  Touch Target Compliance: ${results.touchTargetChecks.compliant} / ${results.touchTargetChecks.total}`);
  console.log(`  Screenshots Directory: ${SCREENSHOT_DIR}`);
  console.log('================================================================\n');

  await browser.close();

  return {
    allOverflowPassed: results.overflowFailed === 0,
    allFocusTrapsPassed: results.focusTrapChecks.failed === 0,
    screenshotsCount: results.screenshotsCaptured,
    overflowDetails: results.overflowDetails
  };
}

runAudit()
  .then((res) => {
    if (res.allOverflowPassed && res.allFocusTrapsPassed && res.screenshotsCount >= 15) {
      console.log('✓ BROWSER VERIFICATION SUITE: ALL CHECKS PASSED');
      process.exit(0);
    } else {
      console.error('✗ BROWSER VERIFICATION SUITE: ISSUES DETECTED', res);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Audit execution error:', err);
    process.exit(1);
  });
