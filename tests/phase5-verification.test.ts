import { describe, it, expect } from 'vitest';
import {
  mapLocationRow,
  mapNotificationRow,
  mapIssueRowToViewModel,
  MALDA_CAMPUS_COORDINATES,
  NotificationRow,
  LocationRow,
  IssueRow,
} from '@/lib/backendTypes';
import {
  canUserAssign,
  canUserResolve,
  canUserClose,
  canUserReopen,
  getAvailableTransitions,
} from '@/lib/adminTransitions';
import { isPrivilegedRole, resolveMockMode } from '@/lib/security';
import { AnalyticsService } from '@/services/analytics.service';
import { AIService } from '@/services/ai.service';
import { IssuesService } from '@/services/issues.service';
import { NotificationService } from '@/services/notifications.service';
import { getSeedAccount, isDevSeedLoginAvailable } from '@/services/devSeedAccounts';
import { UserRole, Issue } from '@/types';

describe('Phase 5 — 1. Real Location Data Integrity', () => {
  it('mapLocationRow uses real database latitude and longitude when present', () => {
    const dbLocation: LocationRow = {
      id: 'loc-001',
      name: 'Central Research Facility',
      code: 'CRF',
      latitude: 25.0123,
      longitude: 88.1456,
    };

    const vm = mapLocationRow(dbLocation);
    expect(vm.building).toBe('Central Research Facility');
    expect(vm.buildingCode).toBe('CRF');
    expect(vm.coordinates).toEqual({ lat: 25.0123, lng: 88.1456 });
  });

  it('mapLocationRow only falls back to campus center when DB coordinates are absent', () => {
    const dbLocationWithoutCoords: LocationRow = {
      id: 'loc-002',
      name: 'New Annex Ground',
      code: 'ANNEX',
      latitude: null,
      longitude: null,
    };

    const vm = mapLocationRow(dbLocationWithoutCoords);
    expect(vm.coordinates).toEqual(MALDA_CAMPUS_COORDINATES);
  });

  it('mapIssueRowToViewModel preserves authentic DB location coordinates', () => {
    const rawIssue: IssueRow = {
      id: 'iss-test-01',
      college_id: 'col-01',
      student_id: 'usr-student-01',
      department_id: 'dept-01',
      location_id: 'loc-001',
      title: 'Structural concrete fissure near lab',
      description: 'Active fissure appearing on the ground floor corridor.',
      category: 'INFRASTRUCTURE',
      priority: 'HIGH',
      status: 'OPEN',
      is_anonymous: false,
      resolution_summary: null,
      resolved_at: null,
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
      locations: {
        id: 'loc-001',
        name: 'Central Research Facility',
        code: 'CRF',
        latitude: 25.0123,
        longitude: 88.1456,
      },
    };

    const vm = mapIssueRowToViewModel(rawIssue);
    expect(vm.location.coordinates).toEqual({ lat: 25.0123, lng: 88.1456 });
    expect(vm.location.building).toBe('Central Research Facility');
  });
});

describe('Phase 5 — 2. Notifications DB-Backed & Read State Verification', () => {
  it('accurately derives read boolean from read_at timestamp', () => {
    const unreadRow: NotificationRow = {
      id: 'notif-1',
      user_id: 'user-01',
      issue_id: 'iss-01',
      type: 'STATUS_CHANGED',
      payload: { status: 'IN_PROGRESS' },
      read_at: null,
      created_at: '2026-09-05T01:00:00Z',
    };

    const unreadVM = mapNotificationRow(unreadRow, 'Corridor Lighting Failure');
    expect(unreadVM.read).toBe(false);
    expect(unreadVM.title).toContain('Status Updated');

    const readRow: NotificationRow = {
      ...unreadRow,
      id: 'notif-2',
      read_at: '2026-09-05T02:00:00Z',
    };

    const readVM = mapNotificationRow(readRow, 'Corridor Lighting Failure');
    expect(readVM.read).toBe(true);
  });

  it('fails closed in production: getMockNotifications returns empty array', () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      expect(NotificationService.getMockNotifications()).toEqual([]);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = originalEnv;
    }
  });
});

describe('Phase 5 — 3. Analytics & Campus Health Truthfulness', () => {
  it('computes metrics truthfully from actual database issue timestamps', () => {
    const mockIssues: Issue[] = [
      {
        id: '1',
        ticketNumber: 'MC-2026-0001',
        title: 'Broken window in library',
        description: 'Glass cracked in 2nd floor library reading room',
        category: 'INFRASTRUCTURE',
        priority: 'MEDIUM',
        status: 'RESOLVED',
        location: { building: 'Library', buildingCode: 'LIB', floor: '2', roomOrLandmark: 'Room 201', coordinates: { lat: 25.0089, lng: 88.1402 } },
        reporter: { id: 'usr-1', name: 'Student 1', role: 'STUDENT' },
        department: 'Civil Works',
        images: [],
        upvotes: 0,
        upvotedBy: [],
        isAnonymous: false,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T04:00:00Z',
        resolvedAt: '2026-09-01T04:00:00Z',
        timeline: [],
        comments: [],
      },
      {
        id: '2',
        ticketNumber: 'MC-2026-0002',
        title: 'Exposed live wire',
        description: 'Exposed 220V cable near entrance',
        category: 'SAFETY',
        priority: 'URGENT',
        status: 'OPEN',
        location: { building: 'Main Block', buildingCode: 'MAIN', floor: '1', roomOrLandmark: 'Entrance', coordinates: { lat: 25.0088, lng: 88.1394 } },
        reporter: { id: 'usr-2', name: 'Student 2', role: 'STUDENT' },
        department: 'Electrical',
        images: [],
        upvotes: 3,
        upvotedBy: ['usr-2', 'usr-3', 'usr-4'],
        isAnonymous: false,
        createdAt: '2026-09-02T00:00:00Z',
        updatedAt: '2026-09-02T00:00:00Z',
        timeline: [],
        comments: [],
      },
    ];

    const summary = AnalyticsService.calculateSummary(mockIssues);

    expect(summary.totalIssues).toBe(2);
    expect(summary.resolvedIssues).toBe(1);
    expect(summary.openIssues).toBe(1);
    expect(summary.criticalIssues).toBe(1);
    expect(summary.resolutionRate).toBe(50);
    expect(summary.averageResolutionHours).toBe(4.0);

    const infra = summary.issuesByCategory.find((c) => c.category === 'INFRASTRUCTURE');
    const safety = summary.issuesByCategory.find((c) => c.category === 'SAFETY');
    expect(infra?.count).toBe(1);
    expect(safety?.count).toBe(1);
  });

  it('handles zero issues without inventing numbers or crashing', () => {
    const summary = AnalyticsService.calculateSummary([]);
    expect(summary.totalIssues).toBe(0);
    expect(summary.resolvedIssues).toBe(0);
    expect(summary.openIssues).toBe(0);
    expect(summary.resolutionRate).toBe(0);
    expect(summary.campusHealth.statusLabel).toBe('INSUFFICIENT_DATA');
    expect(summary.campusHealth.overall).toBe(0);
    expect(summary.campusHealth.disclaimer).toContain('Insufficient data');
  });
});

describe('Phase 5 — 4. Runtime Admin Authorization Matrix', () => {
  it('STUDENT is completely denied privileged admin operations', () => {
    expect(isPrivilegedRole('STUDENT')).toBe(false);
    expect(isPrivilegedRole(null)).toBe(false);
    expect(canUserAssign('STUDENT')).toBe(false);
    expect(canUserResolve('STUDENT', false)).toBe(false);
    expect(canUserClose('STUDENT')).toBe(false);
  });

  it('STAFF can work on tickets and resolve within dept, but cannot assign or close', () => {
    expect(isPrivilegedRole('STAFF')).toBe(true);
    expect(canUserAssign('STAFF')).toBe(false);
    expect(canUserResolve('STAFF', true)).toBe(true);
    expect(canUserResolve('STAFF', false)).toBe(false);
    expect(canUserClose('STAFF')).toBe(false);
  });

  it('DEPARTMENT_ADMIN can assign, resolve within dept, but cannot close issues', () => {
    expect(isPrivilegedRole('DEPARTMENT_ADMIN')).toBe(true);
    expect(canUserAssign('DEPARTMENT_ADMIN')).toBe(true);
    expect(canUserResolve('DEPARTMENT_ADMIN', true)).toBe(true);
    expect(canUserResolve('DEPARTMENT_ADMIN', false)).toBe(false);
    expect(canUserClose('DEPARTMENT_ADMIN')).toBe(false);
  });

  it('SUPER_ADMIN has universal clearance: assign anywhere, resolve, close, and view audit trail', () => {
    expect(isPrivilegedRole('SUPER_ADMIN')).toBe(true);
    expect(canUserAssign('SUPER_ADMIN')).toBe(true);
    expect(canUserResolve('SUPER_ADMIN', false)).toBe(true);
    expect(canUserClose('SUPER_ADMIN')).toBe(true);
  });

  it('reopening closed or resolved issues enforces strict authority and student window', () => {
    // Student can reopen if they are the reporter and within resolution window
    expect(canUserReopen('STUDENT', true, true, false)).toBe(true);
    // Student cannot reopen if not the reporter
    expect(canUserReopen('STUDENT', false, true, false)).toBe(false);
    // Student cannot reopen if resolution window expired
    expect(canUserReopen('STUDENT', true, false, false)).toBe(false);
    // Staff/Dept Admin in dept can reopen regardless of student window
    expect(canUserReopen('STAFF', false, false, true)).toBe(true);
    expect(canUserReopen('DEPARTMENT_ADMIN', false, false, true)).toBe(true);
    // Super Admin can always reopen
    expect(canUserReopen('SUPER_ADMIN', false, false, false)).toBe(true);
  });
});

describe('Phase 5 — 5. Mock / Dev Code Isolation in Production', () => {
  it('throws and blocks seed account access in production', () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      expect(() => getSeedAccount('SUPER_ADMIN')).toThrow(/development\/test only/);
      expect(() => getSeedAccount('STUDENT')).toThrow(/development\/test only/);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = originalEnv;
    }
  });

  it('getLocalIssues returns empty array in production (no silent demo issue leak)', () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      expect(IssuesService.getLocalIssues()).toEqual([]);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = originalEnv;
    }
  });

  it('resetToInitialMock throws in production', () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      expect(() => IssuesService.resetToInitialMock()).toThrow(/disabled in production/);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = originalEnv;
    }
  });
});

describe('Phase 5 — 6. AI Gateway Provider & Mapping Integrity', () => {
  it('deterministic heuristic produces zero confidence and is explicitly labelled', () => {
    const analysis = AIService.generateDeterministicTriage(
      'Severe electrical sparking in physics laboratory',
      'Sparks erupting from junction box with smell of ozone',
      'Science Block'
    );

    expect(analysis.isFallback).toBe(true);
    expect(analysis.confidence).toBe(0);
    expect(analysis.detectedCategory).toBe('SAFETY');
    expect(analysis.suggestedPriority).toBe('URGENT');
    expect(analysis.gatewayProvider).toContain('heuristic');
  });

  it('AI fallback analysis never blocks reporting workflow', () => {
    const fallback = AIService.getFallbackAnalysis('Simulated gateway offline');
    expect(fallback.isFallback).toBe(true);
    expect(fallback.confidence).toBe(0);
    expect(fallback.detectedCategory).toBe('OTHER');
    expect(fallback.suggestedPriority).toBe('MEDIUM');
  });
});
