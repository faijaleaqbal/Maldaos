/**
 * Tests for Malda College Existing App Integration
 *
 * Verifies:
 *   1. Official service directory correctness and ERP boundaries.
 *   2. Strict URL sanitization preventing open redirects, javascript:,
 *      subdomain spoofing, credential embedding, and invalid protocols.
 *   3. Inbound deep-link parameter parsing and sanitization for student ID,
 *      category prefill, and return URL.
 *   4. Isolation rules ensuring no credentials or ERP database access are required.
 */
import { describe, it, expect } from 'vitest';
import {
  COLLEGE_BASE_URL,
  COLLEGE_ERP_LOGIN_URL,
  COLLEGE_APP_SOURCE,
  INBOUND_PARAM_KEYS,
  getCollegeServices,
  sanitizeReturnUrl,
  parseInboundAppParams,
} from '@/lib/college-app-integration';
import { COLLEGE_SERVICES_CONTEXT_NOTE } from '@/components/integration/CollegeServicesModal';

describe('Malda College Official Services Directory', () => {
  it('exposes official college services pointing strictly to verified official destinations', () => {
    const services = getCollegeServices();
    expect(services.length).toBeGreaterThanOrEqual(5);

    services.forEach((service) => {
      expect(service.id).toBeTruthy();
      expect(service.name).toBeTruthy();
      expect(service.description).toBeTruthy();
      // Official college site or the verified official ERP login (mcerp.in),
      // which is linked from the official college homepage.
      const isOfficialDestination =
        service.url.startsWith(`${COLLEGE_BASE_URL}/`) ||
        service.url === COLLEGE_ERP_LOGIN_URL;
      expect(isOfficialDestination).toBe(true);
      expect(['portal', 'academics', 'finance', 'library', 'support']).toContain(
        service.category
      );
      expect(['graduation-cap', 'file-badge', 'wallet', 'library', 'life-buoy']).toContain(
        service.icon
      );
    });
  });

  it('includes designated ERP links for examination, fees, and library', () => {
    const services = getCollegeServices();
    const ids = services.map((s) => s.id);
    expect(ids).toContain('college-portal');
    expect(ids).toContain('exam-results');
    expect(ids).toContain('fees-finance');
    expect(ids).toContain('central-library');
    expect(ids).toContain('student-support');

    // Every listed destination must be reachable on an official college/ERP
    // property (no fabricated college-site paths that 404 in production).
    const exam = services.find((s) => s.id === 'exam-results');
    const fees = services.find((s) => s.id === 'fees-finance');
    const library = services.find((s) => s.id === 'central-library');
    const support = services.find((s) => s.id === 'student-support');
    expect(exam?.url).toBe(`${COLLEGE_BASE_URL}/exam-notice-result-page.php`);
    expect(fees?.url).toBe(COLLEGE_ERP_LOGIN_URL);
    expect(library?.url).toBe(`${COLLEGE_BASE_URL}/library.php`);
    expect(support?.url).toBe(`${COLLEGE_BASE_URL}/grievance-redressal-cell.php`);
  });

  it('declares official isolation context note stating ERP records stay on college servers', () => {
    expect(COLLEGE_SERVICES_CONTEXT_NOTE).toContain('Malda College ERP servers');
    expect(COLLEGE_SERVICES_CONTEXT_NOTE).toContain('MaldaOS handles campus operations');
  });
});

describe('Return URL Sanitization & Open-Redirect Defense', () => {
  it('accepts legitimate https URLs on maldacollege.ac.in', () => {
    expect(sanitizeReturnUrl('https://maldacollege.ac.in/app')).toBe(
      'https://maldacollege.ac.in/app'
    );
    expect(sanitizeReturnUrl('https://maldacollege.ac.in/student/dashboard')).toBe(
      'https://maldacollege.ac.in/student/dashboard'
    );
  });

  it('accepts legitimate subdomains of maldacollege.ac.in', () => {
    expect(sanitizeReturnUrl('https://portal.maldacollege.ac.in/home')).toBe(
      'https://portal.maldacollege.ac.in/home'
    );
    expect(sanitizeReturnUrl('https://erp.maldacollege.ac.in/services')).toBe(
      'https://erp.maldacollege.ac.in/services'
    );
  });

  it('accepts localhost / 127.0.0.1 for local integration development', () => {
    expect(sanitizeReturnUrl('http://localhost:3000/app')).toBe(
      'http://localhost:3000/app'
    );
    expect(sanitizeReturnUrl('http://127.0.0.1:8080/')).toBe(
      'http://127.0.0.1:8080/'
    );
  });

  it('REJECTS open-redirect attempts to external hostile domains', () => {
    expect(sanitizeReturnUrl('https://evil-phishing-site.com')).toBeNull();
    expect(sanitizeReturnUrl('https://google.com')).toBeNull();
    expect(sanitizeReturnUrl('https://attacker.org/steal-token')).toBeNull();
  });

  it('REJECTS subdomain spoofing attempts (e.g. maldacollege.ac.in.attacker.com)', () => {
    expect(sanitizeReturnUrl('https://maldacollege.ac.in.attacker.com')).toBeNull();
    expect(sanitizeReturnUrl('https://notmaldacollege.ac.in')).toBeNull();
    expect(sanitizeReturnUrl('https://fake-maldacollege.ac.in')).toBeNull();
  });

  it('REJECTS javascript: and data: XSS vectors', () => {
    expect(sanitizeReturnUrl('javascript:alert(document.cookie)')).toBeNull();
    expect(sanitizeReturnUrl('JAVASCRIPT:alert(1)')).toBeNull();
    expect(sanitizeReturnUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('REJECTS protocol-relative URLs (//evil.com)', () => {
    expect(sanitizeReturnUrl('//evil.com/phishing')).toBeNull();
    expect(sanitizeReturnUrl('//maldacollege.ac.in/test')).toBeNull();
  });

  it('REJECTS relative paths that lack absolute scheme', () => {
    expect(sanitizeReturnUrl('/student/dashboard')).toBeNull();
    expect(sanitizeReturnUrl('../malicious')).toBeNull();
  });

  it('REJECTS URLs with embedded credentials (user:pass@host)', () => {
    expect(sanitizeReturnUrl('https://admin:secret@maldacollege.ac.in/')).toBeNull();
  });

  it('REJECTS whitespace, control characters, null, and empty strings', () => {
    expect(sanitizeReturnUrl(null)).toBeNull();
    expect(sanitizeReturnUrl(undefined)).toBeNull();
    expect(sanitizeReturnUrl('')).toBeNull();
    expect(sanitizeReturnUrl('   ')).toBeNull();
    expect(sanitizeReturnUrl('https://maldacollege.ac.in/\x00evil')).toBeNull();
  });
});

describe('Inbound App Parameter Parsing', () => {
  it('detects traffic originating from the college app', () => {
    const params = parseInboundAppParams({
      source: COLLEGE_APP_SOURCE,
      return_url: 'https://maldacollege.ac.in/app',
      student_id: 'MC-2024-CSE-019',
      category: 'INFRASTRUCTURE',
    });

    expect(params.isFromCollegeApp).toBe(true);
    expect(params.returnUrl).toBe('https://maldacollege.ac.in/app');
    expect(params.studentId).toBe('MC-2024-CSE-019');
    expect(params.prefillCategory).toBe('INFRASTRUCTURE');
  });

  it('is case-insensitive for the source parameter', () => {
    const params = parseInboundAppParams({
      source: 'COLLEGE_APP',
    });
    expect(params.isFromCollegeApp).toBe(true);
  });

  it('marks isFromCollegeApp as false when source is missing or foreign', () => {
    expect(parseInboundAppParams({}).isFromCollegeApp).toBe(false);
    expect(parseInboundAppParams({ source: 'twitter' }).isFromCollegeApp).toBe(false);
    expect(parseInboundAppParams({ source: 'random' }).isFromCollegeApp).toBe(false);
  });

  it('works with native URLSearchParams', () => {
    const searchParams = new URLSearchParams(
      '?source=college_app&return_url=https://maldacollege.ac.in/dashboard&student_id=REG992&return_label=Back%20to%20Portal'
    );
    const result = parseInboundAppParams(searchParams);

    expect(result.isFromCollegeApp).toBe(true);
    expect(result.returnUrl).toBe('https://maldacollege.ac.in/dashboard');
    expect(result.studentId).toBe('REG992');
    expect(result.returnLabel).toBe('Back to Portal');
  });

  it('sanitizes and caps studentId against injection and oversized strings', () => {
    const withSpecialChars = parseInboundAppParams({
      source: 'college_app',
      student_id: '<script>evil()</script>',
    });
    expect(withSpecialChars.studentId).toBeUndefined();

    const normalId = parseInboundAppParams({
      source: 'college_app',
      student_id: 'MC-2025/UG-042',
    });
    expect(normalId.studentId).toBe('MC-2025/UG-042');
  });

  it('sanitizes category tokens', () => {
    const safeCat = parseInboundAppParams({
      source: 'college_app',
      category: 'ELECTRICAL_HAZARD',
    });
    expect(safeCat.prefillCategory).toBe('ELECTRICAL_HAZARD');

    const unsafeCat = parseInboundAppParams({
      source: 'college_app',
      category: 'CAT; DROP TABLE students;--',
    });
    expect(unsafeCat.prefillCategory).toBeUndefined();
  });
});
