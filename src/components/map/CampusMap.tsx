'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CampusBuilding, CampusLocation, Issue, IssuePriority } from '@/types';
import { MALDA_COLLEGE_COORDINATES, MOCK_BUILDINGS } from '@/services/mockData';
import { MapPin, Navigation, Layers, Info, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface CampusMapProps {
  issues?: Issue[];
  selectedLocation?: CampusLocation | null;
  onLocationSelect?: (location: Partial<CampusLocation>) => void;
  interactiveSelect?: boolean;
  filterBuilding?: string;
  height?: string;
  zoom?: number;
  highlightCritical?: boolean;
}

export const CampusMap: React.FC<CampusMapProps> = ({
  issues = [],
  selectedLocation,
  onLocationSelect,
  interactiveSelect = false,
  filterBuilding,
  height = '460px',
  zoom = 17,
  highlightCritical = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeBuildingFilter, setActiveBuildingFilter] = useState<string>(filterBuilding || 'ALL');

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;

      // Fix default marker icon issues in webpack / next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapContainerRef.current, {
        center: [MALDA_COLLEGE_COORDINATES.lat, MALDA_COLLEGE_COORDINATES.lng],
        zoom: zoom,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      // Warm editorial map tile layer (CartoDB Positron - matches warm off-white institutional theme cleanly)
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;

      if (interactiveSelect && onLocationSelect) {
        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          // Find closest building
          let closestBuilding = MOCK_BUILDINGS[0];
          let minDist = Infinity;

          MOCK_BUILDINGS.forEach((b) => {
            const dist = Math.hypot(b.lat - lat, b.lng - lng);
            if (dist < minDist) {
              minDist = dist;
              closestBuilding = b;
            }
          });

          onLocationSelect({
            building: closestBuilding.name,
            buildingCode: closestBuilding.code,
            coordinates: { lat, lng },
          });
        });
      }

      if (isMounted) {
        setMapLoaded(true);
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [interactiveSelect, onLocationSelect, zoom]);

  // Update markers whenever issues, filters, or selectedLocation changes
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !markersGroupRef.current) return;

    const renderMarkers = async () => {
      const L = (await import('leaflet')).default;
      const markersGroup = markersGroupRef.current;
      markersGroup.clearLayers();

      // 1. Campus Buildings landmark icons
      MOCK_BUILDINGS.forEach((bldg) => {
        const isFiltered = activeBuildingFilter !== 'ALL' && activeBuildingFilter !== bldg.code;
        if (isFiltered) return;

        const bldgDiv = document.createElement('div');
        bldgDiv.className =
          'bg-maroon-900 text-white font-serif text-[10px] font-semibold px-2 py-1 rounded shadow-md border border-gold-500 whitespace-nowrap cursor-pointer flex items-center gap-1 hover:scale-105 transition-transform';
        bldgDiv.innerHTML = `<span>🏛️</span><span>${bldg.name.split('(')[0].trim()}</span>`;

        const bldgIcon = L.divIcon({
          html: bldgDiv,
          className: 'custom-bldg-icon',
          iconSize: [120, 24],
          iconAnchor: [60, 12],
        });

        const bldgMarker = L.marker([bldg.lat, bldg.lng], { icon: bldgIcon }).addTo(markersGroup);

        bldgMarker.bindPopup(`
          <div class="p-1 max-w-[220px]">
            <h4 class="font-serif font-semibold text-xs text-maroon-950">${bldg.name}</h4>
            <p class="text-[11px] text-gray-600 mt-1">${bldg.description}</p>
            <div class="mt-1 text-[10px] text-maroon-800 font-medium">Departments: ${bldg.departments.slice(0, 3).join(', ')}</div>
          </div>
        `);

        if (interactiveSelect && onLocationSelect) {
          bldgMarker.on('click', () => {
            onLocationSelect({
              building: bldg.name,
              buildingCode: bldg.code,
              coordinates: { lat: bldg.lat, lng: bldg.lng },
            });
          });
        }
      });

      // 2. Issue markers
      const displayedIssues = issues.filter((iss) => {
        if (activeBuildingFilter !== 'ALL' && iss.location.buildingCode !== activeBuildingFilter) {
          return false;
        }
        return true;
      });

      displayedIssues.forEach((issue) => {
        const isCritical = (issue.priority === 'URGENT' || (issue.priority as string) === 'CRITICAL') && issue.status !== 'RESOLVED' && issue.status !== 'CLOSED';
        const isResolved = issue.status === 'RESOLVED' || issue.status === 'CLOSED';

        let markerColor = '#D4A72C'; // Gold for medium
        if (isCritical) markerColor = '#B91C1C'; // Red
        else if (issue.priority === 'HIGH') markerColor = '#EA580C'; // Orange
        else if (isResolved) markerColor = '#15803D'; // Green

        const markerHtml = document.createElement('div');
        markerHtml.className = `relative flex items-center justify-center cursor-pointer ${
          isCritical && highlightCritical ? 'critical-pulse-marker' : ''
        }`;
        markerHtml.style.width = '24px';
        markerHtml.style.height = '24px';
        markerHtml.innerHTML = `
          <div style="background-color: ${markerColor};" class="w-5 h-5 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-[10px] font-bold">
            ${isResolved ? '✓' : '!'}
          </div>
        `;

        const issueIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-issue-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const lat = issue.location.coordinates.lat || MALDA_COLLEGE_COORDINATES.lat;
        const lng = issue.location.coordinates.lng || MALDA_COLLEGE_COORDINATES.lng;

        const marker = L.marker([lat, lng], { icon: issueIcon }).addTo(markersGroup);

        marker.bindPopup(`
          <div class="p-1 max-w-[240px] font-sans">
            <div class="flex items-center justify-between gap-2 border-b border-gray-100 pb-1 mb-1">
              <span class="font-mono text-[10px] font-semibold text-maroon-900">${issue.ticketNumber}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                isCritical ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
              }">${issue.priority}</span>
            </div>
            <h5 class="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug">${issue.title}</h5>
            <div class="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
              <span>📍 ${issue.location.roomOrLandmark}</span>
            </div>
            <div class="mt-2 pt-1 border-t border-gray-100 flex items-center justify-between text-[11px]">
              <span class="text-gray-600">${issue.status.replace('_', ' ')}</span>
              <a href="/issues/${issue.id}" class="text-maroon-700 font-semibold hover:underline">View Ticket →</a>
            </div>
          </div>
        `);
      });

      // 3. User Selected Pin in Reporting Mode
      if (selectedLocation?.coordinates) {
        const pinHtml = document.createElement('div');
        pinHtml.className = 'flex items-center justify-center animate-bounce';
        pinHtml.innerHTML = `
          <div class="w-8 h-8 rounded-full bg-maroon-700 text-gold-400 border-2 border-white shadow-elevated flex items-center justify-center">
            📍
          </div>
        `;
        const selIcon = L.divIcon({
          html: pinHtml,
          className: 'selected-pin',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        L.marker([selectedLocation.coordinates.lat, selectedLocation.coordinates.lng], {
          icon: selIcon,
        }).addTo(markersGroup);
      }
    };

    renderMarkers();
  }, [mapLoaded, issues, activeBuildingFilter, selectedLocation, highlightCritical, interactiveSelect, onLocationSelect]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-warm-300 bg-warm-100">
      {/* Top Map Filter / Header Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-md border border-warm-300 shadow-sm pointer-events-auto flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span className="font-medium text-ink">Malda College Campus Map</span>
          <span className="text-ink-muted text-[11px] hidden sm:inline">• Live Node Status</span>
        </div>

        {/* Building Filter Pills */}
        <div className="bg-white/95 backdrop-blur-sm p-1 rounded-md border border-warm-300 shadow-sm pointer-events-auto flex items-center gap-1 text-[11px] overflow-x-auto max-w-[70vw]">
          <button
            type="button"
            onClick={() => setActiveBuildingFilter('ALL')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              activeBuildingFilter === 'ALL'
                ? 'bg-maroon-700 text-white'
                : 'text-ink-muted hover:bg-warm-100'
            }`}
          >
            All Buildings
          </button>
          <button
            type="button"
            onClick={() => setActiveBuildingFilter('VID-BHAVAN')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              activeBuildingFilter === 'VID-BHAVAN'
                ? 'bg-maroon-700 text-white'
                : 'text-ink-muted hover:bg-warm-100'
            }`}
          >
            Vidyasagar
          </button>
          <button
            type="button"
            onClick={() => setActiveBuildingFilter('CENT-ADM')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              activeBuildingFilter === 'CENT-ADM'
                ? 'bg-maroon-700 text-white'
                : 'text-ink-muted hover:bg-warm-100'
            }`}
          >
            Centenary
          </button>
          <button
            type="button"
            onClick={() => setActiveBuildingFilter('LIB-CENTRAL')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              activeBuildingFilter === 'LIB-CENTRAL'
                ? 'bg-maroon-700 text-white'
                : 'text-ink-muted hover:bg-warm-100'
            }`}
          >
            Library
          </button>
        </div>
      </div>

      {/* The Leaflet Container */}
      <div ref={mapContainerRef} style={{ height }} className="w-full relative z-10" />

      {/* Legend and Interactive Instruction Bar */}
      <div className="bg-white/95 border-t border-warm-300 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-ink uppercase tracking-wider">Severity:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-700" />
            <span className="text-[11px]">Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
            <span className="text-[11px]">High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gold-500" />
            <span className="text-[11px]">Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
            <span className="text-[11px]">Resolved</span>
          </div>
        </div>

        {interactiveSelect ? (
          <div className="text-[11px] font-medium text-maroon-800 flex items-center gap-1">
            <Navigation className="w-3 h-3" />
            <span>Click any location or building on map to tag coordinates</span>
          </div>
        ) : (
          <span className="text-[11px] font-mono">Malda, West Bengal (25.0088°N, 88.1394°E)</span>
        )}
      </div>
    </div>
  );
};
