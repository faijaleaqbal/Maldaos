'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { InsightItem } from '@/types';
import {
  Lightbulb,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingUp,
  MapPin,
  ExternalLink,
  Info,
  BarChart3,
  Inbox,
} from 'lucide-react';

interface AdminStats {
  scope?: 'COLLEGE' | 'DEPARTMENT';
  by_status?: Record<string, number>;
  by_category?: Record<string, number>;
  avg_resolution_minutes?: number | null;
}

export default function InsightsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recurring, setRecurring] = useState<InsightItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured()) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Supabase client unavailable.');
        setLoading(false);
        return;
      }
      try {
        const { data, error: e } = await supabase.rpc('admin_stats');
        if (e) throw e;
        if (!cancelled) setStats((data as AdminStats) ?? null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load admin stats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getSeverityBadge = (sev: InsightItem['severity']) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded flex items-center gap-1">
            <Flame className="w-3 h-3 text-rose-600" />
            <span>Critical Intervention</span>
          </span>
        );
      case 'WARNING':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-700" />
            <span>Recurring Warning</span>
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-warm-200 text-ink border border-warm-300 px-2 py-0.5 rounded">
            System Notice
          </span>
        );
    }
  };

  const byCategoryEntries = stats?.by_category
    ? Object.entries(stats.by_category).sort((a, b) => b[1] - a[1])
    : [];
  const byStatusEntries = stats?.by_status
    ? Object.entries(stats.by_status)
    : [];
  const total = byStatusEntries.reduce((a, [, n]) => a + n, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px- lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-warm-300 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="w-4 h-4 text-gold-600" />
          <span className="font-mono text-xs font-semibold text-maroon-900 uppercase tracking-wider">
            System Pattern Intelligence
          </span>
        </div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
          Operational Insights & Recurring Fault Clusters
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          Aggregated from the real <code className="font-mono">admin_stats()</code> RPC. No fabricated telemetry.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-xs text-rose-900">
          <strong className="block font-semibold mb-1">Could not load admin stats</strong>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-warm-300 bg-white p-6 text-xs text-ink-muted">Loading…</div>
      ) : stats ? (
        <>
          {/* Stat cards from real data */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
              <span className="text-xs text-ink-muted uppercase font-semibold block mb-1">Scope</span>
              <span className="font-mono text-2xl font-bold text-ink">{stats.scope ?? '—'}</span>
              <span className="text-[11px] text-ink-muted block mt-1">
                {stats.scope === 'COLLEGE' ? 'All departments' : stats.scope === 'DEPARTMENT' ? 'Your department' : '—'}
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
              <span className="text-xs text-ink-muted uppercase font-semibold block mb-1">Total Issues</span>
              <span className="font-mono text-2xl font-bold text-ink">{total}</span>
              <span className="text-[11px] text-ink-muted block mt-1">Across all statuses</span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
              <span className="text-xs text-ink-muted uppercase font-semibold block mb-1">Avg. Resolution Time</span>
              <span className="font-mono text-2xl font-bold text-ink">
                {stats.avg_resolution_minutes == null
                  ? '—'
                  : `${(stats.avg_resolution_minutes / 60).toFixed(1)} h`}
              </span>
              <span className="text-[11px] text-ink-muted block mt-1">From lodge to verified closure</span>
            </div>
          </div>

          {/* By status / by category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-maroon-700" />
                <h3 className="font-serif font-bold text-base text-ink">By Status</h3>
              </div>
              {byStatusEntries.length === 0 ? (
                <p className="text-xs text-ink-muted">No data yet.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {byStatusEntries.map(([status, n]) => (
                    <li key={status} className="flex items-center justify-between">
                      <span className="font-mono">{status}</span>
                      <span className="font-semibold">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-maroon-700" />
                <h3 className="font-serif font-bold text-base text-ink">By Category</h3>
              </div>
              {byCategoryEntries.length === 0 ? (
                <p className="text-xs text-ink-muted">No data yet.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {byCategoryEntries.map(([cat, n]) => (
                    <li key={cat} className="flex items-center justify-between">
                      <span className="font-mono">{cat}</span>
                      <span className="font-semibold">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recurring patterns from real issues — only when there is data */}
          {recurring.length === 0 && total > 0 ? null : recurring.length === 0 ? (
            <div className="rounded-lg border border-warm-300 bg-white p-6 text-center text-xs text-ink-muted flex flex-col items-center gap-2">
              <Inbox className="w-5 h-5 text-ink-muted" />
              <span>No recurring patterns detected yet. Patterns will appear here as more issues are reported.</span>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-warm-300 bg-white p-6 text-center text-xs text-ink-muted">
          No admin stats available.
        </div>
      )}

      {/* Empty placeholder cards (only when there are recurring patterns) */}
      {recurring.map((insight) => (
        <div
          key={insight.id}
          className="rounded-xl border border-warm-300 bg-white p-5 sm:p-6 shadow-card space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-warm-200 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-maroon-900 bg-maroon-50 px-2 py-0.5 rounded border border-maroon-200">
                  {insight.type.replace('_', ' ')}
                </span>
                <span className="text-xs text-ink-muted font-mono">{insight.detectedDate}</span>
              </div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-ink">{insight.title}</h3>
            </div>
            <div>{getSeverityBadge(insight.severity)}</div>
          </div>
          <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">{insight.description}</p>
          {insight.linkedTickets.length > 0 && (
            <div className="pt-2 border-t border-warm-200 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <span className="font-medium text-ink">Underlying evidence:</span>
              {insight.linkedTickets.map((t) => (
                <Link
                  key={t}
                  href={`/issues?search=${t}`}
                  className="bg-warm-100 hover:bg-warm-200 px-2 py-0.5 rounded border border-warm-300 text-maroon-900 font-semibold transition-colors flex items-center gap-1"
                >
                  <span>{t}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
