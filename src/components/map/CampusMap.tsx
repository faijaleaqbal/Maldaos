'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CampusBuilding, CampusLocation, Issue, IssuePriority } from '@/types';
import { MapPin, Layers, Info, Sparkles, AlertTriangle } from 'lucide-react';
import { LocationsService, type DbLocation } from '@/services/locations.service';

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
  const [locations, setLocations] = useState<DbLocation[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const center = LocationsService.campusCenter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await LocationsService.listLocations();
      if (!cancelled) {
        setLocations(list);
        if (list.length === 0) setLocationsError('No campus locations configured.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: zoom,
        zoomControl: true,
        scrollWheelZoom: false,
      });

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
          let closestBuilding: DbLocation | undefined = locations[0];
          let minDist = Infinity;
          for (const b of locations) {
            if (b.latitude == null || b.longitude == null) continue;
            const dist = Math.hypot(b.latitude - lat, b.longitude - lng);
            if (dist < minDist) {
              minDist = dist;
              closestBuilding = b;
            }
          }
          onLocationSelect({
            building: closestBuilding?.name ?? 'Custom location',
            buildingCode: closestBuilding?.code ?? 'CUSTOM',
            coordinates: { lat, lng },
          });
        });
      }

      if (isMounted) setMapLoaded(true);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render building + issue markers whenever locations or issues change.
  useEffect(() => {
    const render = async () => {
      if (!mapLoaded || !mapInstanceRef.current || !markersGroupRef.current) return;
      const L = (await import('leaflet')).default;
      const markersGroup = markersGroupRef.current;
      markersGroup.clearLayers();

      // 1. Real locations from DB
      for (const b of locations) {
        if (b.latitude == null || b.longitude == null) continue;
        const isFiltered = activeBuildingFilter !== 'ALL' && activeBuildingFilter !== b.code;
        if (isFiltered) continue;
        const bldgDiv = document.createElement('div');
        bldgDiv.className =
          'bg-maroon-900 text-white font-serif text-[10px] font-semibold px-2 py-1 rounded shadow-md border border-gold-500 whitespace-nowrap cursor-pointer flex items-center gap-1 hover:scale-105 transition-transform';
        bldgDiv.innerHTML = `<span>🏛️</span><span>${b.name.split('(')[0].trim()}</span>`;
        const bldgIcon = L.divIcon({ html: bldgDiv, className: 'custom-bldg-icon', iconSize: [120, 24], iconAnchor: [60, 12] });
        const m = L.marker([b.latitude, b.longitude], { icon: bldgIcon }).addTo(markersGroup);
        m.bindPopup(`<div class="p-1 max-w-[220px]"><h4 class="font-serif font-semibold text-xs text-maroon-950">${b.name}</h4>${b.description ? `<p class="text-[11px] text-gray-600 mt-1">${b.description}</p>` : ''}</div>`);
      }

      // 2. Issue markers
      for (const iss of issues) {
        if (!iss.location?.coordinates) continue;
        const { lat, lng } = iss.location.coordinates;
        const color = highlightCritical && (iss.priority === 'CRITICAL' || iss.priority === 'HIGH')
          ? 'rose'
          : iss.priority === 'MEDIUM'
            ? 'amber'
            : 'emerald';
        const statusColor = iss.status === 'RESOLVED' || iss.status === 'CLOSED' ? 'gray' : color;
        const dot = L.divIcon({
          html: `<div style="background:${statusColor === 'gray' ? '#9ca3af' : statusColor === 'rose' ? '#f43f5e' : statusColor === 'amber' ? '#f59e0b' : '#10b981'};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.3)"></div>`,
          className: 'custom-issue-icon',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([lat, lng], { icon: dot }).addTo(markersGroup).bindPopup(
          `<div class="p-1"><strong>${iss.title}</strong><br/><span class="text-[11px]">${iss.priority} · ${iss.status}</span></div>`
        );
      }

      // 3. Selected location
      if (selectedLocation?.coordinates) {
        const { lat, lng } = selectedLocation.coordinates;
        const sel = L.divIcon({
          html: `<div style="background:#7c1d1d;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #f59e0b"></div>`,
          className: 'custom-sel-icon',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker([lat, lng], { icon: sel }).addTo(markersGroup);
      }
    };
    void render();
  }, [locations, issues, activeBuildingFilter, selectedLocation, highlightCritical, mapLoaded]);

  return (
    <div className="space-y-2">
      {locationsError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{locationsError}</span>
        </div>
      )}
      <div
        ref={mapContainerRef}
        style={{ height, width: '100%' }}
        className="rounded-lg border border-warm-300 overflow-hidden bg-warm-100"
      />
      <div className="flex items-center justify-between text-[11px] text-ink-muted">
        <span className="flex items-center gap-1">
          <Layers className="w-3 h-3" /> {locations.filter((l) => l.latitude != null).length} buildings ·{' '}
          {issues.length} issues
        </span>
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3" /> Source: public.locations
        </span>
      </div>
    </div>
  );
};
