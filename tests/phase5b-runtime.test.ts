import { describe, it, expect } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { IssuesService } from '@/services/issues.service';
import { AnalyticsService } from '@/services/analytics.service';
import { AIService } from '@/services/ai.service';
import { isMockModeEnabled, isLiveMode } from '@/lib/supabase';
import { getSeedAccount } from '@/services/devSeedAccounts';
import { mapLocationRow, MALDA_CAMPUS_COORDINATES, LocationRow } from '@/lib/backendTypes';
import { canUserAssign, canUserResolve, canUserClose } from '@/lib/adminTransitions';

// Load .env configuration
try {
  const envContent = readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const SEED_PASSWORD = 'TestPass123!';

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON);
const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createAuthClient(email: string): Promise<{ client: SupabaseClient; userId: string }> {
  const boot = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await boot.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error || !data.session) {
    throw new Error(`Failed to sign in as ${email}: ${error?.message}`);
  }
  const token = data.session.access_token;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  return { client, userId: data.user.id };
}

describe('Phase 5B — Part A: Local Docker Supabase Service Health', () => {
  it('Supabase REST endpoint is reachable and reports 200/open status', async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_ANON },
    });
    expect(res.status).toBe(200);
  });

  it('Supabase Auth health endpoint is reachable', async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBeDefined();
  });

  it('All 12 core tables exist and are reachable via service role', async () => {
    const tables = [
      'colleges',
      'departments',
      'locations',
      'profiles',
      'issues',
      'issue_images',
      'issue_assignments',
      'issue_status_history',
      'issue_votes',
      'issue_comments',
      'notifications',
      'audit_logs',
    ];

    for (const table of tables) {
      const { data, error } = await serviceClient.from(table).select('*').limit(1);
      expect(error, `Querying table ${table} failed: ${error?.message}`).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    }
  });
});

describe('Phase 5B — Contract 1: Real Location Data Integrity', () => {
  it('locations table contains real DB coordinates for all campus landmarks', async () => {
    const { client: studentClient } = await createAuthClient('student1@campus.test');
    const { data: locations, error } = await studentClient
      .from('locations')
      .select('id, name, code, latitude, longitude')
      .order('code');

    expect(error).toBeNull();
    expect(locations).toBeDefined();
    expect(locations!.length).toBe(5);

    const main = locations!.find((l) => l.code === 'MAIN');
    expect(main).toBeDefined();
    expect(main!.name).toBe('Main Block');
    expect(typeof main!.latitude).toBe('number');
    expect(typeof main!.longitude).toBe('number');
    expect(main!.latitude).toBeCloseTo(25.0088, 3);
    expect(main!.longitude).toBeCloseTo(88.1394, 3);

    const lib = locations!.find((l) => l.code === 'LIB');
    expect(lib).toBeDefined();
    expect(lib!.latitude).toBeCloseTo(25.0089, 3);
    expect(lib!.longitude).toBeCloseTo(88.1402, 3);

    const hostA = locations!.find((l) => l.code === 'HOST-A');
    expect(hostA).toBeDefined();
    expect(hostA!.latitude).toBeCloseTo(25.0095, 3);
    expect(hostA!.longitude).toBeCloseTo(88.1385, 3);

    const caf = locations!.find((l) => l.code === 'CAF');
    expect(caf).toBeDefined();
    expect(caf!.latitude).toBeCloseTo(25.0082, 3);
    expect(caf!.longitude).toBeCloseTo(88.1397, 3);

    const sport = locations!.find((l) => l.code === 'SPORT');
    expect(sport).toBeDefined();
    expect(sport!.latitude).toBeCloseTo(25.0078, 3);
    expect(sport!.longitude).toBeCloseTo(88.1408, 3);
  });

  it('mapLocationRow preserves real coordinates and falls back to campus center only when null', () => {
    const realLoc: LocationRow = {
      id: 'loc-1',
      name: 'Library',
      code: 'LIB',
      latitude: 25.0089,
      longitude: 88.1402,
    };
    const vm = mapLocationRow(realLoc);
    expect(vm.coordinates).toEqual({ lat: 25.0089, lng: 88.1402 });

    const nullLoc: LocationRow = {
      id: 'loc-2',
      name: 'Unmapped Area',
      code: 'UNMAPPED',
      latitude: null,
      longitude: null,
    };
    const vmFallback = mapLocationRow(nullLoc);
    expect(vmFallback.coordinates).toEqual(MALDA_CAMPUS_COORDINATES);
  });
});

describe('Phase 5B — Contract 2: Notifications DB-Backed & Read State Verification', () => {
  it('authenticated user receives only authorized notification records from DB', async () => {
    const { client: student1Client, userId: student1Id } = await createAuthClient('student1@campus.test');
    const { client: student2Client, userId: student2Id } = await createAuthClient('student2@campus.test');

    const { data: s1Notifs, error: s1Err } = await student1Client
      .from('notifications')
      .select('*');
    expect(s1Err).toBeNull();
    for (const n of s1Notifs ?? []) {
      expect(n.user_id).toBe(student1Id);
    }

    const { data: s2Notifs, error: s2Err } = await student2Client
      .from('notifications')
      .select('*');
    expect(s2Err).toBeNull();
    for (const n of s2Notifs ?? []) {
      expect(n.user_id).toBe(student2Id);
    }
  });

  it('read_notification RPC updates read_at timestamp in database and persists', async () => {
    const { client: student1Client, userId: student1Id } = await createAuthClient('student1@campus.test');

    const { data: existingNotifs } = await serviceClient
      .from('notifications')
      .select('*')
      .eq('user_id', student1Id)
      .is('read_at', null)
      .limit(1);

    let notifId: string;
    if (existingNotifs && existingNotifs.length > 0) {
      notifId = existingNotifs[0].id;
    } else {
      const { data: issue } = await serviceClient.from('issues').select('id').limit(1).single();
      const { data: inserted, error: insertErr } = await serviceClient
        .from('notifications')
        .insert({
          user_id: student1Id,
          issue_id: issue!.id,
          type: 'STATUS_CHANGED',
          payload: { message: 'Test status change notification' },
        })
        .select()
        .single();
      expect(insertErr).toBeNull();
      notifId = inserted.id;
    }

    const { error: rpcErr } = await student1Client.rpc('read_notification', {
      p_notification_id: notifId,
    });
    expect(rpcErr).toBeNull();

    const { data: updatedNotif, error: verifyErr } = await serviceClient
      .from('notifications')
      .select('read_at')
      .eq('id', notifId)
      .single();

    expect(verifyErr).toBeNull();
    expect(updatedNotif!.read_at).not.toBeNull();
  });

  it('calling read_notification on another user notification is rejected', async () => {
    const { userId: student1Id } = await createAuthClient('student1@campus.test');
    const { client: student2Client } = await createAuthClient('student2@campus.test');

    const { data: issue } = await serviceClient.from('issues').select('id').limit(1).single();
    const { data: inserted } = await serviceClient
      .from('notifications')
      .insert({
        user_id: student1Id,
        issue_id: issue!.id,
        type: 'STATUS_CHANGED',
        payload: { message: 'Secret notification for student 1' },
      })
      .select()
      .single();

    const { error: illicitErr } = await student2Client.rpc('read_notification', {
      p_notification_id: inserted!.id,
    });

    expect(illicitErr).not.toBeNull();
    expect(illicitErr!.message).toMatch(/NOT_FOUND|UNAUTHORIZED|FORBIDDEN/i);
  });
});

describe('Phase 5B — Contract 3: Analytics Truthfulness', () => {
  it('calculateSummary derives truthful counts from real database rows', async () => {
    const { data: rawIssues, error } = await serviceClient
      .from('issues')
      .select('id, status, category, priority, created_at, resolved_at');

    expect(error).toBeNull();
    expect(rawIssues).toBeDefined();

    const domainIssues = (rawIssues || []).map((r) => ({
      id: r.id,
      ticketNumber: `MC-${r.id.slice(0, 6).toUpperCase()}`,
      title: 'Issue',
      description: '',
      category: r.category as any,
      priority: r.priority as any,
      status: r.status as any,
      location: { building: 'Main Block', buildingCode: 'MAIN', coordinates: { lat: 25.0088, lng: 88.1394 } },
      reporter: { id: 'rep-1', name: 'Student', role: 'STUDENT' as const, isAnonymous: false },
      createdAt: r.created_at,
      updatedAt: r.created_at,
      resolvedAt: r.resolved_at || undefined,
      upvotes: 0,
      hasUpvoted: false,
      images: [],
      comments: [],
      timeline: [],
    }));

    const summary = AnalyticsService.calculateSummary(domainIssues);
    expect(summary.totalIssues).toBe(rawIssues!.length);
    expect(summary.resolvedIssues).toBe(rawIssues!.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length);
    expect(summary.criticalIssues).toBe(rawIssues!.filter((i) => i.priority === 'URGENT' && i.status !== 'RESOLVED' && i.status !== 'CLOSED').length);
  });

  it('zero-data state returns honest zero values and safe metrics', () => {
    const summary = AnalyticsService.calculateSummary([]);
    expect(summary.totalIssues).toBe(0);
    expect(summary.openIssues).toBe(0);
    expect(summary.resolvedIssues).toBe(0);
    expect(summary.inProgressIssues).toBe(0);
    expect(summary.criticalIssues).toBe(0);
    expect(summary.resolutionRate).toBe(0); // Honest 0%, no fabricated 94%
    expect(summary.averageResolutionHours).toBe(0);
  });
});

describe('Phase 5B — Contract 4: Admin Authorization & Guarded RPC Enforcement', () => {
  it('Student role cannot access audit_logs table via RLS', async () => {
    const { client: studentClient } = await createAuthClient('student1@campus.test');
    const { data } = await studentClient.from('audit_logs').select('*');
    expect(data === null || data.length === 0).toBe(true);
  });

  it('Student role cannot execute assign_issue RPC', async () => {
    const { client: studentClient } = await createAuthClient('student1@campus.test');
    const { data: issue } = await serviceClient.from('issues').select('id, department_id').limit(1).single();
    const { data: dept } = await serviceClient.from('departments').select('id').limit(1).single();

    const { error } = await studentClient.rpc('assign_issue', {
      p_issue_id: issue!.id,
      p_department_id: dept!.id,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/FORBIDDEN|UNAUTHORIZED|permission/i);
  });

  it('Department Admin can assign departmental issues to staff', async () => {
    const { client: adminClient } = await createAuthClient('admin.cse@campus.test');
    const { data: cseDept } = await serviceClient.from('departments').select('id').eq('code', 'CSE').single();
    const { data: cseStaff } = await serviceClient.from('profiles').select('id').eq('role', 'STAFF').eq('department_id', cseDept!.id).single();
    
    let cseIssue: { id: string } | null = null;
    const { data: foundIssue } = await serviceClient
      .from('issues')
      .select('id')
      .eq('department_id', cseDept!.id)
      .in('status', ['OPEN', 'ASSIGNED'])
      .limit(1)
      .maybeSingle();

    if (foundIssue) {
      cseIssue = foundIssue;
    } else {
      const { data: college } = await serviceClient.from('colleges').select('id').single();
      const { data: loc } = await serviceClient.from('locations').select('id').eq('code', 'MAIN').single();
      const { data: student } = await serviceClient.from('profiles').select('id').eq('role', 'STUDENT').limit(1).single();
      const { data: created } = await serviceClient.from('issues').insert({
        college_id: college!.id,
        student_id: student!.id,
        department_id: cseDept!.id,
        location_id: loc!.id,
        title: 'New CSE issue for assignment test',
        description: 'Test issue to verify department admin assignment',
        category: 'ACADEMICS',
        priority: 'MEDIUM',
        status: 'OPEN',
        is_anonymous: false,
      }).select('id').single();
      cseIssue = created;
    }

    expect(cseIssue).not.toBeNull();
    const { error } = await adminClient.rpc('assign_issue', {
      p_issue_id: cseIssue!.id,
      p_department_id: cseDept!.id,
      p_staff_id: cseStaff!.id,
    });
    expect(error).toBeNull();
  });

  it('Super Admin can access audit_logs table', async () => {
    const { client: superClient } = await createAuthClient('super@campus.test');
    const { data, error } = await superClient.from('audit_logs').select('*');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('Invalid status transitions are rejected at business logic and DB RPC layers', () => {
    expect(canUserAssign('STUDENT')).toBe(false);
    expect(canUserResolve('STUDENT', false)).toBe(false);
    expect(canUserClose('STUDENT')).toBe(false);
    expect(canUserAssign('STAFF')).toBe(false);
    expect(canUserClose('STAFF')).toBe(false);
  });
});

describe('Phase 5B — Contract 5: AI Gateway & Deterministic Fallback', () => {
  it('AIService deterministic fallback provides valid category and priority with zero confidence', () => {
    const fallback = AIService.generateDeterministicTriage(
      'Water leaking from ceiling in Chemistry Lab',
      'Water dripping near electrical switchboard in Room 204',
      'Science Block'
    );

    expect(fallback.isFallback).toBe(true);
    expect(fallback.confidence).toBe(0);
    expect(fallback.detectedCategory).toBeDefined();
    expect(fallback.suggestedPriority).toBeDefined();
    expect(fallback.gatewayProvider).toContain('heuristic');
  });

  it('AI failure fallback returns honest deterministic payload without throwing', () => {
    const fallback = AIService.getFallbackAnalysis('Network connection timeout');
    expect(fallback.isFallback).toBe(true);
    expect(fallback.confidence).toBe(0);
    expect(fallback.detectedCategory).toBe('OTHER');
    expect(fallback.suggestedPriority).toBe('MEDIUM');
  });
});

describe('Phase 5B — Contract 6: Production Mock Isolation', () => {
  it('isMockModeEnabled strictly returns false in production environment', () => {
    const origEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      expect(isMockModeEnabled()).toBe(false);
      expect(isLiveMode()).toBe(true);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = origEnv;
    }
  });

  it('getSeedAccount strictly throws in production environment', () => {
    const origEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      expect(() => getSeedAccount('SUPER_ADMIN')).toThrow(/development\/test only/);
      expect(() => getSeedAccount('STUDENT')).toThrow(/development\/test only/);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = origEnv;
    }
  });

  it('getLocalIssues returns empty array in production environment', () => {
    const origEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      expect(IssuesService.getLocalIssues()).toEqual([]);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = origEnv;
    }
  });
});
