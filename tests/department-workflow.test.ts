/**
 * Stage-5 QA — Department workflow unit tests (pure logic, no network).
 *
 * Covers:
 *   1. normalizeReportType — legacy/unknown rows default to COMPLAINT.
 *   2. mapIssueRowToViewModel — report_type/subcategory passthrough + reviews.
 *   3. mapReviewRow / mapReviewsToTimelineEvents — review VM + timeline events.
 *   4. staffQueueState / adminQueueState / reviewProgressLabel — queue matrix.
 *   5. Regression — 5-state STATUS_TRANSITIONS untouched by the review layer.
 */
import { describe, it, expect } from 'vitest';
import type { Issue, IssueRow, ReportReviewRow } from '@/lib/backendTypes';
import {
  REPORT_TYPES,
  REVIEW_DECISIONS,
  STATUS_TRANSITIONS,
  adminQueueState,
  latestReview,
  mapIssueRowToViewModel,
  mapReviewRow,
  mapReviewsToTimelineEvents,
  normalizeReportType,
  reportTypeLabel,
  reviewProgressLabel,
  staffQueueState,
} from '@/lib/backendTypes';
import type { Issue as IssueVM } from '@/types';

function baseRow(over: Partial<IssueRow> = {}): IssueRow {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    college_id: 'col-1',
    student_id: 'stu-1',
    department_id: 'dept-1',
    location_id: 'loc-1',
    title: 'Fan not working',
    description: 'Ceiling fan in room 204 is dead.',
    category: 'INFRASTRUCTURE',
    priority: 'MEDIUM',
    status: 'OPEN',
    is_anonymous: false,
    resolution_summary: null,
    resolved_at: null,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    ...over,
  } as IssueRow;
}

function reviewRow(over: Partial<ReportReviewRow> = {}): ReportReviewRow {
  return {
    id: 'rev-1',
    issue_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    reviewer_id: 'staff-1',
    stage: 'STAFF_REVIEW',
    decision: 'CONFIRM',
    reason: 'Verified on site, motor is dead.',
    created_at: '2026-09-02T10:00:00.000Z',
    reviewer: { id: 'staff-1', full_name: 'Ravi Staff', role: 'STAFF' },
    ...over,
  };
}

function vm(over: Partial<IssueVM> = {}): IssueVM {
  return {
    id: 'i1',
    ticketNumber: 'MC-ABC123',
    title: 't',
    description: 'd',
    category: 'OTHER',
    priority: 'MEDIUM',
    status: 'OPEN',
    location: {
      building: 'Main',
      buildingCode: 'MAIN',
      floor: 'G',
      roomOrLandmark: 'R1',
      coordinates: { lat: 0, lng: 0 },
    },
    reporter: { id: 'u', name: 'U', role: 'STUDENT' },
    department: 'CSE',
    images: [],
    upvotes: 0,
    upvotedBy: [],
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    timeline: [],
    comments: [],
    reviews: [],
    ...over,
  } as IssueVM;
}

// ============================================================
// 1. normalizeReportType
// ============================================================
describe('normalizeReportType', () => {
  it('passes SUGGESTION through', () => {
    expect(normalizeReportType('SUGGESTION')).toBe('SUGGESTION');
  });
  it('defaults legacy/unknown/null to COMPLAINT', () => {
    expect(normalizeReportType('COMPLAINT')).toBe('COMPLAINT');
    expect(normalizeReportType(null)).toBe('COMPLAINT');
    expect(normalizeReportType(undefined)).toBe('COMPLAINT');
    expect(normalizeReportType('')).toBe('COMPLAINT');
    expect(normalizeReportType('REQUEST')).toBe('COMPLAINT');
  });
  it('REPORT_TYPES carries exactly the two contract values', () => {
    expect([...REPORT_TYPES]).toEqual(['COMPLAINT', 'SUGGESTION']);
  });
  it('REVIEW_DECISIONS carries exactly the five gate-approved decisions', () => {
    expect([...REVIEW_DECISIONS]).toEqual(['CONFIRM', 'REJECT', 'ESCALATE', 'APPROVE', 'RETURN']);
  });
  it('reportTypeLabel covers both kinds', () => {
    expect(reportTypeLabel('COMPLAINT')).toMatch(/complaint/i);
    expect(reportTypeLabel('SUGGESTION')).toMatch(/suggestion/i);
  });
});

// ============================================================
// 2. mapIssueRowToViewModel — report fields
// ============================================================
describe('mapIssueRowToViewModel — report_type/subcategory', () => {
  it('maps SUGGESTION + subcategory onto the VM', () => {
    const out = mapIssueRowToViewModel(
      baseRow({ report_type: 'SUGGESTION', subcategory: 'Lab Improvement' })
    );
    expect(out.reportType).toBe('SUGGESTION');
    expect(out.subcategory).toBe('Lab Improvement');
  });
  it('legacy rows without columns default to COMPLAINT/null', () => {
    const row = baseRow();
    delete (row as { report_type?: unknown }).report_type;
    delete (row as { subcategory?: unknown }).subcategory;
    const out = mapIssueRowToViewModel(row);
    expect(out.reportType).toBe('COMPLAINT');
    expect(out.subcategory).toBeNull();
  });
  it('maps embedded report_reviews onto reviews VM', () => {
    const out = mapIssueRowToViewModel(baseRow({ report_reviews: [reviewRow()] } as Partial<IssueRow>));
    expect(out.reviews?.length).toBe(1);
    expect(out.reviews?.[0].decision).toBe('CONFIRM');
    expect(out.reviews?.[0].reviewerName).toBe('Ravi Staff');
  });
  it('does not alter status/priority/category mapping', () => {
    const out = mapIssueRowToViewModel(baseRow({ status: 'ASSIGNED' }));
    expect(out.status).toBe('ASSIGNED');
    expect(out.reportType).toBe('COMPLAINT');
  });
});

// ============================================================
// 3. mapReviewRow / timeline events
// ============================================================
describe('mapReviewRow + mapReviewsToTimelineEvents', () => {
  it('maps reviewer identity and reason', () => {
    const r = mapReviewRow(reviewRow({ decision: 'REJECT', reason: 'Not our wing.' }));
    expect(r.stage).toBe('STAFF_REVIEW');
    expect(r.decision).toBe('REJECT');
    expect(r.reason).toBe('Not our wing.');
  });
  it('falls back safely on unknown decision literals', () => {
    const r = mapReviewRow(reviewRow({ decision: 'BOGUS' }));
    expect(REVIEW_DECISIONS).toContain(r.decision as never);
  });
  it('emits display-only timeline events anchored at OPEN', () => {
    const evts = mapReviewsToTimelineEvents([
      reviewRow(),
      reviewRow({ id: 'rev-2', stage: 'ADMIN_REVIEW', decision: 'APPROVE', reason: 'Dispatch it.' }),
    ]);
    expect(evts.length).toBe(2);
    expect(evts[0].label).toMatch(/staff review/i);
    expect(evts[1].label).toMatch(/admin decision/i);
    for (const e of evts) expect(e.status).toBe('OPEN');
  });
  it('empty reviews produce no events (timeline unchanged)', () => {
    expect(mapReviewsToTimelineEvents([])).toEqual([]);
  });
});

// ============================================================
// 4. Queue-state matrix
// ============================================================
describe('staffQueueState', () => {
  it('PENDING_REVIEW when no staff review exists', () => {
    expect(staffQueueState(vm())).toBe('PENDING_REVIEW');
  });
  it('CONFIRMED / REJECTED / ESCALATED follow the latest staff decision', () => {
    const mk = (d: 'CONFIRM' | 'REJECT' | 'ESCALATE') =>
      vm({ reviews: [{ id: 'r', issueId: 'i1', reviewerId: 's', stage: 'STAFF_REVIEW', decision: d, reason: 'ok reason here', createdAt: '2026-09-02T10:00:00Z' }] });
    expect(staffQueueState(mk('CONFIRM'))).toBe('CONFIRMED');
    expect(staffQueueState(mk('REJECT'))).toBe('REJECTED');
    expect(staffQueueState(mk('ESCALATE'))).toBe('ESCALATED');
  });
  it('DECIDED once any ADMIN_REVIEW exists; NOT_OPEN off OPEN', () => {
    const decided = vm({
      reviews: [
        { id: 'r1', issueId: 'i1', reviewerId: 's', stage: 'STAFF_REVIEW', decision: 'CONFIRM', reason: 'ok reason here', createdAt: '2026-09-02T10:00:00Z' },
        { id: 'r2', issueId: 'i1', reviewerId: 'h', stage: 'ADMIN_REVIEW', decision: 'APPROVE', reason: 'go ahead now', createdAt: '2026-09-03T10:00:00Z' },
      ],
    });
    expect(staffQueueState(decided)).toBe('DECIDED');
    expect(staffQueueState(vm({ status: 'ASSIGNED' }))).toBe('NOT_OPEN');
  });
  it('latestReview picks the newest same-stage review', () => {
    const issue = vm({
      reviews: [
        { id: 'r1', issueId: 'i1', reviewerId: 's', stage: 'STAFF_REVIEW', decision: 'REJECT', reason: 'first reason', createdAt: '2026-09-02T10:00:00Z' },
        { id: 'r2', issueId: 'i1', reviewerId: 's', stage: 'STAFF_REVIEW', decision: 'CONFIRM', reason: 'second reason', createdAt: '2026-09-03T10:00:00Z' },
      ],
    });
    expect(latestReview(issue, 'STAFF_REVIEW')?.id).toBe('r2');
    expect(staffQueueState(issue)).toBe('CONFIRMED');
  });
});

describe('adminQueueState + reviewProgressLabel', () => {
  const confirm = { id: 'r1', issueId: 'i1', reviewerId: 's', stage: 'STAFF_REVIEW' as const, decision: 'CONFIRM' as const, reason: 'verified reason', createdAt: '2026-09-02T10:00:00Z' };
  it('AWAITING_STAFF before any CONFIRM; AWAITING_ADMIN after', () => {
    expect(adminQueueState(vm())).toBe('AWAITING_STAFF');
    expect(adminQueueState(vm({ reviews: [confirm] }))).toBe('AWAITING_ADMIN');
  });
  it('APPROVED / REJECTED / RETURNED follow the admin decision', () => {
    const mk = (d: 'APPROVE' | 'REJECT' | 'RETURN') =>
      vm({ reviews: [confirm, { id: 'r2', issueId: 'i1', reviewerId: 'h', stage: 'ADMIN_REVIEW', decision: d, reason: 'head reason here', createdAt: '2026-09-03T10:00:00Z' }] });
    expect(adminQueueState(mk('APPROVE'))).toBe('APPROVED');
    expect(adminQueueState(mk('REJECT'))).toBe('REJECTED');
    expect(adminQueueState(mk('RETURN'))).toBe('RETURNED');
  });
  it('NOT_OPEN off OPEN regardless of reviews', () => {
    expect(adminQueueState(vm({ status: 'RESOLVED', reviews: [confirm] }))).toBe('NOT_OPEN');
  });
  it('reviewProgressLabel narrates each gate stage, null off OPEN', () => {
    expect(reviewProgressLabel(vm())).toMatch(/awaiting staff review/i);
    expect(reviewProgressLabel(vm({ reviews: [confirm] }))).toMatch(/awaiting admin approval/i);
    expect(reviewProgressLabel(vm({ status: 'ASSIGNED', reviews: [confirm] }))).toBeNull();
  });
});

// ============================================================
// 5. Lifecycle regression — review layer never extends the machine
// ============================================================
describe('STATUS_TRANSITIONS regression', () => {
  it('5-state machine is exactly the verified contract', () => {
    expect(STATUS_TRANSITIONS).toEqual({
      OPEN: ['ASSIGNED'],
      ASSIGNED: ['IN_PROGRESS'],
      IN_PROGRESS: ['RESOLVED'],
      RESOLVED: ['CLOSED', 'OPEN'],
      CLOSED: ['OPEN'],
    });
  });
  it('no review pseudo-state leaks into the transition map', () => {
    const keys = Object.keys(STATUS_TRANSITIONS);
    for (const bogus of ['STAFF_REVIEW', 'STAFF_CONFIRMED', 'ADMIN_REVIEW', 'COMPLETED', 'DRAFT', 'SUBMITTED']) {
      expect(keys).not.toContain(bogus);
    }
    const vals = Object.values(STATUS_TRANSITIONS).flat();
    for (const bogus of ['STAFF_CONFIRMED', 'ADMIN_APPROVED', 'COMPLETED']) {
      expect(vals).not.toContain(bogus as never);
    }
  });
});
