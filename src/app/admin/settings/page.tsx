'use client';

import React, { useState, useEffect } from 'react';
import { isMockModeEnabled, setMockMode, isSupabaseConfigured } from '@/lib/supabase';
import { isDevSeedLoginAvailable } from '@/services/devSeedAccounts';
import { useIssues } from '@/context/IssuesContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Sliders,
  Database,
  Cpu,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

const SLA_STORAGE_KEY = 'campuspulse_admin_sla_targets';

export default function SettingsPage() {
  const { resetData } = useIssues();
  const [isMock, setIsMock] = useState(isMockModeEnabled());
  const [hasSupabase] = useState(isSupabaseConfigured());
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [slaCritical, setSlaCritical] = useState('1');
  const [slaHigh, setSlaHigh] = useState('4');
  const [slaMedium, setSlaMedium] = useState('24');
  const [slaLow, setSlaLow] = useState('72');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SLA_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.critical) setSlaCritical(parsed.critical);
          if (parsed.high) setSlaHigh(parsed.high);
          if (parsed.medium) setSlaMedium(parsed.medium);
          if (parsed.low) setSlaLow(parsed.low);
        } catch (e) {
          // fallback
        }
      }
    }
  }, []);

  const handleToggleMock = () => {
    const next = !isMock;
    setIsMock(next);
    setMockMode(next);
  };

  const handleSaveSLA = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        SLA_STORAGE_KEY,
        JSON.stringify({
          critical: slaCritical,
          high: slaHigh,
          medium: slaMedium,
          low: slaLow,
        })
      );
    }
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
            MaldaOS is designed with clean service abstraction boundaries. Frontend state is isolated from backend dependencies:
          </p>
          <div className="p-3 bg-warm-50 rounded border border-warm-200 font-mono text-xs space-y-1">
            <div>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configured (Env)' : 'Local Mock Simulated'}</div>
            <div>Supabase Anon Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present (Hidden)' : 'Local Mock Simulated'}</div>
            <div>Database Status: {hasSupabase ? 'PostgreSQL Connection Ready' : 'In-Memory LocalStorage Isolated'}</div>
          </div>
        </div>

        {isDevSeedLoginAvailable() && (
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
        )}
      </div>

      {/* Section 2: AI Gateway Policy */}
      <div className="rounded-xl border border-ai-border bg-ai-surface p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-ai-border pb-3">
          <div className="flex items-center gap-2 text-ai-text">
            <Cpu className="w-4 h-4 text-ai-600" />
            <h3 className="font-serif font-bold text-base text-ai-900">AI Operational Gateway</h3>
          </div>
          <span className="text-xs font-mono bg-ai-100 text-ai-800 font-semibold px-2 py-0.5 rounded border border-ai-border">
            GATEWAY ACTIVE
          </span>
        </div>

        <p className="text-xs text-ink-muted leading-relaxed">
          The AI engine provides non-binding category suggestions, priority weighting, and duplicate detection. No private AI keys are exposed to client browsers. If the external gateway is unreachable, the system automatically runs the deterministic institutional fallback triage.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-white rounded border border-ai-border space-y-0.5">
            <span className="text-[11px] text-ink-muted uppercase font-semibold">Triage Confidence Minimum</span>
            <div className="font-mono font-bold text-ink">80% Threshold</div>
          </div>
          <div className="p-3 bg-white rounded border border-ai-border space-y-0.5">
            <span className="text-[11px] text-ink-muted uppercase font-semibold">Duplicate Matching Sensitivity</span>
            <div className="font-mono font-bold text-ink">40% Cosine Heuristic</div>
          </div>
        </div>
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
              <span className="text-xs text-ink-muted">Operational guidelines for department response times</span>
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
