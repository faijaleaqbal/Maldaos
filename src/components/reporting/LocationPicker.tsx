'use client';

import React, { useEffect, useState } from 'react';
import { CampusLocation } from '@/types';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { CampusMap } from '@/components/map/CampusMap';
import { MapPin } from 'lucide-react';
import { LocationsService, type DbLocation } from '@/services/locations.service';

interface LocationPickerProps {
  location: CampusLocation;
  onChange: (location: CampusLocation) => void;
}

const FALLBACK_CENTER = LocationsService.campusCenter();

export const LocationPicker: React.FC<LocationPickerProps> = ({ location, onChange }) => {
  const [locations, setLocations] = useState<DbLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await LocationsService.listLocations();
      if (!cancelled) {
        setLocations(list);
        setLoading(false);
        // If the current location has no DB match, snap to the first
        // known location so the form starts from real data.
        if (list.length > 0 && !list.find((l) => l.code === location.buildingCode)) {
          const first = list[0];
          onChange({
            ...location,
            building: first.name,
            buildingCode: first.code,
            coordinates: {
              lat: first.latitude ?? FALLBACK_CENTER.lat,
              lng: first.longitude ?? FALLBACK_CENTER.lng,
            },
          });
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildingOptions = locations.map((b) => ({
    label: b.name,
    value: b.code,
  }));

  const floorOptions = [
    { label: 'Ground Floor', value: 'Ground Floor' },
    { label: '1st Floor', value: '1st Floor' },
    { label: '2nd Floor', value: '2nd Floor' },
    { label: '3rd Floor', value: '3rd Floor' },
    { label: 'Rooftop / Overhead Tank', value: 'Rooftop' },
    { label: 'Outdoor Campus / Quadrangle', value: 'Outdoor Area' },
  ];

  const handleBuildingChange = (code: string) => {
    const selected = locations.find((l) => l.code === code) ?? locations[0];
    if (!selected) return;
    onChange({
      ...location,
      building: selected.name,
      buildingCode: selected.code,
      coordinates: {
        lat: selected.latitude ?? FALLBACK_CENTER.lat,
        lng: selected.longitude ?? FALLBACK_CENTER.lng,
      },
    });
  };

  const handleMapCoordSelect = (coordsData: Partial<CampusLocation>) => {
    onChange({
      ...location,
      building: coordsData.building || location.building,
      buildingCode: coordsData.buildingCode || location.buildingCode,
      coordinates: coordsData.coordinates || location.coordinates,
    });
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-xs text-ink-muted">Loading campus locations…</div>
      ) : locations.length === 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          No campus locations are configured. Add locations to the <code>public.locations</code> table with latitude/longitude.
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="College Building / Facility *"
          options={buildingOptions}
          value={location.buildingCode}
          onChange={(e) => handleBuildingChange(e.target.value)}
          disabled={locations.length === 0}
        />
        <Select
          label="Floor / Level *"
          options={floorOptions}
          value={location.floor}
          onChange={(e) => onChange({ ...location, floor: e.target.value })}
        />
      </div>

      <Input
        label="Room Number / Landmark Description *"
        placeholder="e.g. Room 204, Chemistry Lab 3 fume hood, East Stairwell..."
        value={location.roomOrLandmark}
        onChange={(e) => onChange({ ...location, roomOrLandmark: e.target.value })}
        leftIcon={<MapPin className="w-4 h-4 text-maroon-700" />}
        helperText="Be as specific as possible so maintenance crews can locate the problem quickly."
      />

      <div className="space-y-1.5 pt-2">
        <label className="block text-xs font-semibold text-ink uppercase tracking-wider flex items-center justify-between">
          <span>Campus Geographic Coordinates</span>
          <span className="text-ink-muted font-mono text-[11px] normal-case">
            Lat: {location.coordinates.lat.toFixed(4)}, Lng: {location.coordinates.lng.toFixed(4)}
          </span>
        </label>
        <CampusMap
          height="240px"
          zoom={17}
          interactiveSelect={true}
          selectedLocation={location}
          onLocationSelect={handleMapCoordSelect}
        />
      </div>
    </div>
  );
};
