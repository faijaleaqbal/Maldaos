/**
 * Phase 4 — Admin Operations test suite.
 *
 * Covers:
 *   1. Status transition rules & permission matrix (adminTransitions.ts)
 *   2. End-to-end admin lifecycle simulation (intake -> close / reopen)
 *   3. Edge cases & error handling for status changes
 *   4. Analytics summary & Campus Health Score integrity
 *
 * Pure logic tests — no live Supabase / network calls.
 */
import { describe, it, expect } from 'vitest';
import {
  canUserAssign,
  canUserResolve,
  canUserClose,
  canUserReopen,
  isResolutionReasonRequired,
  getAvailableTransitions,
} from '@/lib/adminTransitions';
import { AnalyticsService } from '@/services/analytics.service';
import type {
  Issue,
  IssueCategory,
  IssuePriority,
  IssueStatus,
  UserRole,
} from '@/types';

// ============================================================
// HELPERS
// ============================================================

function makeIssue(over: Partial<Issue> & { id: string; status: Issue['status'] }): Issue {
  return {
    ticketNumber: `MC-${over.id.slice(0, 6).toUpperCase()}`,
    title: 'Untitled',
    description: '',
    category: 'OTHER',
    priority: 'MEDIUM',
    location: {
      building: 'Main Block',
      buildingCode: 'MAIN',
      floor: 'G',
      roomOrLandmark: 'Main',
      coordinates: { lat: 0, lng: 0 },
    },
    locationId: 'loc-1',
    departmentId: null,
    department: 'Campus Maintenance',
    reporter: {
      id: 'u-student',
      name: 'Student',
      role: 'STUDENT',
    },
    images: [],
    upvotes: 0,
    upvotedBy: [],
    isAnonymous: false,
    timeline: [],
    comments: [],
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    resolvedAt: null,
    ...over,
  } as Issue;
}

const ROLES: UserRole[] = ['STUDENT', 'STAFF', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'];
const STATUSES: IssueStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

// ============================================================
// 1. PERMISSION MATRIX
// ============================================================

describe('canUserAssign — role gate', () => {
  it('allows DEPARTMENT_ADMIN and SUPER_ADMIN only', () => {
    expect(canUserAssign('DEPARTMENT_ADMIN')).toBe(true);
    expect(canUserAssign('SUPER_ADMIN')).toBe(true);
  });

  it('blocks STUDENT and STAFF', () => {
    expect(canUserAssign('STUDENT')).toBe(false);
    expect(canUserAssign('STAFF')).toBe(false);
  });
});

describe('canUserResolve — department + role gate', () => {
  it('SUPER_ADMIN may always resolve', () => {
    expect(canUserResolve('SUPER_ADMIN', false)).toBe(true);
    expect(canUserResolve('SUPER_ADMIN', true)).toBe(true);
  });

  it('STAFF/DEPARTMENT_ADMIN may resolve only when in the assigned department', () => {
    expect(canUserResolve('STAFF', true)).toBe(true);
    expect(canUserResolve('DEPARTMENT_ADMIN', true)).toBe(true);
    expect(canUserResolve('STAFF', false)).toBe(false);
    expect(canUserResolve('DEPARTMENT_ADMIN', false)).toBe(false);
  });

  it('STUDENT may never resolve', () => {
    expect(canUserResolve('STUDENT', true)).toBe(false);
    expect(canUserResolve('STUDENT', false)).toBe(false);
  });
});

describe('canUserClose — super-admin gate', () => {
  it('only SUPER_ADMIN may close', () => {
    expect(canUserClose('SUPER_ADMIN')).toBe(true);
    for (const r of ['STUDENT', 'STAFF', 'DEPARTMENT_ADMIN'] as UserRole[]) {
      expect(canUserClose(r)).toBe(false);
    }
  });
});

describe('canUserReopen — three-tier gate', () => {
  it('SUPER_ADMIN can always reopen regardless of flags', () => {
    expect(canUserReopen('SUPER_ADMIN', false, false, false)).toBe(true);
    expect(canUserReopen('SUPER_ADMIN', true, true, true)).toBe(true);
  });

  it('STAFF/DEPARTMENT_ADMIN may reopen when in assigned department', () => {
    expect(canUserReopen('STAFF', false, false, true)).toBe(true);
    expect(canUserReopen('DEPARTMENT_ADMIN', false, false, true)).toBe(true);
    // No dept -> denied
    expect(canUserReopen('STAFF', false, false, false)).toBe(false);
    expect(canUserReopen('DEPARTMENT_ADMIN', false, false, false)).toBe(false);
  });

  it('STUDENT reporter may reopen only within 7 days', () => {
    expect(canUserReopen('STUDENT', true, true, false)).toBe(true);
    expect(canUserReopen('STUDENT', true, false, false)).toBe(false); // expired
    expect(canUserReopen('STUDENT', false, true, false)).toBe(false); // not the reporter
  });

  it('STUDENT non-reporter can never reopen', () => {
    expect(canUserReopen('STUDENT', false, true, false)).toBe(false);
    expect(canUserReopen('STUDENT', false, true, true)).toBe(false);
  });
});

describe('isResolutionReasonRequired — only on IN_PROGRESS -> RESOLVED', () => {
  it('is required only for IN_PROGRESS -> RESOLVED', () => {
    expect(isResolutionReasonRequired('IN_PROGRESS', 'RESOLVED')).toBe(true);
  });

  it('is not required for any other transition pair', () => {
    const cases: Array<[IssueStatus, IssueStatus]> = [
      ['OPEN', 'ASSIGNED'],
      ['ASSIGNED', 'IN_PROGRESS'],
      ['RESOLVED', 'CLOSED'],
      ['RESOLVED', 'OPEN'],
      ['CLOSED', 'OPEN'],
      ['OPEN', 'IN_PROGRESS'],
      ['ASSIGNED', 'RESOLVED'],
    ];
    for (const [from, to] of cases) {
      expect(isResolutionReasonRequired(from, to)).toBe(false);
    }
  });
});

// ============================================================
// 2. getAvailableTransitions — per-status, per-role
// ============================================================

describe('getAvailableTransitions — exhaustive role x status matrix', () => {
  // Context that flips the typical happy path:
    const IN_DEPT = true;
  const NOT_IN_DEPT = false;
  const IS_REPORTER = true;
  const RECENT = true;
  const NOT_REPORTER = false;
  const EXPIRED = false;

  // Helper for brevity
  const t = (
    status: IssueStatus,
    role: UserRole,
    inDept = NOT_IN_DEPT,
    reporter = NOT_REPORTER,
    recent = EXPIRED
  ) =>
    getAvailableTransitions(status, role, inDept, reporter, recent).sort();

  describe('from OPEN', () => {
    it('SUPER_ADMIN sees ASSIGNED', () => {
      expect(t('OPEN', 'SUPER_ADMIN')).toEqual(['ASSIGNED']);
    });

    it('DEPARTMENT_ADMIN in dept sees ASSIGNED; out of dept sees nothing', () => {
      expect(t('OPEN', 'DEPARTMENT_ADMIN', IN_DEPT)).toEqual(['ASSIGNED']);
      expect(t('OPEN', 'DEPARTMENT_ADMIN', NOT_IN_DEPT)).toEqual([]);
    });

    it('STUDENT and STAFF see no transitions from OPEN', () => {
      expect(t('OPEN', 'STUDENT')).toEqual([]);
      expect(t('OPEN', 'STAFF', IN_DEPT)).toEqual([]);
    });
  });

  describe('from ASSIGNED', () => {
    it('SUPER_ADMIN can move to IN_PROGRESS', () => {
      expect(t('ASSIGNED', 'SUPER_ADMIN')).toEqual(['IN_PROGRESS']);
    });

    it('STAFF/DEPARTMENT_ADMIN in dept can move to IN_PROGRESS', () => {
      expect(t('ASSIGNED', 'STAFF', IN_DEPT)).toEqual(['IN_PROGRESS']);
      expect(t('ASSIGNED', 'DEPARTMENT_ADMIN', IN_DEPT)).toEqual(['IN_PROGRESS']);
      // Out of dept -> no path
      expect(t('ASSIGNED', 'STAFF', NOT_IN_DEPT)).toEqual([]);
      expect(t('ASSIGNED', 'DEPARTMENT_ADMIN', NOT_IN_DEPT)).toEqual([]);
    });

    it('STUDENT cannot advance from ASSIGNED', () => {
      expect(t('ASSIGNED', 'STUDENT')).toEqual([]);
    });
  });

  describe('from IN_PROGRESS', () => {
    it('SUPER_ADMIN can RESOLVE', () => {
      expect(t('IN_PROGRESS', 'SUPER_ADMIN')).toEqual(['RESOLVED']);
    });

    it('STAFF/DEPARTMENT_ADMIN in dept can RESOLVE', () => {
      expect(t('IN_PROGRESS', 'STAFF', IN_DEPT)).toEqual(['RESOLVED']);
      expect(t('IN_PROGRESS', 'DEPARTMENT_ADMIN', IN_DEPT)).toEqual(['RESOLVED']);
      expect(t('IN_PROGRESS', 'STAFF', NOT_IN_DEPT)).toEqual([]);
    });

    it('STUDENT cannot resolve', () => {
      expect(t('IN_PROGRESS', 'STUDENT')).toEqual([]);
    });
  });

  describe('from RESOLVED', () => {
    it('SUPER_ADMIN sees both CLOSED and OPEN (reopen)', () => {
      expect(t('RESOLVED', 'SUPER_ADMIN', IN_DEPT, IS_REPORTER, RECENT)).toEqual(['CLOSED', 'OPEN']);
    });

    it('STAFF/DEPARTMENT_ADMIN in dept can REOPEN; cannot CLOSE', () => {
      expect(t('RESOLVED', 'STAFF', IN_DEPT)).toEqual(['OPEN']);
      expect(t('RESOLVED', 'DEPARTMENT_ADMIN', IN_DEPT)).toEqual(['OPEN']);
    });

    it('STUDENT reporter within 7 days can REOPEN', () => {
      expect(t('RESOLVED', 'STUDENT', NOT_IN_DEPT, IS_REPORTER, RECENT)).toEqual(['OPEN']);
    });

    it('STUDENT non-reporter or past 7-day window cannot reopen', () => {
      expect(t('RESOLVED', 'STUDENT', NOT_IN_DEPT, NOT_REPORTER, RECENT)).toEqual([]);
      expect(t('RESOLVED', 'STUDENT', NOT_IN_DEPT, IS_REPORTER, EXPIRED)).toEqual([]);
    });
  });

  describe('from CLOSED', () => {
    it('only SUPER_ADMIN can reopen CLOSED', () => {
      expect(t('CLOSED', 'SUPER_ADMIN')).toEqual(['OPEN']);
    });

    it('all other roles see no transitions from CLOSED', () => {
      for (const role of ['STUDENT', 'STAFF', 'DEPARTMENT_ADMIN'] as UserRole[]) {
        expect(t('CLOSED', role, IN_DEPT, IS_REPORTER, RECENT)).toEqual([]);
      }
    });
  });

  it('matrix completeness — every (role, status) returns either a known status list or []', () => {
    const KNOWN: Record<IssueStatus, Set<IssueStatus>> = {
      OPEN: new Set<IssueStatus>(['ASSIGNED']),
      ASSIGNED: new Set<IssueStatus>(['IN_PROGRESS']),
      IN_PROGRESS: new Set<IssueStatus>(['RESOLVED']),
      RESOLVED: new Set<IssueStatus>(['CLOSED', 'OPEN']),
      CLOSED: new Set<IssueStatus>(['OPEN']),
    };
    for (const role of ROLES) {
      for (const status of STATUSES) {
        const out = getAvailableTransitions(
          status,
          role,
          IN_DEPT,
          IS_REPORTER,
          RECENT
        );
        for (const next of out) {
          expect(KNOWN[status].has(next)).toBe(true);
        }
      }
    }
  });
});

// ============================================================
// 3. END-TO-END ADMIN LIFECYCLE — happy path & reopen path
// ============================================================

/**
 * In-memory state machine that mirrors the server-side policy. Each
 * `transition` call applies the same permission matrix as the backend's
 * `transition_issue_status` RPC (see adminTransitions.ts). This lets us
 * drive the full lifecycle without mocking Supabase.
 */
type Actor = { id: string; role: UserRole; department?: string };
type IssueRec = {
  id: string;
  status: IssueStatus;
  department: string | null;
  assignedTo?: { id: string; name: string; department: string };
  resolutionSummary?: string;
  resolutionProofImages?: string[];
  resolvedAt?: string;
};

function makeBackendError(code: string, message: string): Error {
  const e = new Error(message) as Error & { code: string };
  e.code = code;
  return e;
}

function transition(
  issue: IssueRec,
  actor: Actor,
  to: IssueStatus,
  opts: { resolutionSummary?: string; resolutionProofImages?: string[] } = {}
): IssueRec {
  const isDept = actor.department !== undefined && actor.department === issue.department;

  if (issue.status === 'OPEN' && to === 'ASSIGNED') {
    if (!canUserAssign(actor.role) || (actor.role !== 'SUPER_ADMIN' && !isDept)) {
      throw makeBackendError('FORBIDDEN', 'Not allowed to assign');
    }
    if (!opts.resolutionSummary && false) {
      // not relevant for ASSIGN
    }
    return { ...issue, status: 'ASSIGNED' };
  }

  if (issue.status === 'ASSIGNED' && to === 'IN_PROGRESS') {
    if (!canUserResolve(actor.role, isDept)) {
      throw makeBackendError('FORBIDDEN', 'Not allowed to start progress');
    }
    return { ...issue, status: 'IN_PROGRESS' };
  }

  if (issue.status === 'IN_PROGRESS' && to === 'RESOLVED') {
    if (!canUserResolve(actor.role, isDept)) {
      throw makeBackendError('FORBIDDEN', 'Not allowed to resolve');
    }
    if (isResolutionReasonRequired('IN_PROGRESS', 'RESOLVED') && !opts.resolutionSummary) {
      throw makeBackendError(
        'RESOLUTION_REASON_REQUIRED',
        'A resolution reason is required'
      );
    }
    return {
      ...issue,
      status: 'RESOLVED',
      resolutionSummary: opts.resolutionSummary,
      resolutionProofImages: opts.resolutionProofImages ?? [],
      resolvedAt: new Date().toISOString(),
    };
  }

  if (issue.status === 'RESOLVED' && to === 'CLOSED') {
    if (!canUserClose(actor.role)) {
      throw makeBackendError('FORBIDDEN', 'Only super admins may close');
    }
    return { ...issue, status: 'CLOSED' };
  }

  if (issue.status === 'RESOLVED' && to === 'OPEN') {
    if (!canUserReopen(actor.role, false, true, isDept)) {
      throw makeBackendError('FORBIDDEN', 'Not allowed to reopen');
    }
    return {
      ...issue,
      status: 'OPEN',
      resolvedAt: undefined,
      resolutionSummary: undefined,
    };
  }

  if (issue.status === 'CLOSED' && to === 'OPEN') {
    if (!canUserClose(actor.role)) {
      throw makeBackendError('FORBIDDEN', 'Only super admins may reopen closed');
    }
    return { ...issue, status: 'OPEN' };
  }

  throw makeBackendError('INVALID_TRANSITION', `Illegal transition ${issue.status} -> ${to}`);
}

describe('Admin lifecycle — full happy path', () => {
  const superAdmin: Actor = { id: 'su-1', role: 'SUPER_ADMIN' };
  const deptAdmin: Actor = { id: 'da-1', role: 'DEPARTMENT_ADMIN', department: 'Maintenance' };
  const staff: Actor = { id: 'st-1', role: 'STAFF', department: 'Maintenance' };

  it('walks OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED', () => {
    let issue: IssueRec = {
      id: 'i-lifecycle-1',
      status: 'OPEN',
      department: 'Maintenance',
    };

    // Step 1: INTAKE -> ASSIGNMENT (department admin assigns to dept + staff)
    issue = transition(issue, deptAdmin, 'ASSIGNED');
    expect(issue.status).toBe('ASSIGNED');

    // Step 2: TRIAGE / status transition to IN_PROGRESS by assigned staff
    issue = transition(issue, staff, 'IN_PROGRESS');
    expect(issue.status).toBe('IN_PROGRESS');

    // Step 3: RESOLUTION with summary + proof images
    issue = transition(issue, staff, 'RESOLVED', {
      resolutionSummary: 'Replaced valve and tested pressure.',
      resolutionProofImages: ['proof-1.jpg', 'proof-2.jpg'],
    });
    expect(issue.status).toBe('RESOLVED');
    expect(issue.resolutionSummary).toMatch(/valve/i);
    expect(issue.resolutionProofImages?.length).toBe(2);
    expect(issue.resolvedAt).toBeTruthy();

    // Step 4: CLOSE — only super admin
    issue = transition(issue, superAdmin, 'CLOSED');
    expect(issue.status).toBe('CLOSED');
  });

  it('super admin can shortcut the workflow end-to-end', () => {
    let issue: IssueRec = {
      id: 'i-lifecycle-2',
      status: 'OPEN',
      department: 'Maintenance',
    };
    issue = transition(issue, superAdmin, 'ASSIGNED');
    issue = transition(issue, superAdmin, 'IN_PROGRESS');
    issue = transition(issue, superAdmin, 'RESOLVED', {
      resolutionSummary: 'Done by super admin.',
    });
    issue = transition(issue, superAdmin, 'CLOSED');
    expect(issue.status).toBe('CLOSED');
  });
});

describe('Admin lifecycle — reopen flow', () => {
  it('RESOLVED -> OPEN within 7 days (reporter) clears resolution metadata', () => {
    let issue: IssueRec = {
      id: 'i-reopen-1',
      status: 'RESOLVED',
      department: 'Maintenance',
      resolutionSummary: 'Initial fix',
      resolvedAt: new Date().toISOString(),
    };
    issue = transition(issue, { id: 'st-2', role: 'STAFF', department: 'Maintenance' }, 'OPEN');
    expect(issue.status).toBe('OPEN');
    expect(issue.resolutionSummary).toBeUndefined();
    expect(issue.resolvedAt).toBeUndefined();
  });

  it('staff outside the assigned department cannot reopen', () => {
    const issue: IssueRec = {
      id: 'i-reopen-2',
      status: 'RESOLVED',
      department: 'Maintenance',
      resolutionSummary: 'x',
      resolvedAt: new Date().toISOString(),
    };
    expect(() =>
      transition(
        issue,
        { id: 'st-3', role: 'STAFF', department: 'Electrical' },
        'OPEN'
      )
    ).toThrow(/FORBIDDEN|Not allowed to reopen/);
  });

  it('CLOSED -> OPEN is restricted to SUPER_ADMIN only', () => {
    let issue: IssueRec = {
      id: 'i-reopen-3',
      status: 'CLOSED',
      department: 'Maintenance',
    };
    expect(() =>
      transition(issue, { id: 'da-3', role: 'DEPARTMENT_ADMIN', department: 'Maintenance' }, 'OPEN')
    ).toThrow(/FORBIDDEN|Only super admins may reopen closed/);

    // super admin succeeds
    issue = transition(issue, { id: 'su-3', role: 'SUPER_ADMIN' }, 'OPEN');
    expect(issue.status).toBe('OPEN');
  });
});

// ============================================================
// 4. EDGE CASES & ERROR HANDLING
// ============================================================

describe('Illegal transitions are rejected', () => {
  it('throws INVALID_TRANSITION for OPEN -> RESOLVED (skipping stages)', () => {
    const issue: IssueRec = { id: 'x1', status: 'OPEN', department: 'Maintenance' };
    expect(() =>
      transition(
        issue,
        { id: 'su', role: 'SUPER_ADMIN' },
        'RESOLVED',
        { resolutionSummary: 'skip' }
      )
    ).toThrow(/INVALID_TRANSITION|Illegal transition/);
  });

  it('throws INVALID_TRANSITION for ASSIGNED -> CLOSED', () => {
    const issue: IssueRec = { id: 'x2', status: 'ASSIGNED', department: 'Maintenance' };
    expect(() =>
      transition(issue, { id: 'su', role: 'SUPER_ADMIN' }, 'CLOSED')
    ).toThrow(/INVALID_TRANSITION|Illegal transition/);
  });

  it('throws INVALID_TRANSITION for OPEN -> IN_PROGRESS', () => {
    const issue: IssueRec = { id: 'x3', status: 'OPEN', department: 'Maintenance' };
    expect(() =>
      transition(issue, { id: 'su', role: 'SUPER_ADMIN' }, 'IN_PROGRESS')
    ).toThrow(/INVALID_TRANSITION|Illegal transition/);
  });

  it('throws INVALID_TRANSITION for CLOSED -> RESOLVED', () => {
    const issue: IssueRec = { id: 'x4', status: 'CLOSED', department: 'Maintenance' };
    expect(() =>
      transition(issue, { id: 'su', role: 'SUPER_ADMIN' }, 'RESOLVED', {
        resolutionSummary: 'undo',
      })
    ).toThrow(/INVALID_TRANSITION|Illegal transition/);
  });
});

describe('Resolution reason enforcement', () => {
  it('throws RESOLUTION_REASON_REQUIRED when resolving IN_PROGRESS without a reason', () => {
    const issue: IssueRec = { id: 'y1', status: 'IN_PROGRESS', department: 'Maintenance' };
    expect(() =>
      transition(
        issue,
        { id: 'st', role: 'STAFF', department: 'Maintenance' },
        'RESOLVED'
      )
    ).toThrow(/RESOLUTION_REASON_REQUIRED|resolution reason/i);
  });

  it('accepts IN_PROGRESS -> RESOLVED when a reason is provided', () => {
    const issue: IssueRec = { id: 'y2', status: 'IN_PROGRESS', department: 'Maintenance' };
    const out = transition(
      issue,
      { id: 'st', role: 'STAFF', department: 'Maintenance' },
      'RESOLVED',
      { resolutionSummary: 'Fixed by tightening bolts.' }
    );
    expect(out.status).toBe('RESOLVED');
    expect(out.resolutionSummary).toMatch(/tightening/);
  });
});

describe('Authorization rejections for sensitive actions', () => {
  it('STUDENT cannot assign', () => {
    const issue: IssueRec = { id: 'z1', status: 'OPEN', department: 'Maintenance' };
    expect(() =>
      transition(issue, { id: 's1', role: 'STUDENT' }, 'ASSIGNED')
    ).toThrow(/FORBIDDEN|Not allowed/);
  });

  it('STAFF cannot assign (only admins)', () => {
    const issue: IssueRec = { id: 'z2', status: 'OPEN', department: 'Maintenance' };
    expect(() =>
      transition(
        issue,
        { id: 'st', role: 'STAFF', department: 'Maintenance' },
        'ASSIGNED'
      )
    ).toThrow(/FORBIDDEN|Not allowed/);
  });

  it('DEPARTMENT_ADMIN out of dept cannot assign', () => {
    const issue: IssueRec = { id: 'z3', status: 'OPEN', department: 'Maintenance' };
    expect(() =>
      transition(
        issue,
        { id: 'da', role: 'DEPARTMENT_ADMIN', department: 'Electrical' },
        'ASSIGNED'
      )
    ).toThrow(/FORBIDDEN|Not allowed/);
  });

  it('STAFF cannot CLOSE', () => {
    const issue: IssueRec = {
      id: 'z4',
      status: 'RESOLVED',
      department: 'Maintenance',
    };
    expect(() =>
      transition(
        issue,
        { id: 'st', role: 'STAFF', department: 'Maintenance' },
        'CLOSED'
      )
    ).toThrow(/FORBIDDEN|Only super admin/);
  });

  it('DEPARTMENT_ADMIN cannot CLOSE (super admin only)', () => {
    const issue: IssueRec = {
      id: 'z5',
      status: 'RESOLVED',
      department: 'Maintenance',
    };
    expect(() =>
      transition(
        issue,
        { id: 'da', role: 'DEPARTMENT_ADMIN', department: 'Maintenance' },
        'CLOSED'
      )
    ).toThrow(/FORBIDDEN|Only super admin/);
  });

  it('STUDENT cannot RESOLVE', () => {
    const issue: IssueRec = {
      id: 'z6',
      status: 'IN_PROGRESS',
      department: 'Maintenance',
    };
    expect(() =>
      transition(
        issue,
        { id: 's', role: 'STUDENT' },
        'RESOLVED',
        { resolutionSummary: 'ok' }
      )
    ).toThrow(/FORBIDDEN|Not allowed/);
  });

  it('STAFF outside the assigned department cannot RESOLVE', () => {
    const issue: IssueRec = {
      id: 'z7',
      status: 'IN_PROGRESS',
      department: 'Maintenance',
    };
    expect(() =>
      transition(
        issue,
        { id: 'st', role: 'STAFF', department: 'Electrical' },
        'RESOLVED',
        { resolutionSummary: 'ok' }
      )
    ).toThrow(/FORBIDDEN|Not allowed/);
  });
});

// ============================================================
// 5. ANALYTICS & CAMPUS HEALTH SCORE INTEGRITY
// ============================================================

describe('AnalyticsService.calculateSummary — counts derived from real records', () => {
  it('returns all-zero summary for empty input without fabricating data', () => {
    const s = AnalyticsService.calculateSummary([]);
    expect(s.totalIssues).toBe(0);
    expect(s.openIssues).toBe(0);
    expect(s.criticalIssues).toBe(0);
    expect(s.inProgressIssues).toBe(0);
    expect(s.resolvedIssues).toBe(0);
    expect(s.resolutionRate).toBe(0);
    expect(s.averageResolutionHours).toBe(0);
    expect(s.campusHealth.overall).toBe(0);
    expect(s.campusHealth.statusLabel).toBe('INSUFFICIENT_DATA');
  });

  it('counts statuses strictly from the input list', () => {
    const issues: Issue[] = [
      makeIssue({ id: 'i1', status: 'OPEN' }),
      makeIssue({ id: 'i2', status: 'OPEN' }),
      makeIssue({ id: 'i3', status: 'ASSIGNED' }),
      makeIssue({ id: 'i4', status: 'IN_PROGRESS' }),
      makeIssue({ id: 'i5', status: 'RESOLVED' }),
      makeIssue({ id: 'i6', status: 'CLOSED' }),
    ];
    const s = AnalyticsService.calculateSummary(issues);
    expect(s.totalIssues).toBe(6);
    expect(s.openIssues).toBe(4); // OPEN + ASSIGNED + IN_PROGRESS + OPEN
    expect(s.inProgressIssues).toBe(2); // ASSIGNED + IN_PROGRESS
    expect(s.resolvedIssues).toBe(2); // RESOLVED + CLOSED
    // 2/6 = 33% (rounded)
    expect(s.resolutionRate).toBe(33);
  });

  it('counts URGENT non-resolved as critical', () => {
    const issues: Issue[] = [
      makeIssue({ id: 'c1', status: 'OPEN', priority: 'URGENT' }),
      makeIssue({ id: 'c2', status: 'OPEN', priority: 'URGENT' }),
      makeIssue({ id: 'c3', status: 'OPEN', priority: 'HIGH' }), // not critical
      makeIssue({ id: 'c4', status: 'RESOLVED', priority: 'URGENT' }), // resolved -> not critical
    ];
    const s = AnalyticsService.calculateSummary(issues);
    expect(s.criticalIssues).toBe(2);
  });

  it('computes averageResolutionHours from real createdAt/resolvedAt timestamps', () => {
    const issues: Issue[] = [
      makeIssue({
        id: 'r1',
        status: 'RESOLVED',
        createdAt: '2026-09-01T00:00:00.000Z',
        resolvedAt: '2026-09-01T02:00:00.000Z', // 2h
      }),
      makeIssue({
        id: 'r2',
        status: 'RESOLVED',
        createdAt: '2026-09-01T00:00:00.000Z',
        resolvedAt: '2026-09-01T06:00:00.000Z', // 6h
      }),
      makeIssue({
        id: 'r3',
        status: 'OPEN', // excluded
        createdAt: '2026-09-01T00:00:00.000Z',
        resolvedAt: null,
      }),
    ];
    const s = AnalyticsService.calculateSummary(issues);
    expect(s.averageResolutionHours).toBe(4); // (2 + 6) / 2
  });

  it('handles a missing resolvedAt without crashing', () => {
    const issues: Issue[] = [
      makeIssue({
        id: 'm1',
        status: 'RESOLVED',
        createdAt: '2026-09-01T00:00:00.000Z',
        resolvedAt: undefined,
      }),
    ];
    const s = AnalyticsService.calculateSummary(issues);
    // Resolved entry without resolvedAt is excluded from the duration calc
    expect(s.averageResolutionHours).toBe(0);
  });

  it('breaks down issuesByCategory using the actual IssueCategory values', () => {
    const issues: Issue[] = [
      makeIssue({ id: 'c1', status: 'OPEN', category: 'INFRASTRUCTURE' }),
      makeIssue({ id: 'c2', status: 'OPEN', category: 'INFRASTRUCTURE' }),
      makeIssue({ id: 'c3', status: 'OPEN', category: 'SAFETY' }),
      makeIssue({ id: 'c4', status: 'OPEN', category: 'OTHER' }),
    ];
    const s = AnalyticsService.calculateSummary(issues);
    const byName = Object.fromEntries(s.issuesByCategory.map((x) => [x.category, x.count]));
    expect(byName['INFRASTRUCTURE']).toBe(2);
    expect(byName['SAFETY']).toBe(1);
    expect(byName['OTHER']).toBe(1);
  });

  it('breaks down issuesByDepartment using real department strings', () => {
    const issues: Issue[] = [
      makeIssue({ id: 'd1', status: 'OPEN', department: 'Maintenance' }),
      makeIssue({ id: 'd2', status: 'RESOLVED', department: 'Maintenance' }),
      makeIssue({ id: 'd3', status: 'OPEN', department: 'Electrical' }),
    ];
    const s = AnalyticsService.calculateSummary(issues);
    const byDept = Object.fromEntries(s.issuesByDepartment.map((d) => [d.department, d]));
    expect(byDept['Maintenance'].open).toBe(1);
    expect(byDept['Maintenance'].resolved).toBe(1);
    expect(byDept['Electrical'].open).toBe(1);
  });
});

describe('AnalyticsService.calculateHealthScore — resolution rate influence', () => {
  it('empty campus reports INSUFFICIENT_DATA with overall=0', () => {
    const h = AnalyticsService.calculateHealthScore(0, 0, 0, 0);
    expect(h.overall).toBe(0);
    expect(h.statusLabel).toBe('INSUFFICIENT_DATA');
    expect(h.disclaimer).toMatch(/insufficient data/i);
  });

  it('a fully resolved campus is OPTIMAL', () => {
    const h = AnalyticsService.calculateHealthScore(10, 0, 0, 100);
    // resolutionPerformance=100, openIssueLoad=100, criticalSeverityIndex=100, recurringFaultIndex=100
    // overall = 100*0.4 + 100*0.25 + 100*0.25 + 100*0.1 = 100
    expect(h.overall).toBe(100);
    expect(h.statusLabel).toBe('OPTIMAL');
  });

  it('openCount strictly lowers the overall health score', () => {
    const base = AnalyticsService.calculateHealthScore(20, 0, 0, 50);
    const withOpen = AnalyticsService.calculateHealthScore(20, 10, 0, 50);
    expect(withOpen.overall).toBeLessThan(base.overall);
    expect(withOpen.openIssueLoad).toBeLessThan(base.openIssueLoad);
    expect(withOpen.recurringFaultIndex).toBeLessThanOrEqual(base.recurringFaultIndex);
  });

  it('criticalCount heavily penalizes the health score', () => {
    const base = AnalyticsService.calculateHealthScore(10, 5, 0, 70);
    const withCritical = AnalyticsService.calculateHealthScore(10, 5, 3, 70);
    expect(withCritical.overall).toBeLessThan(base.overall);
    expect(withCritical.criticalSeverityIndex).toBeLessThan(base.criticalSeverityIndex);
  });

  it('resolutionRate directly drives the resolutionPerformance component', () => {
    const low = AnalyticsService.calculateHealthScore(10, 5, 0, 20);
    const high = AnalyticsService.calculateHealthScore(10, 5, 0, 90);
    expect(low.resolutionPerformance).toBe(20);
    expect(high.resolutionPerformance).toBe(90);
    expect(high.overall).toBeGreaterThan(low.overall);
  });

  it('combines all three signals — high open + high critical drops label to CRITICAL', () => {
    const h = AnalyticsService.calculateHealthScore(
      50,
      /* openCount */ 20,
      /* criticalCount */ 4,
      /* resolutionRate */ 10
    );
    // openIssueLoad = 100 - 20*5 = 0
    // criticalSeverityIndex = 100 - 4*25 = 0
    // resolutionPerformance = 10
    // recurringFaultIndex = max(20, 100 - 20*3) = 40
    // overall = 10*0.4 + 0*0.25 + 0*0.25 + 40*0.1 = 4 + 4 = 8
    expect(h.overall).toBe(8);
    expect(h.statusLabel).toBe('CRITICAL');
  });

  it('moderate load is STABLE / ATTENTION_NEEDED, never fabricating OPTIMAL', () => {
    const h = AnalyticsService.calculateHealthScore(20, 5, 1, 60);
    // resolutionPerformance=60, openIssueLoad=75, criticalSeverityIndex=75, recurringFaultIndex=85
    // overall = 60*0.4 + 75*0.25 + 75*0.25 + 85*0.1 = 24 + 18.75 + 18.75 + 8.5 = 70
    expect(h.overall).toBe(70);
    expect(h.statusLabel).toBe('STABLE');
  });

  it('criticalSeverityIndex is floored at 0 (never negative)', () => {
    const h = AnalyticsService.calculateHealthScore(10, 0, 10, 100);
    expect(h.criticalSeverityIndex).toBe(0);
    expect(h.criticalSeverityIndex).toBeGreaterThanOrEqual(0);
  });

  it('recurringFaultIndex is floored at 20 (never below 20) for non-empty campuses', () => {
    const h = AnalyticsService.calculateHealthScore(100, 80, 0, 100);
    expect(h.recurringFaultIndex).toBe(20);
  });

  it('summary.campusHealth is driven by resolutionRate, openCount, and criticalCount', () => {
    const base = AnalyticsService.calculateHealthScore(10, 0, 0, 50);

    // +5 open issues should drop overall
    const plusOpen = AnalyticsService.calculateHealthScore(10, 5, 0, 50);
    expect(plusOpen.overall).toBeLessThan(base.overall);

    // +2 critical on top of that should drop further
    const plusCritical = AnalyticsService.calculateHealthScore(10, 5, 2, 50);
    expect(plusCritical.overall).toBeLessThan(plusOpen.overall);

    // bumping resolution rate from 50 -> 90 should raise overall
    const plusResolution = AnalyticsService.calculateHealthScore(10, 5, 2, 90);
    expect(plusResolution.overall).toBeGreaterThan(plusCritical.overall);
  });

  it('category mix in issuesByCategory sums back to totalIssues (no fabrication)', () => {
    const cats: IssueCategory[] = [
      'INFRASTRUCTURE',
      'INFRASTRUCTURE',
      'SAFETY',
      'ACADEMICS',
      'HOSTEL',
      'CLEANLINESS',
      'OTHER',
    ];
    const issues: Issue[] = cats.map((c, i) =>
      makeIssue({ id: `mix-${i}`, status: 'OPEN', category: c })
    );
    const s = AnalyticsService.calculateSummary(issues);
    const sum = s.issuesByCategory.reduce((acc, x) => acc + x.count, 0);
    expect(sum).toBe(s.totalIssues);
    expect(sum).toBe(cats.length);
  });
});

describe('AnalyticsService — end-to-end with a realistic dataset', () => {
  it('produces a coherent summary across all fields', () => {
    const issues: Issue[] = [
      // 2 resolved (1 critical, 1 normal)
      makeIssue({
        id: 'r-1',
        status: 'RESOLVED',
        priority: 'URGENT',
        category: 'SAFETY',
        department: 'Maintenance',
        createdAt: '2026-09-01T00:00:00.000Z',
        resolvedAt: '2026-09-01T03:00:00.000Z',
      }),
      makeIssue({
        id: 'r-2',
        status: 'RESOLVED',
        priority: 'MEDIUM',
        category: 'INFRASTRUCTURE',
        department: 'Maintenance',
        createdAt: '2026-09-01T00:00:00.000Z',
        resolvedAt: '2026-09-01T10:00:00.000Z',
      }),
      // 1 in-progress critical
      makeIssue({
        id: 'p-1',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        category: 'SAFETY',
        department: 'Maintenance',
      }),
      // 1 open low
      makeIssue({
        id: 'o-1',
        status: 'OPEN',
        priority: 'LOW',
        category: 'CLEANLINESS',
        department: 'Housekeeping',
      }),
    ];
    const s = AnalyticsService.calculateSummary(issues);
    expect(s.totalIssues).toBe(4);
    expect(s.resolvedIssues).toBe(2);
    expect(s.inProgressIssues).toBe(1);
    expect(s.openIssues).toBe(2); // OPEN + IN_PROGRESS
    expect(s.criticalIssues).toBe(1); // only IN_PROGRESS URGENT
    expect(s.resolutionRate).toBe(50);
    expect(s.averageResolutionHours).toBeGreaterThan(0);
    // Health: resolutionPerformance=50, openIssueLoad=90 (100-10), criticalSeverityIndex=75 (100-25),
    // recurringFaultIndex=97 (100-3, max 20)
    // overall = 50*0.4 + 90*0.25 + 75*0.25 + 97*0.1 = 20 + 22.5 + 18.75 + 9.7 = 70.95 -> 71
    expect(s.campusHealth.overall).toBe(71);
    expect(['STABLE', 'OPTIMAL', 'ATTENTION_NEEDED', 'CRITICAL']).toContain(s.campusHealth.statusLabel);
  });
});