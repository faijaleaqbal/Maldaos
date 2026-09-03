'use client';

import React from 'react';
import { CampusLocation } from '@/types';
import { MOCK_BUILDINGS } from '@/services/mockData';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { CampusMap } from '@/components/map/CampusMap';
import { MapPin, Navigation } from 'lucide-react';

interface LocationPickerProps {
  location: CampusLocation;
  onChange: (location: CampusLocation) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ location, onChange }) => {
  const buildingOptions = MOCK_BUILDINGS.map((b) => ({
    label: `${b.name} (${b.departments.slice(0, 2).join(', ')})`,
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
    const selected = MOCK_BUILDINGS.find((b) => b.code === code) || MOCK_BUILDINGS[0];
    onChange({
      ...location,
      building: selected.name,
      buildingCode: selected.code,
      coordinates: { lat: selected.lat, lng: selected.lng },
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Building Select */}
        <Select
          label="College Building / Facility *"
          options={buildingOptions}
          value={location.buildingCode}
          onChange={(e) => handleBuildingChange(e.target.value)}
        />

        {/* Floor Select */}
        <Select
          label="Floor / Level *"
          options={floorOptions}
          value={location.floor}
          onChange={(e) => onChange({ ...location, floor: e.target.value })}
        />
      </div>

      {/* Room or Landmark */}
      <Input
        label="Room Number / Landmark Description *"
        placeholder="e.g. Room 204, Chemistry Lab 3 fume hood, East Stairwell..."
        value={location.roomOrLandmark}
        onChange={(e) => onChange({ ...location, roomOrLandmark: e.target.value })}
        leftIcon={<MapPin className="w-4 h-4 text-maroon-700" />}
        helperText="Be as specific as possible so maintenance crews can locate the problem quickly."
      />

      {/* Interactive Map Visualizer */}
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
