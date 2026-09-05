'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { CampusLocation, Issue } from '@/types';
import { LocationOption, IssuesService } from '@/services/issues.service';
import { MALDA_CAMPUS_COORDINATES } from '@/lib/backendTypes';
import { Navigation, Box, Map as MapIcon, Compass } from 'lucide-react';
import { detectWebGL } from '@/components/3d/webgl-check';

// Lazy load 3D Spatial Map to prevent SSR hydration issues
const CampusSpatialMap = dynamic(
  () =>
    import('@/components/3d/CampusSpatialMap').then((mod) => mod.CampusSpatialMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[460px] bg-paper-100 border border-warm-300 rounded-lg flex flex-col items-center justify-center gap-2 p-6 text-center animate-pulse">
        <Compass className="w-7 h-7 text-maroon-800 animate-spin" />
        <span className="font-serif font-bold text-sm text-ink">
          Initializing MaldaOS 3D Spatial Campus...
        </span>
      </div>
    ),
  }
);

interface CampusMapProps {
  issues?: Issue[];
  locations?: LocationOption[];
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
  locations: initialLocations,
  selectedLocation,
  onLocationSelect,
  interactiveSelect = false,
  filterBuilding,
  height = '460px',
  zoom = 17,
  highlightCritical = true,
}) => {
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeBuildingFilter, setActiveBuildingFilter] = useState<string>(
    filterBuilding || 'ALL'
  );
  const [locations, setLocations] = useState<LocationOption[]>(initialLocations || []);

  useEffect(() => {
    const caps = detectWebGL();
    setWebglSupported(caps.supported);
    if (!caps.supported) {
      setViewMode('2D');
    }
  }, []);

  useEffect(() => {
    if (filterBuilding) {
      setActiveBuildingFilter(filterBuilding);
    }
  }, [filterBuilding]);

  useEffect(() => {
    if (initialLocations && initialLocations.length > 0) {
      setLocations(initialLocations);
      return;
    }
    let cancelled = false;
    IssuesService.getLocations()
      .then((locs) => {
        if (!cancelled) setLocations(locs);
      })
      .catch((err) => {
        console.error('CampusMap: Failed to fetch locations:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [initialLocations]);

  const locationsRef = useRef<LocationOption[]>(locations);
  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);

  // Initialize Leaflet only when 2D mode is active
  useEffect(() => {
    if (viewMode !== '2D') return;

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
        center: [MALDA_CAMPUS_COORDINATES.lat, MALDA_CAMPUS_COORDINATES.lng],
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
          const currentLocs = locationsRef.current;
          let closestLoc: LocationOption | null = null;
          let minDist = Infinity;

          currentLocs.forEach((loc) => {
            if (loc.latitude != null && loc.longitude != null) {
              const dist = Math.hypot(loc.latitude - lat, loc.longitude - lng);
              if (dist < minDist) {
                minDist = dist;
                closestLoc = loc;
              }
            }
          });

          if (closestLoc) {
            onLocationSelect({
              building: (closestLoc as LocationOption).name,
              buildingCode: (closestLoc as LocationOption).code,
              coordinates: { lat, lng },
            });
          } else {
            onLocationSelect({
              coordinates: { lat, lng },
            });
          }
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
        markersGroupRef.current = null;
        setMapLoaded(false);
      }
    };
  }, [viewMode, zoom, interactiveSelect, onLocationSelect]);

  // Update Leaflet markers when in 2D mode
  useEffect(() => {
    if (viewMode !== '2D' || !mapLoaded || !mapInstanceRef.current || !markersGroupRef.current)
      return;

    const L = (window as any).L;
    if (!L) return;

    const markersGroup = markersGroupRef.current;
    markersGroup.clearLayers();

    // Render buildings and issues
    locations.forEach((loc) => {
      if (loc.latitude != null && loc.longitude != null) {
        const marker = L.circleMarker([loc.latitude, loc.longitude], {
          radius: 8,
          fillColor: '#7A1F2B',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        });
        marker.bindPopup(`<b>${loc.name}</b><br/>Code: ${loc.code}`);
        markersGroup.addLayer(marker);
      }
    });

    issues.forEach((iss) => {
      if (iss.location.coordinates?.lat && iss.location.coordinates?.lng) {
        const color =
          iss.priority === 'URGENT'
            ? '#e11d48'
            : iss.priority === 'HIGH'
            ? '#f59e0b'
            : '#10b981';
        const marker = L.circleMarker(
          [iss.location.coordinates.lat, iss.location.coordinates.lng],
          {
            radius: iss.priority === 'URGENT' ? 9 : 6,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          }
        );
        marker.bindPopup(
          `<b>${iss.ticketNumber}</b>: ${iss.title}<br/>Priority: ${iss.priority}<br/>Status: ${iss.status}`
        );
        markersGroup.addLayer(marker);
      }
    });
  }, [viewMode, mapLoaded, locations, issues]);

  return (
    <div className="relative w-full rounded-lg border border-warm-300 bg-paper-100 overflow-hidden shadow-subtle flex flex-col">
      {/* Top View Mode Switcher Header */}
      <div className="bg-white/95 border-b border-warm-300 px-3.5 py-2 flex items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span className="font-serif font-bold text-xs sm:text-sm text-maroon-950">
            Malda College Campus Spatial Command
          </span>
        </div>

        {/* 3D vs 2D Toggle */}
        <div className="flex items-center gap-1 bg-warm-100 p-0.5 rounded-md border border-warm-300 text-xs font-mono">
          <button
            type="button"
            disabled={!webglSupported}
            onClick={() => setViewMode('3D')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all cursor-pointer ${
              viewMode === '3D'
                ? 'bg-maroon-800 text-white font-bold shadow-xs'
                : 'text-ink-muted hover:text-ink'
            } ${!webglSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Box className="w-3.5 h-3.5 text-gold-400" />
            <span>3D Spatial Twin</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('2D')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all cursor-pointer ${
              viewMode === '2D'
                ? 'bg-maroon-800 text-white font-bold shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>2D GIS Map</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === '3D' ? (
        <CampusSpatialMap
          issues={issues}
          locations={locations}
          selectedLocation={selectedLocation}
          onLocationSelect={onLocationSelect}
          height={height}
          filterBuilding={activeBuildingFilter}
          highlightCritical={highlightCritical}
        />
      ) : (
        <div className="relative w-full overflow-hidden flex-1" style={{ height }}>
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
          <div className="absolute bottom-2 left-3 right-3 z-[1000] bg-white/90 backdrop-blur-md px-3 py-1 rounded-md border border-warm-300 text-xs text-ink-muted font-mono flex items-center justify-between">
            <span>2D Cartographic GIS Map</span>
            <span>{MALDA_CAMPUS_COORDINATES.lat.toFixed(4)}° N, {MALDA_CAMPUS_COORDINATES.lng.toFixed(4)}° E</span>
          </div>
        </div>
      )}
    </div>
  );
};
