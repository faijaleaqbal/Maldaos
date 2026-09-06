'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useIssues } from '@/context/IssuesContext';
import { LocationOption, IssuesService } from '@/services/issues.service';
import { MALDA_CAMPUS_COORDINATES } from '@/lib/backendTypes';
import { Issue } from '@/types';
import { Button } from '@/components/ui/Button';
import {
  Compass,
  Building2,
  ShieldCheck,
  Flame,
  ArrowRight,
  PlusCircle,
  Activity,
} from 'lucide-react';

// Dynamically import 3D Campus Spatial Map to guarantee zero SSR hydration mismatch
const CampusSpatialMap = dynamic(
  () =>
    import('@/components/3d/CampusSpatialMap').then((mod) => mod.CampusSpatialMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[620px] bg-paper-100 border border-warm-300 rounded-lg flex flex-col items-center justify-center gap-3 p-6 text-center animate-pulse">
        <Compass className="w-8 h-8 text-maroon-800 animate-spin" />
        <span className="font-serif font-bold text-base text-ink">
          Constructing 3D Spatial Digital Campus...
        </span>
        <span className="text-xs text-ink-muted">
          Loading Malda College architectural geometries & live telemetry
        </span>
      </div>
    ),
  }
);

export default function CampusMapPage() {
  const { issues, summary } = useIssues();
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedBuildingCode, setSelectedBuildingCode] = useState<string>('ALL');
  const [inspectedIssue, setInspectedIssue] = useState<Issue | null>(null);

  useEffect(() => {
    let cancelled = false;
    IssuesService.getLocations()
      .then((locs) => {
        if (!cancelled) setLocations(locs);
      })
      .catch((err) => {
        console.error('Failed to load campus locations for map:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const urgentIssues = issues.filter(
    (i) => i.priority === 'URGENT' && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Institutional GIS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-warm-300 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span className="font-mono text-xs font-semibold text-maroon-900 uppercase tracking-wider">
              Geographic Information System • 3D Spatial Digital Twin
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-maroon-950">
            Malda College Campus Spatial Command Map
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            Interactive real-time 3D visualization of 8 academic bhavans, civil infrastructure, and active fault work orders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/report">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<PlusCircle className="w-3.5 h-3.5 text-gold-400" />}
            >
              Lodge Defect Report
            </Button>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-white px-3 py-2 rounded-md border border-warm-300 shadow-sm">
            <span>Coordinates:</span>
            <strong className="text-maroon-900">
              {MALDA_CAMPUS_COORDINATES.lat.toFixed(4)}° N, {MALDA_CAMPUS_COORDINATES.lng.toFixed(4)}° E
            </strong>
          </div>
        </div>
      </div>

      {/* Spatial Telemetry Quick Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-lg border border-warm-300 shadow-subtle flex items-center gap-3">
          <div className="p-2 rounded bg-maroon-50 text-maroon-800 border border-maroon-200">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="block font-mono text-lg font-bold text-ink">9 Landmarks</span>
            <span className="text-[11px] text-ink-muted">Campus Structures</span>
          </div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-warm-300 shadow-subtle flex items-center gap-3">
          <div className="p-2 rounded bg-amber-50 text-amber-800 border border-amber-200">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="block font-mono text-lg font-bold text-ink">{summary.openIssues} Active</span>
            <span className="text-[11px] text-ink-muted">Work Orders in Field</span>
          </div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-warm-300 shadow-subtle flex items-center gap-3">
          <div className="p-2 rounded bg-rose-50 text-rose-800 border border-rose-200">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="block font-mono text-lg font-bold text-rose-700">
              {urgentIssues.length} Urgent
            </span>
            <span className="text-[11px] text-ink-muted">Active Safety Hazards</span>
          </div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-warm-300 shadow-subtle flex items-center gap-3">
          <div className="p-2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="block font-mono text-lg font-bold text-emerald-800">
              {summary.campusHealth.overall} / 100
            </span>
            <span className="text-[11px] text-ink-muted">Infrastructure Index</span>
          </div>
        </div>
      </div>

      {/* Main 3D Spatial Campus Experience */}
      <div className="w-full">
        <CampusSpatialMap
          issues={issues}
          locations={locations}
          height="620px"
          filterBuilding={selectedBuildingCode}
          onIssueSelect={(iss) => setInspectedIssue(iss)}
          highlightCritical={true}
        />
      </div>

      {/* Spatial Campus Ledger & Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
        {/* Left: Building Quick Jump Directory */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-warm-300 p-4 space-y-3 shadow-subtle">
          <div className="flex items-center justify-between border-b border-warm-200 pb-2">
            <h3 className="font-serif font-bold text-sm text-ink">Campus Bhavan Directory</h3>
            <span className="text-[11px] font-mono text-ink-muted">8 Total</span>
          </div>

          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {locations.map((b) => {
              const bIssues = issues.filter((i) => i.location.buildingCode === b.code);
              const bUrgent = bIssues.filter(
                (i) => i.priority === 'URGENT' && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
              ).length;

              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBuildingCode(b.code)}
                  className={`w-full text-left p-2.5 rounded-md border transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 select-none touch-manipulation ${
                    selectedBuildingCode === b.code
                      ? 'bg-maroon-50 border-maroon-700 text-maroon-950 shadow-sm -translate-y-0.5'
                      : 'bg-warm-50/70 hover:bg-white hover:border-warm-400 hover:shadow-xs border-warm-200 text-ink active:translate-y-0.5'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-serif font-semibold text-xs block truncate">
                      {b.name}
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted block">
                      Code: {b.code}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {bUrgent > 0 && (
                      <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                        {bUrgent} Urg
                      </span>
                    )}
                    <span className="bg-white border border-warm-300 text-ink-muted text-[10px] font-mono px-1.5 py-0.5 rounded">
                      {bIssues.length}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Incidents in Spatial View */}
        <div className="lg:col-span-8 bg-white rounded-lg border border-warm-300 p-4 space-y-3 shadow-subtle">
          <div className="flex items-center justify-between border-b border-warm-200 pb-2">
            <div>
              <h3 className="font-serif font-bold text-sm text-ink">
                Spatial Maintenance Incident Queue
              </h3>
              <p className="text-[11px] text-ink-muted">
                {selectedBuildingCode === 'ALL'
                  ? 'Showing active work orders campus-wide'
                  : `Filtered to ${selectedBuildingCode}`}
              </p>
            </div>
            <Link
              href="/issues"
              className="text-xs text-maroon-800 hover:text-maroon-950 font-medium flex items-center gap-1"
            >
              <span>Full Issues Table</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-warm-200">
            {issues
              .filter(
                (iss) =>
                  selectedBuildingCode === 'ALL' ||
                  iss.location.buildingCode === selectedBuildingCode
              )
              .slice(0, 6)
              .map((iss) => (
                <div
                  key={iss.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-warm-50/50 px-2 rounded transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-maroon-800">
                        {iss.ticketNumber}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                          iss.priority === 'URGENT'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : iss.priority === 'HIGH'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-warm-100 text-ink-muted border-warm-300'
                        }`}
                      >
                        {iss.priority}
                      </span>
                      <span className="text-[10px] text-ink-muted">
                        • {iss.location.building}
                      </span>
                    </div>
                    <p className="text-xs font-serif font-medium text-ink">
                      {iss.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-[11px] font-mono text-ink-muted">
                      {iss.status}
                    </span>
                    <Link href={`/issues/${iss.id}`}>
                      <Button variant="secondary" size="sm" className="h-7 text-xs px-2.5">
                        Inspect
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
