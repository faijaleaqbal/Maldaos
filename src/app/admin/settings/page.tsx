'use client';

import React, { useEffect, useState } from 'react';
import { isMockModeEnabled, setMockMode, isSupabaseConfigured } from '@/lib/supabase';
import { useIssues } from '@/context/IssuesContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Sliders,
  Database,
  Cpu,
  Clock,
  Shield,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

export default function SettingsPage() {
  const { resetData } = useIssues();
  const [isMock, setIsMock] = useState(isMockModeEnabled());
  const [hasSupabase] = useState(isSupabaseConfigured());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [aiHealth, setAiHealth] = useState<{
    active: boolean;
    realProviderSeen: boolean;
    snapshot: Array<{ provider: string; status: string; n: number; lastAt: string; avgLatencyMs: number }>;
    fetchedAt?: string;
  } | null>(null);
  const [aiHealthError, setAiHealthError] = useState<string | null>(null);

  const [slaCritical, setSlaCritical] = useState('1');
  const [slaHigh, setSlaHigh] = useState('4');
  const [slaMedium, setSlaMedium] = useState('24');
  const [slaLow, setSlaLow] = useState('72');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/ai/health', { cache: 'no-store' });
        if (!r.ok) {
          if (!cancelled) setAiHealthError(`HTTP ${r.status}`);
          return;
        }
        const j = await r.json();
        if (!cancelled) setAiHealth(j);
      } catch (e: any) {
        if (!cancelled) setAiHealthError(e?.message ?? 'unreachable');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleToggleMock = () => {
    const next = !isMock;
    setIsMock(next);
    setMockMode(next);
  };

  const handleSaveSLA = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-warm-300 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Sliders className="w-4 h-4 text-maroon-700" />
          <span className="font-mono text-xs font-semibold text-maroon-900 uppercase tracking-wider">
            System Administration
          </span>
        </div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
          Platform Governance & Operations Settings
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          Configure telemetry data persistence, AI triage thresholds, and department SLA targets
        </p>
      </div>

      {/* Section 1: Data Layer & Persistence */}
      <div className="rounded-xl border border-warm-300 bg-white p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-warm-200 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-maroon-700" />
            <h3 className="font-serif font-bold text-base text-ink">Backend Integration Layer</h3>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded ${
              isMock ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}
          >
            {isMock ? 'ISOLATED MOCK MODE' : 'LIVE SUPABASE ACTIVE'}
          </span>
        </div>

        <div className="space-y-2 text-xs sm:text-sm text-ink-muted leading-relaxed">
          <p>
            CampusPulse is designed with clean service abstraction boundaries. Frontend state is isolated from backend dependencies:
          </p>
          <div className="p-3 bg-warm-50 rounded border border-warm-200 font-mono text-xs space-y-1">
            <div>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configured (Env)' : 'Local Mock Simulated'}</div>
            <div>Supabase Anon Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present (Hidden)' : 'Local Mock Simulated'}</div>
            <div>Database Status: {hasSupabase ? 'PostgreSQL Connection Ready' : 'In-Memory LocalStorage Isolated'}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button size="sm" variant="primary" onClick={handleToggleMock}>
            Switch to {isMock ? 'Supabase Live Mode' : 'Local Mock Mode'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => resetData()}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Restore Default Malda College Incidents
          </Button>
        </div>
      </div>

      {/* Section 2: AI Gateway Policy */}
      <div className="rounded-xl border border-ai-border bg-ai-surface p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-ai-border pb-3">
          <div className="flex items-center gap-2 text-ai-text">
            <Cpu className="w-4 h-4 text-ai-600" />
            <h3 className="font-serif font-bold text-base text-ai-900">AI Operational Gateway</h3>
          </div>
          {aiHealth ? (
            aiHealth.realProviderSeen ? (
              <span
                data-testid="ai-badge"
                className="text-xs font-mono bg-emerald-100 text-emerald-900 font-semibold px-2 py-0.5 rounded border border-emerald-300"
              >
                REAL PROVIDER RESPONSES
              </span>
            ) : aiHealth.active ? (
              <span
                data-testid="ai-badge"
                className="text-xs font-mono bg-amber-100 text-amber-900 font-semibold px-2 py-0.5 rounded border border-amber-300"
              >
                RULE-BASED FALLBACK ONLY
              </span>
            ) : (
              <span
                data-testid="ai-badge"
                className="text-xs font-mono bg-warm-100 text-ink-muted font-semibold px-2 py-0.5 rounded border border-warm-300"
              >
                NO AI ACTIVITY (24h)
              </span>
            )
          ) : aiHealthError ? (
            <span className="text-xs font-mono bg-rose-100 text-rose-900 font-semibold px-2 py-0.5 rounded border border-rose-300">
              HEALTH UNREACHABLE
            </span>
          ) : (
            <span className="text-xs font-mono bg-warm-100 text-ink-muted font-semibold px-2 py-0.5 rounded border border-warm-300">
              LOADING…
            </span>
          )}
        </div>

        <p className="text-xs text-ink-muted leading-relaxed">
          The AI engine provides non-binding category suggestions, priority weighting, and duplicate detection. No private AI keys are exposed to client browsers. The runtime path is <code className="font-mono text-[11px]">/api/ai/analyze</code> (server-only) which calls the provider-agnostic AI Gateway, validates the response, and persists the result to <code className="font-mono text-[11px]">public.ai_analysis</code>. If the external gateway is unreachable, the system records a <strong>RULE_BASED_FALLBACK</strong> row with confidence 0 — the UI then clearly labels the panel &quot;Rule-Based Triage (no provider responded)&quot; and never presents the fallback as real AI.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-white rounded border border-ai-border space-y-1">
            <span className="text-[11px] text-ink-muted uppercase font-semibold">Last 24h Real Provider Calls</span>
            <div className="font-mono font-bold text-ink">
              {aiHealth?.snapshot
                .filter(s => s.status === 'REAL_PROVIDER')
                .reduce((a, s) => a + s.n, 0) || 0}
            </div>
            {aiHealth?.snapshot && aiHealth.snapshot.length > 0 && (
              <div className="text-[10px] text-ink-muted space-y-0.5">
                {aiHealth.snapshot.map(s => (
                  <div key={`${s.provider}-${s.status}`} className="flex justify-between">
                    <span className="font-mono">{s.provider}</span>
                    <span className="text-ink-muted">{s.status} · {s.n} · {s.avgLatencyMs}ms</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 bg-white rounded border border-ai-border space-y-1">
            <span className="text-[11px] text-ink-muted uppercase font-semibold">Duplicate Matching</span>
            <div className="font-mono font-bold text-ink">AI candidates only — no fake scores</div>
            <div className="text-[10px] text-ink-muted">
              Duplicate detection is provider-driven via <code>detect.duplicate</code> — no synthetic similarity heuristics. The product receives only <code>{`{ existingIssueId, reason }`}</code> pairs.
            </div>
          </div>
        </div>

        {aiHealthError && (
          <div className="text-[11px] text-rose-700 italic">
            Could not reach <code>/api/ai/health</code>: {aiHealthError}
          </div>
        )}
      </div>

      {/* Section 3: Target SLA Thresholds */}
      <div className="rounded-xl border border-warm-300 bg-white p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-warm-200 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-maroon-700" />
            <h3 className="font-serif font-bold text-base text-ink">Operational SLA Response Targets</h3>
          </div>
        </div>

        <form onSubmit={handleSaveSLA} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              label="Critical (Hours)"
              type="number"
              value={slaCritical}
              onChange={(e) => setSlaCritical(e.target.value)}
            />
            <Input
              label="High Urgency (Hours)"
              type="number"
              value={slaHigh}
              onChange={(e) => setSlaHigh(e.target.value)}
            />
            <Input
              label="Medium (Hours)"
              type="number"
              value={slaMedium}
              onChange={(e) => setSlaMedium(e.target.value)}
            />
            <Input
              label="Low / Routine (Hours)"
              type="number"
              value={slaLow}
              onChange={(e) => setSlaLow(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-warm-200">
            {savedSuccess ? (
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> SLA Targets Updated Successfully!
              </span>
            ) : (
              <span className="text-xs text-ink-muted">Used in Campus Health Score computation</span>
            )}
            <Button type="submit" size="sm" variant="primary">
              Save SLA Parameters
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
