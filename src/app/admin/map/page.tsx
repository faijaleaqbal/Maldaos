'use client';

import React, { useEffect, useState } from 'react';
import { useIssues } from '@/context/IssuesContext';
import { CampusMap } from '@/components/map/CampusMap';
import { AssignmentDrawer } from '@/components/admin/AssignmentDrawer';
import { Issue } from '@/types';
import { LocationsService, type DbLocation } from '@/services/locations.service';
import {
  Compass,
  Flame,
  Building,
  AlertTriangle,
} from 'lucide-react';

export default function AdminMapPage() {
  const { issues } = useIssues();
  const [locations, setLocations] = useState<DbLocation[]>([]);
  const [selectedBuildingCode, setSelectedBuildingCode] = useState<string>('ALL');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await LocationsService.listLocations();
      if (!cancelled) setLocations(list);
    })();
    return () => { cancelled = true; };
  }, []);

  const openDrawer = (iss: Issue) => {
    setSelectedIssue(iss);
    setIsDrawerOpen(true);
  };

  const buildingCounts: Record<string, { total: number; critical: number }> = {};
  for (const b of locations) buildingCounts[b.code] = { total: 0, critical: 0 };
  for (const iss of issues) {
    const code = iss.location.buildingCode;
    if (buildingCounts[code]) {
      buildingCounts[code].total++;
      if (iss.priority === 'CRITICAL' && iss.status !== 'RESOLVED' && iss.status !== 'CLOSED') {
        buildingCounts[code].critical++;
      }
    }
  }

  const center = LocationsService.campusCenter();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px- lg:px-8 py-6 space-y-6">
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
          <strong className="text-maroon-900">{center.lat.toFixed(4)}° N, {center.lng.toFixed(4)}° E</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <CampusMap
            issues={issues}
            height="560px"
            zoom={17}
            filterBuilding={selectedBuildingCode}
            highlightCritical={true}
          />
        </div>

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

            {locations.length === 0 ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>No locations configured. Add buildings to <code>public.locations</code> to populate the map.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {locations.map((bldg) => {
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
                      {bldg.description && (
                        <p className="text-[11px] text-ink-muted line-clamp-1 mb-1.5">{bldg.description}</p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-ink-muted pt-1.5 border-t border-warm-200/60">
                        <span className="font-mono">{bldg.code}</span>
                        {critical > 0 && (
                          <span className="font-bold text-rose-700 flex items-center gap-0.5">
                            <Flame className="w-3 h-3 text-rose-600" />
                            {critical} Critical
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
