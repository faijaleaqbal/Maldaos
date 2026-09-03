'use client';

import React from 'react';
import { ReportWorkflow } from '@/components/reporting/ReportWorkflow';
import { ShieldCheck, PhoneCall, HelpCircle } from 'lucide-react';

export default function ReportIssuePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Editorial Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 bg-maroon-50 border border-maroon-200 text-maroon-900 px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-maroon-700" />
          <span>Malda College Official Reporting Registry</span>
        </div>
        <h1 className="font-serif font-bold text-2xl sm:text-4xl text-ink">
          Lodge a Campus Facility Issue
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted leading-relaxed font-sans">
          Complete the 5-step incident form below. Our automated triage evaluates urgency, notifies the concerned departmental cell, and provides you with a real-time tracking ticket.
        </p>
      </div>

      {/* The 5-Step Workflow Component */}
      <ReportWorkflow />

      {/* Direct Maintenance Desk Contacts */}
      <div className="max-w-3xl mx-auto rounded-lg border border-warm-300 bg-white p-4 shadow-subtle flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
        <div className="flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-maroon-700 shrink-0" />
          <span>Need immediate life-safety assistance? Contact College Security Room:</span>
        </div>
        <span className="font-mono font-bold text-maroon-950 bg-warm-100 px-2.5 py-1 rounded border border-warm-200">
          +91 3512 220 529 / Ext. 100
        </span>
      </div>
    </div>
  );
}
