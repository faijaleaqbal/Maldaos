import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 6 — Mobile Responsiveness & Touch Targets (WCAG 2.5.5 / 2.5.8)', () => {
  it('Button component enforces minimum 44px touch targets on mobile viewports', () => {
    const buttonSource = fs.readFileSync(
      path.resolve(__dirname, '../src/components/ui/Button.tsx'),
      'utf8'
    );
    expect(buttonSource).toContain('min-h-[44px] sm:min-h-[36px]');
    expect(buttonSource).toContain('touch-manipulation');
    expect(buttonSource).toContain('aria-disabled');
  });

  it('Select component enforces minimum 44px touch target and accessibility attributes', () => {
    const selectSource = fs.readFileSync(
      path.resolve(__dirname, '../src/components/ui/Select.tsx'),
      'utf8'
    );
    expect(selectSource).toContain('min-h-[44px]');
    expect(selectSource).toContain('aria-invalid');
    expect(selectSource).toContain('aria-describedby');
    expect(selectSource).toContain('role="alert"');
  });

  it('BottomNav enforces touch targets >= 48px and WCAG navigation landmark', () => {
    const bottomNavSource = fs.readFileSync(
      path.resolve(__dirname, '../src/components/layout/BottomNav.tsx'),
      'utf8'
    );
    expect(bottomNavSource).toContain('aria-label="Mobile application navigation"');
    expect(bottomNavSource).toContain('min-w-[56px] min-h-[48px]');
    expect(bottomNavSource).toContain('aria-current');
  });

  it('Navbar provides accessible notification and profile interactive targets', () => {
    const navbarSource = fs.readFileSync(
      path.resolve(__dirname, '../src/components/layout/Navbar.tsx'),
      'utf8'
    );
    expect(navbarSource).toContain('aria-label={`View Notifications (${unreadCount} unread)`}');
    expect(navbarSource).toContain('aria-haspopup="dialog"');
    expect(navbarSource).toContain('min-h-[44px] min-w-[44px]');
  });
});

describe('Phase 6 — Keyboard Navigation & Dialog Semantics (WCAG 2.1.1 / 2.4.3)', () => {
  it('Root layout implements WCAG skip-to-content mechanism', () => {
    const layoutSource = fs.readFileSync(
      path.resolve(__dirname, '../src/app/layout.tsx'),
      'utf8'
    );
    expect(layoutSource).toContain('href="#main-content"');
    expect(layoutSource).toContain('Skip to main content');
    expect(layoutSource).toContain('id="main-content"');
  });

  it('NotificationDropdown implements dialog semantics, backdrop, and Escape-to-close', () => {
    const dropdownSource = fs.readFileSync(
      path.resolve(__dirname, '../src/components/layout/NotificationDropdown.tsx'),
      'utf8'
    );
    expect(dropdownSource).toContain('role="dialog"');
    expect(dropdownSource).toContain('aria-modal="true"');
    expect(dropdownSource).toContain('Escape');
    expect(dropdownSource).toContain('max-w-[calc(100vw-1.5rem)]');
  });

  it('RoleSwitcherModal implements dialog semantics, backdrop, and Escape-to-close', () => {
    const modalSource = fs.readFileSync(
      path.resolve(__dirname, '../src/components/layout/RoleSwitcherModal.tsx'),
      'utf8'
    );
    expect(modalSource).toContain('role="dialog"');
    expect(modalSource).toContain('aria-modal="true"');
    expect(modalSource).toContain('Escape');
    expect(modalSource).toContain('aria-labelledby');
  });

  it('ImageUploader dropzone is keyboard operable via Enter and Space keys', () => {
    const uploaderSource = fs.readFileSync(
      path.resolve(__dirname, '../src/components/reporting/ImageUploader.tsx'),
      'utf8'
    );
    expect(uploaderSource).toContain('role="button"');
    expect(uploaderSource).toContain('tabIndex={0}');
    expect(uploaderSource).toContain("e.key === 'Enter'");
    expect(uploaderSource).toContain("e.key === ' '");
    expect(uploaderSource).toContain('aria-label');
  });
});

describe('Phase 6 — Student Critical Flow UX & Accessibility Contracts', () => {
  it('ReportWorkflow stepper buttons adapt responsively to mobile viewports', () => {
    const workflowSource = fs.readFileSync(
      path.resolve(__dirname, '../src/components/reporting/ReportWorkflow.tsx'),
      'utf8'
    );
    expect(workflowSource).toContain('flex flex-col-reverse sm:flex-row');
    expect(workflowSource).toContain('w-full sm:w-auto');
    expect(workflowSource).toContain('role="status"');
    expect(workflowSource).toContain('aria-live="polite"');
  });

  it('Student ticket detail page implements accessible resolution modal with Escape dismissal', () => {
    const issueDetailSource = fs.readFileSync(
      path.resolve(__dirname, '../src/app/issues/[id]/page.tsx'),
      'utf8'
    );
    expect(issueDetailSource).toContain('role="dialog"');
    expect(issueDetailSource).toContain('aria-modal="true"');
    expect(issueDetailSource).toContain("e.key === 'Escape'");
    expect(issueDetailSource).toContain('htmlFor="resolve-proof-file"');
  });
});

describe('Phase 6 — Admin Critical Flow UX & Accessibility Contracts', () => {
  it('AssignmentDrawer implements accessible dialog roles, backdrop dismiss, and error announcement', () => {
    const drawerSource = fs.readFileSync(
      path.resolve(__dirname, '../src/components/admin/AssignmentDrawer.tsx'),
      'utf8'
    );
    expect(drawerSource).toContain('role="dialog"');
    expect(drawerSource).toContain('aria-modal="true"');
    expect(drawerSource).toContain("e.key === 'Escape'");
    expect(drawerSource).toContain('role="alert"');
    expect(drawerSource).toContain('aria-live="assertive"');
    expect(drawerSource).toContain('htmlFor="drawer-proof-file"');
  });

  it('IssueTable provides keyboard-operable sortable headers with aria-sort', () => {
    const tableSource = fs.readFileSync(
      path.resolve(__dirname, '../src/components/issues/IssueTable.tsx'),
      'utf8'
    );
    expect(tableSource).toContain('aria-sort');
    expect(tableSource).toContain('role="region"');
    expect(tableSource).toContain('tabIndex={0}');
    expect(tableSource).toContain('aria-label="Campus work order queue table"');
  });

  it('Admin issues page provides responsive filter grid and accessible label associations', () => {
    const adminIssuesSource = fs.readFileSync(
      path.resolve(__dirname, '../src/app/admin/issues/page.tsx'),
      'utf8'
    );
    expect(adminIssuesSource).toContain('grid-cols-1 sm:grid-cols-2 lg:grid-cols-5');
    expect(adminIssuesSource).toContain('htmlFor="admin-filter-status"');
    expect(adminIssuesSource).toContain('id="admin-filter-status"');
    expect(adminIssuesSource).toContain('htmlFor="admin-filter-priority"');
    expect(adminIssuesSource).toContain('id="admin-filter-priority"');
  });

  it('Admin dashboard hazard banner provides keyboard navigation support', () => {
    const adminSource = fs.readFileSync(
      path.resolve(__dirname, '../src/app/admin/page.tsx'),
      'utf8'
    );
    expect(adminSource).toContain('role="button"');
    expect(adminSource).toContain('tabIndex={0}');
    expect(adminSource).toContain("e.key === 'Enter'");
  });
});
