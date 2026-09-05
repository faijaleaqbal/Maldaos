'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { IssuesService } from '@/services/issues.service';
import { AuditLogEntry } from '@/types';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Download,
  RefreshCw,
} from 'lucide-react';

export default function AdminAuditPage() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(isSuperAdmin);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const loadAuditLogs = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      setLoading(true);
      setError(null);
      const data = await IssuesService.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setError(err.message || 'Failed to query institutional audit trail.');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadAuditLogs();
    }
  }, [isSuperAdmin, loadAuditLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchActor = log.actorName?.toLowerCase().includes(q);
        const matchAction = log.action.toLowerCase().includes(q);
        const matchEntity = log.entity.toLowerCase().includes(q);
        const matchEntityId = log.entityId?.toLowerCase().includes(q);
        if (!matchActor && !matchAction && !matchEntity && !matchEntityId) return false;
      }
      return true;
    });
  }, [logs, actionFilter, searchQuery]);

  const exportAuditJSON = () => {
    const jsonStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Malda_College_Audit_Trail_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isSuperAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="bg-white rounded-xl border border-warm-300 p-8 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-maroon-900 uppercase tracking-widest block mb-1">
              Restricted Security Ledger
            </span>
            <h2 className="font-serif font-bold text-2xl text-ink">
              Super Administrator Clearance Required
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-2 max-w-lg mx-auto leading-relaxed">
              You are signed in as <strong>{user.name}</strong> ({user.role}). Immutable database audit records and append-only transition ledgers (`public.audit_logs`) are restricted to Super Administrators per institutional governance policy.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link href="/admin">
              <Button variant="secondary" size="sm">
                Return to Command Overview
              </Button>
            </Link>
            <Link href="/admin/issues">
              <Button variant="primary" size="sm">
                View Department Issue Queue
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-warm-300 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-maroon-700" />
            <span className="font-mono text-xs font-semibold text-maroon-900 uppercase tracking-wider">
              Governance & Compliance
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
            Institutional Audit Trail & Ledger
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            Immutable log of role changes, work order dispatches, and status lifecycle transitions from PostgreSQL
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadAuditLogs}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Ledger
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={exportAuditJSON}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export Audit JSON
          </Button>
        </div>
      </div>

      {/* Control / Filter Bar */}
      <div className="rounded-lg border border-warm-300 bg-white p-4 shadow-subtle flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by actor name, action type, entity table, or entity UUID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-md border border-warm-300 focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700"
          />
        </div>

        <div className="w-full sm:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full sm:w-auto p-2 text-xs rounded border border-warm-300 bg-white text-ink focus:outline-none focus:border-maroon-700"
          >
            <option value="ALL">All Audit Actions ({logs.length})</option>
            <option value="ISSUE_ASSIGNED">Issue Assigned</option>
            <option value="STATUS_CHANGED">Status Changed</option>
            <option value="ROLE_CHANGED">Role Changed</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <LoadingState message="Querying public.audit_logs from database..." />
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
          {error}
        </div>
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          title="No Audit Entries Found"
          description="No operations have matched the current search criteria or been recorded in the audit ledger yet."
        />
      ) : (
        <div className="rounded-lg border border-warm-300 bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-warm-300 bg-warm-100/90 text-ink-muted text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3.5">Timestamp</th>
                  <th className="py-3 px-3.5">Actor</th>
                  <th className="py-3 px-3.5">Action</th>
                  <th className="py-3 px-3.5">Entity</th>
                  <th className="py-3 px-3.5">Changes / State Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-warm-50/80 transition-colors">
                    <td className="py-3 px-3.5 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="font-semibold text-ink">{log.actorName}</div>
                      <div className="text-[10px] text-ink-muted">{log.actorRole || 'SYSTEM'}</div>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-maroon-50 text-maroon-900 border border-maroon-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono text-[11px]">
                      <span className="text-ink font-medium">{log.entity}</span>
                      {log.entityId && (
                        <div className="text-[10px] text-ink-muted truncate max-w-[120px]">
                          {log.entityId}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3.5 max-w-[340px]">
                      <div className="space-y-1 font-mono text-[10px]">
                        {log.oldValues && (
                          <div className="text-rose-800 bg-rose-50/70 p-1.5 rounded border border-rose-200 truncate">
                            <strong>Old:</strong> {JSON.stringify(log.oldValues)}
                          </div>
                        )}
                        {log.newValues && (
                          <div className="text-emerald-800 bg-emerald-50/70 p-1.5 rounded border border-emerald-200 truncate">
                            <strong>New:</strong> {JSON.stringify(log.newValues)}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
