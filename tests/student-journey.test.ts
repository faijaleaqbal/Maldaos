/**
 * Phase 3 — Student Experience test suite.
 *
 * Covers:
 *   1. AI triage honesty (deterministic fallback labeling)
 *   2. Evidence image validation (size + MIME)
 *   3. Student dashboard metrics (personal filter, active vs resolved, lifecycle)
 *   4. Notification mapping + read-state behavior
 *
 * Pure logic tests — no live Supabase / network calls.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIService } from '@/services/ai.service';
import { validateImageFile, storageFileName } from '@/services/issues.service';
import {
  mapNotificationRow,
  NOTIFICATION_LABELS,
  NOTIFICATION_TYPES,
  ISSUE_STATUSES,
  STATUS_ORDER,
} from '@/lib/backendTypes';
import { NotificationService } from '@/services/notifications.service';
import type { Issue, NotificationItem, NotificationRow as NotificationRowT } from '@/types';

// ============================================================
// 1. AI TRIAGE — honest fallback & keyword routing
// ============================================================

describe('AIService.generateDeterministicTriage — honest fallback', () => {
  it('always reports isFallback=true and zero confidence (no fake AI claims)', () => {
    const out = AIService.generateDeterministicTriage(
      'Loose bench in lecture hall',
      'Bench wobbles badly during class.',
      'Main Block'
    );
    expect(out.isFallback).toBe(true);
    expect(out.confidence).toBe(0);
    // Provider string must make the heuristic nature explicit
    expect(out.gatewayProvider).toMatch(/heuristic/i);
    expect(out.gatewayProvider).not.toMatch(/^groq$|^nvidia$|^openrouter$|^google$/);
  });

  it('getFallbackAnalysis is also honest', () => {
    const f = AIService.getFallbackAnalysis();
    expect(f.isFallback).toBe(true);
    expect(f.confidence).toBe(0);
  });
});

describe('AIService.generateDeterministicTriage — keyword routing', () => {
  const cases: Array<{ text: string; expectedCategory: string; expectedPriority: string }> = [
    { text: 'Visible sparks from the breaker panel', expectedCategory: 'SAFETY', expectedPriority: 'URGENT' },
    { text: 'Small fire reported in the corridor', expectedCategory: 'SAFETY', expectedPriority: 'URGENT' },
    { text: 'Water leaking from pipe in the washroom', expectedCategory: 'INFRASTRUCTURE', expectedPriority: 'MEDIUM' },
    { text: 'Wire is exposed near the socket', expectedCategory: 'INFRASTRUCTURE', expectedPriority: 'MEDIUM' },
    { text: 'WiFi keeps dropping in the lab', expectedCategory: 'ACADEMICS', expectedPriority: 'MEDIUM' },
    // "lecture" keyword bumps ACADEMICS to HIGH per heuristic
    { text: 'Broken bench in the lecture hall', expectedCategory: 'ACADEMICS', expectedPriority: 'HIGH' },
    // "canteen" keyword bumps CLEANLINESS to HIGH per heuristic
    { text: 'Garbage piled up near the canteen', expectedCategory: 'CLEANLINESS', expectedPriority: 'HIGH' },
    { text: 'Toilet is filthy and smells bad', expectedCategory: 'CLEANLINESS', expectedPriority: 'MEDIUM' },
  ];

  for (const c of cases) {
    it(`"${c.text}" -> ${c.expectedCategory}/${c.expectedPriority}`, () => {
      const out = AIService.generateDeterministicTriage(c.text, c.text, 'Main Block');
      expect(out.detectedCategory).toBe(c.expectedCategory);
      expect(out.suggestedPriority).toBe(c.expectedPriority);
      // heuristic still produces a heuristic provider label
      expect(out.gatewayProvider).toMatch(/heuristic/i);
    });
  }
});

// ============================================================
// 2. EVIDENCE IMAGE VALIDATION
// ============================================================

function makeFile(name: string, type: string, sizeBytes: number): File {
  // jsdom/Node test env — File exists in Node 20+ global.
  const parts = sizeBytes > 0 ? [new Uint8Array(sizeBytes)] : [];
  const blob = new Blob(parts, { type });
  return new File([blob], name, { type });
}

describe('validateImageFile — evidence upload rules', () => {
  it('rejects files larger than 5 MB', () => {
    const sixMb = 6 * 1024 * 1024;
    const f = makeFile('big.jpg', 'image/jpeg', sixMb);
    const err = validateImageFile(f);
    expect(err).not.toBeNull();
    expect(err).toMatch(/5 ?MB/i);
  });

  it('rejects disallowed MIME types (application/pdf, text/plain)', () => {
    const pdf = makeFile('report.pdf', 'application/pdf', 1024);
    const txt = makeFile('notes.txt', 'text/plain', 1024);
    expect(validateImageFile(pdf)).toMatch(/format/i);
    expect(validateImageFile(txt)).toMatch(/format/i);
  });

  it('accepts valid JPEG/PNG/WebP under 5 MB', () => {
    expect(validateImageFile(makeFile('a.jpg', 'image/jpeg', 100 * 1024))).toBeNull();
    expect(validateImageFile(makeFile('b.png', 'image/png', 200 * 1024))).toBeNull();
    expect(validateImageFile(makeFile('c.webp', 'image/webp', 300 * 1024))).toBeNull();
  });

  it('rejects empty (0-byte) files', () => {
    const empty = makeFile('empty.png', 'image/png', 0);
    expect(validateImageFile(empty)).toMatch(/large|empty|under 5/i);
  });

  it('storageFileName always yields a safe jpg/png/webp extension', () => {
    expect(storageFileName('photo.JPG')).toMatch(/\.jpg$/);
    expect(storageFileName('evidence.png')).toMatch(/\.png$/);
    expect(storageFileName('pic.webp')).toMatch(/\.webp$/);
    // Unknown extension falls back to .jpg (no path traversal possible)
    const out = storageFileName('evil.exe');
    expect(out.endsWith('.jpg')).toBe(true);
    expect(out).not.toMatch(/\.\./);
  });
});

// ============================================================
// 3. STUDENT DASHBOARD METRICS
// ============================================================

function makeIssue(over: Partial<Issue> & { id: string; status: Issue['status']; reporter: Issue['reporter'] }): Issue {
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

describe('Student dashboard — personal reports filtering', () => {
  const userId = 'u-alice';
  const userName = 'Alice';
  const issues: Issue[] = [
    makeIssue({ id: 'i1', status: 'OPEN', reporter: { id: userId, name: userName, role: 'STUDENT' } }),
    makeIssue({ id: 'i2', status: 'IN_PROGRESS', reporter: { id: userId, name: userName, role: 'STUDENT' } }),
    makeIssue({ id: 'i3', status: 'RESOLVED', reporter: { id: userId, name: userName, role: 'STUDENT' } }),
    makeIssue({ id: 'i4', status: 'OPEN', reporter: { id: 'u-bob', name: 'Bob', role: 'STUDENT' } }),
    makeIssue({ id: 'i5', status: 'OPEN', reporter: { id: 'u-other', name: 'Other Person', role: 'STUDENT' } }),
  ];

  it('filters reports by reporter id OR name', () => {
    const myReports = issues.filter(
      (i) => i.reporter.id === userId || i.reporter.name === userName
    );
    expect(myReports.map((r) => r.id).sort()).toEqual(['i1', 'i2', 'i3']);
  });
});

describe('Student dashboard — active vs resolved counts', () => {
  const myReports: Issue[] = [
    makeIssue({ id: 'a', status: 'OPEN', reporter: { id: 'u', name: 'u', role: 'STUDENT' } }),
    makeIssue({ id: 'b', status: 'ASSIGNED', reporter: { id: 'u', name: 'u', role: 'STUDENT' } }),
    makeIssue({ id: 'c', status: 'IN_PROGRESS', reporter: { id: 'u', name: 'u', role: 'STUDENT' } }),
    makeIssue({ id: 'd', status: 'RESOLVED', reporter: { id: 'u', name: 'u', role: 'STUDENT' } }),
    makeIssue({ id: 'e', status: 'CLOSED', reporter: { id: 'u', name: 'u', role: 'STUDENT' } }),
  ];

  it('counts active (non-RESOLVED/CLOSED) and resolved (RESOLVED|CLOSED) correctly', () => {
    const active = myReports.filter((i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length;
    const resolved = myReports.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length;
    expect(active).toBe(3);
    expect(resolved).toBe(2);
  });

  it('handles empty personal list', () => {
    const empty: Issue[] = [];
    expect(empty.filter((i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length).toBe(0);
    expect(empty.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length).toBe(0);
  });
});

describe('Issue lifecycle — status ordering', () => {
  it('STATUS_ORDER strictly increases across lifecycle stages', () => {
    const order = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
    expect(order).toEqual([...ISSUE_STATUSES]);
    for (let i = 1; i < order.length; i++) {
      expect(STATUS_ORDER[order[i]]).toBeGreaterThan(STATUS_ORDER[order[i - 1]]);
    }
    expect(STATUS_ORDER.OPEN).toBe(1);
    expect(STATUS_ORDER.CLOSED).toBe(5);
  });

  it('timeline stages can be sorted by STATUS_ORDER regardless of input order', () => {
    const shuffled: Issue['status'][] = ['RESOLVED', 'OPEN', 'CLOSED', 'IN_PROGRESS', 'ASSIGNED'];
    const sorted = [...shuffled].sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b]);
    expect(sorted).toEqual(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
  });
});

// ============================================================
// 4. NOTIFICATIONS — mapping + read state
// ============================================================

const baseRow: NotificationRowT = {
  id: 'n1',
  user_id: 'u-alice',
  issue_id: 'i1',
  type: 'GENERAL',
  payload: {},
  read_at: null,
  created_at: '2026-09-04T12:00:00.000Z',
};

describe('Notification mapping — supports all required types', () => {
  const requiredTypes = ['CAMPUS_ALERT', 'AI_NOTE', 'RESOLVED', 'ASSIGNED', 'STATUS_CHANGE'];

  for (const t of requiredTypes) {
    it(`maps type "${t}" to a NotificationItem without throwing`, () => {
      const item = mapNotificationRow({ ...baseRow, type: t, payload: { status: 'IN_PROGRESS' } }, 'Leaky pipe');
      expect(item.id).toBe('n1');
      expect(item.type).toBe(t);
      expect(item.userId).toBe('u-alice');
      expect(item.createdAt).toBe(baseRow.created_at);
      expect(item.message).toBeTruthy();
      expect(item.title).toContain('Leaky pipe');
    });
  }

  it('marks read=true when read_at is set', () => {
    const read = mapNotificationRow({ ...baseRow, read_at: '2026-09-04T13:00:00.000Z' });
    expect(read.read).toBe(true);
  });

  it('marks read=false when read_at is null', () => {
    const unread = mapNotificationRow({ ...baseRow, read_at: null });
    expect(unread.read).toBe(false);
  });

  it('unknown type still produces a message (never crashes)', () => {
    const item = mapNotificationRow({ ...baseRow, type: 'WHATEVER_NEW_THING' });
    expect(item.message).toBeTruthy();
    // Unknown types are passed through verbatim so the row is never lost
    expect(item.type).toBe('WHATEVER_NEW_THING');
  });

  it('STATUS_CHANGED payload includes the new status in the human message', () => {
    const item = mapNotificationRow(
      { ...baseRow, type: 'STATUS_CHANGED', payload: { status: 'IN_PROGRESS' } },
      'Leaky pipe'
    );
    expect(item.message).toMatch(/In Progress/i);
  });

  it('known DB notification types are all present in NOTIFICATION_TYPES', () => {
    for (const t of ['ISSUE_ASSIGNED', 'STATUS_CHANGED', 'COMMENT_ADDED', 'RESOLVED', 'REOPENED', 'GENERAL']) {
      expect(NOTIFICATION_TYPES).toContain(t as never);
    }
  });

  it('legacy display labels exist for backwards compatibility', () => {
    expect(NOTIFICATION_LABELS.CAMPUS_ALERT).toBeTruthy();
    expect(NOTIFICATION_LABELS.AI_NOTE).toBeTruthy();
    expect(NOTIFICATION_LABELS.STATUS_CHANGE).toBeTruthy();
    expect(NOTIFICATION_LABELS.ASSIGNED).toBeTruthy();
  });
});

describe('NotificationService.markAsRead — read state behavior', () => {
  beforeEach(() => {
    // Force mock mode for deterministic, network-free read state
    process.env.NEXT_PUBLIC_USE_MOCK_DATA = 'true';
    // Seed localStorage with a small list
    const seed: NotificationItem[] = [
      {
        id: 'n1',
        userId: 'u',
        title: 'A',
        message: 'a',
        type: 'GENERAL',
        read: false,
        createdAt: '2026-09-04T10:00:00.000Z',
      },
      {
        id: 'n2',
        userId: 'u',
        title: 'B',
        message: 'b',
        type: 'RESOLVED',
        read: false,
        createdAt: '2026-09-04T11:00:00.000Z',
      },
    ];
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: vi.fn(() => JSON.stringify(seed)),
      setItem: vi.fn((_k: string, v: string) => {
        // Capture writes so we can inspect subsequent state
        (globalThis as { __lastNotifs?: string }).__lastNotifs = v;
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    };
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_USE_MOCK_DATA;
    delete (globalThis as { __lastNotifs?: string }).__lastNotifs;
  });

  it('flips only the requested id to read=true (others remain unread)', async () => {
    const result = await NotificationService.markAsRead('n1');
    const n1 = result.find((n) => n.id === 'n1');
    const n2 = result.find((n) => n.id === 'n2');
    expect(n1?.read).toBe(true);
    expect(n2?.read).toBe(false);
  });

  it('does nothing for a non-existent id (no spurious read state)', async () => {
    const result = await NotificationService.markAsRead('does-not-exist');
    expect(result.every((n) => n.read === false)).toBe(true);
  });
});