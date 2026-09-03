'use client';

import React, { useState } from 'react';
import { useIssues } from '@/context/IssuesContext';
import { CampusMap } from '@/components/map/CampusMap';
import { MOCK_BUILDINGS } from '@/services/mockData';
import { AssignmentDrawer } from '@/components/admin/AssignmentDrawer';
import { Issue } from '@/types';
import {
  Compass,
  MapPin,
  Flame,
  ShieldAlert,
  Layers,
  Building,
  Info,
} from 'lucide-react';

export default function AdminMapPage() {
  const { issues } = useIssues();
  const [selectedBuildingCode, setSelectedBuildingCode] = useState<string>('ALL');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = (iss: Issue) => {
    setSelectedIssue(iss);
    setIsDrawerOpen(true);
  };

  const buildingCounts: Record<string, { total: number; critical: number }> = {};
  MOCK_BUILDINGS.forEach((b) => {
    buildingCounts[b.code] = { total: 0, critical: 0 };
  });

  issues.forEach((iss) => {
    const code = iss.location.buildingCode;
    if (buildingCounts[code]) {
      buildingCounts[code].total++;
      if (iss.priority === 'CRITICAL' && iss.status !== 'RESOLVED') {
        buildingCounts[code].critical++;
      }
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-warm-300 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Compass className="w-4 h-4 text-maroon-700" />
            <span className="font-mono text-xs font-semibold text-maroon-900 uppercase tracking-wider">
              Geographic Information System (GIS)
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
            Malda College Campus Command Map
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            Spatial distribution of active incidents, structural hazards, and facility infrastructure
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-white px-3 py-1.5 rounded-md border border-warm-300 shadow-sm">
          <span>Malda Coordinates:</span>
          <strong className="text-maroon-900">25.0088° N, 88.1394° E</strong>
        </div>
      </div>

      {/* Map + Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Map Canvas */}
        <div className="lg:col-span-8 space-y-4">
          <CampusMap
            issues={issues}
            height="560px"
            zoom={17}
            filterBuilding={selectedBuildingCode}
            highlightCritical={true}
          />
        </div>

        {/* Right Building Diagnostics Roster */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-warm-300 bg-white p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-warm-200 pb-2">
              <h3 className="font-serif font-bold text-base text-ink flex items-center gap-1.5">
                <Building className="w-4 h-4 text-maroon-700" />
                <span>Facility Density Roster</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedBuildingCode('ALL')}
                className="text-[11px] text-maroon-800 hover:underline font-medium"
              >
                Reset Filter
              </button>
            </div>

            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {MOCK_BUILDINGS.map((bldg) => {
                const count = buildingCounts[bldg.code]?.total || 0;
                const critical = buildingCounts[bldg.code]?.critical || 0;
                const isSelected = selectedBuildingCode === bldg.code;

                return (
                  <div
                    key={bldg.id}
                    onClick={() => setSelectedBuildingCode(isSelected ? 'ALL' : bldg.code)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-maroon-700 bg-maroon-50/70 ring-1 ring-maroon-700'
                        : 'border-warm-200 hover:border-maroon-300 hover:bg-warm-50 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <h4 className="font-serif font-semibold text-ink leading-snug">{bldg.name}</h4>
                      <span className="font-mono font-bold text-maroon-900 bg-warm-100 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                        {count} reports
                      </span>
                    </div>

                    <p className="text-[11px] text-ink-muted line-clamp-1 mb-1.5">{bldg.description}</p>

                    <div className="flex items-center justify-between text-[10px] text-ink-muted pt-1.5 border-t border-warm-200/60">
                      <span>{bldg.floors} Floors • {bldg.departments.slice(0, 2).join(', ')}</span>
                      {critical > 0 && (
                        <span className="font-bold text-rose-700 flex items-center gap-0.5">
                          <Flame className="w-3 h-3 text-rose-600" />
                          {critical} Critical Hazard
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <AssignmentDrawer
        issue={selectedIssue}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
