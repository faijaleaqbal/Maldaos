/**
 * Malda College App Integration — Step 3
 *
 * Pure, framework-agnostic helpers that connect MaldaOS (campus operations and
 * incident resolution) with the official Malda College Student App / ERP.
 *
 * Boundary of responsibility:
 *   - Official student records (attendance, marks, fee ledger) live on Malda
 *     College ERP servers. MaldaOS only deep-links to them.
 *   - MaldaOS handles campus operations and issue resolution.
 *
 * Nothing in this module touches `window`, React, or Next.js so that it can be
 * unit-tested in isolation and reused on the server.
 */

export const COLLEGE_BASE_URL = 'https://maldacollege.ac.in';

/** Query parameter names recognised on inbound links from the college app. */
export const INBOUND_PARAM_KEYS = {
  source: 'source',
  returnUrl: 'return_url',
  studentId: 'student_id',
  prefillCategory: 'category',
  returnLabel: 'return_label',
} as const;

/** Value of `source` that identifies traffic coming from the college app. */
export const COLLEGE_APP_SOURCE = 'college_app';

/** Hostnames MaldaOS is allowed to redirect users back to. */
const ALLOWED_RETURN_HOSTS: readonly string[] = [
  'maldacollege.ac.in',
  'localhost',
  '127.0.0.1',
];

export type CollegeServiceCategory =
  | 'portal'
  | 'academics'
  | 'finance'
  | 'library'
  | 'support';

/**
 * Icon identifier resolved to a Lucide icon inside the UI layer. Kept as a
 * string union so this module stays free of React dependencies.
 */
export type CollegeServiceIcon =
  | 'graduation-cap'
  | 'file-badge'
  | 'wallet'
  | 'library'
  | 'life-buoy';

export interface CollegeServiceLink {
  id: string;
  name: string;
  description: string;
  category: CollegeServiceCategory;
  /** Absolute, external http(s) URL — always opened in a new tab. */
  url: string;
  icon: CollegeServiceIcon;
  badge?: string;
}

/** Curated list of official Malda College services surfaced inside MaldaOS. */
export function getCollegeServices(): CollegeServiceLink[] {
  return [
    {
      id: 'college-portal',
      name: 'College Portal',
      description:
        'Official Malda College website — notices, admissions, departments, and institutional announcements.',
      category: 'portal',
      url: `${COLLEGE_BASE_URL}/`,
      icon: 'graduation-cap',
      badge: 'Official',
    },
    {
      id: 'exam-results',
      name: 'Exam & Results',
      description:
        'Examination schedules, admit cards, internal assessment marks, and semester results.',
      category: 'academics',
      url: `${COLLEGE_BASE_URL}/examination`,
      icon: 'file-badge',
    },
    {
      id: 'fees-finance',
      name: 'Fees & Finance',
      description:
        'Online fee payment, fee ledger, scholarship disbursement, and receipts.',
      category: 'finance',
      url: `${COLLEGE_BASE_URL}/fees`,
      icon: 'wallet',
      badge: 'ERP',
    },
    {
      id: 'central-library',
      name: 'Central Library',
      description:
        'Library catalogue (OPAC), e-resources, issue/return status, and reading room timings.',
      category: 'library',
      url: `${COLLEGE_BASE_URL}/library`,
      icon: 'library',
    },
    {
      id: 'student-support',
      name: 'Student Support / Helpdesk',
      description:
        'Grievance cell, anti-ragging committee, counselling, and administrative helpdesk contacts.',
      category: 'support',
      url: `${COLLEGE_BASE_URL}/student-support`,
      icon: 'life-buoy',
    },
  ];
}

function isAllowedReturnHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_RETURN_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

/**
 * Validates a `return_url` supplied by an external caller so it can be used as
 * an `href` without introducing an open-redirect vector.
 *
 * Rules:
 *   - Must be an absolute URL that parses with the WHATWG URL parser.
 *   - Protocol must be `http:` or `https:` (rejects `javascript:`, `data:`,
 *     protocol-relative `//evil.tld`, and relative paths).
 *   - Hostname must be `maldacollege.ac.in` (or a subdomain), `localhost`, or
 *     `127.0.0.1`.
 *   - Embedded credentials (`user:pass@host`) are rejected.
 *
 * Returns the normalised URL string, or `null` when the input is unsafe.
 */
export function sanitizeReturnUrl(url?: string | null): string | null {
  if (typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;

  // Reject control characters / whitespace that some parsers silently strip.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F\s]/.test(trimmed)) return null;

  let parsed: URL;
  try {
    // No base URL: relative inputs (including "//host") must fail to parse.
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (!isAllowedReturnHost(parsed.hostname)) return null;

  return parsed.toString();
}

export interface InboundAppParams {
  isFromCollegeApp: boolean;
  returnUrl: string | null;
  studentId?: string;
  prefillCategory?: string;
  returnLabel?: string;
}

type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function readParam(params: SearchParamsInput, key: string): string | undefined {
  if (params instanceof URLSearchParams) {
    const value = params.get(key);
    return value === null ? undefined : value;
  }
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/** Trim + length-cap a free-text param; strips anything that is not printable. */
function cleanText(value: string | undefined, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001F\u007F<>]/g, '').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLength);
}

/** Student IDs are alphanumeric with optional dashes/slashes, e.g. MC-2024-REG-042. */
function cleanStudentId(value: string | undefined): string | undefined {
  const cleaned = cleanText(value, 64);
  if (!cleaned) return undefined;
  return /^[A-Za-z0-9][A-Za-z0-9\-/_.]*$/.test(cleaned) ? cleaned : undefined;
}

/** Categories are slug-like tokens, e.g. ELECTRICAL or plumbing_leak. */
function cleanCategory(value: string | undefined): string | undefined {
  const cleaned = cleanText(value, 48);
  if (!cleaned) return undefined;
  return /^[A-Za-z0-9_\-]+$/.test(cleaned) ? cleaned : undefined;
}

/**
 * Parses inbound deep-link parameters from the Malda College Student App.
 *
 * Accepts either a `URLSearchParams` (client, `useSearchParams()`) or the
 * plain `searchParams` object Next.js passes to server components.
 *
 * Example inbound link:
 *   /dashboard?source=college_app&return_url=https://maldacollege.ac.in/app
 *              &student_id=MC-2024-REG-042&category=ELECTRICAL
 */
export function parseInboundAppParams(searchParams: SearchParamsInput): InboundAppParams {
  const source = readParam(searchParams, INBOUND_PARAM_KEYS.source);
  const isFromCollegeApp =
    typeof source === 'string' && source.trim().toLowerCase() === COLLEGE_APP_SOURCE;

  const returnUrl = sanitizeReturnUrl(readParam(searchParams, INBOUND_PARAM_KEYS.returnUrl));

  const result: InboundAppParams = { isFromCollegeApp, returnUrl };

  const studentId = cleanStudentId(readParam(searchParams, INBOUND_PARAM_KEYS.studentId));
  if (studentId) result.studentId = studentId;

  const prefillCategory = cleanCategory(
    readParam(searchParams, INBOUND_PARAM_KEYS.prefillCategory)
  );
  if (prefillCategory) result.prefillCategory = prefillCategory;

  const returnLabel = cleanText(readParam(searchParams, INBOUND_PARAM_KEYS.returnLabel), 40);
  if (returnLabel) result.returnLabel = returnLabel;

  return result;
}
