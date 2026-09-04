/**
 * Locations service — Production
 *
 * Reads the campus location list from the real `public.locations`
 * table. The previous build used a hardcoded MOCK_BUILDINGS array
 * in the client bundle; this service replaces it with live DB data
 * (including latitude / longitude, populated by migration 0008).
 */
import { CampusBuilding } from '@/types';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export interface DbLocation {
  id: string;
  college_id: string;
  name: string;
  code: string;
  parent_location_id: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  building_type: CampusBuilding['type'] | null;
}

const MALDA_CENTER_FALLBACK = { lat: 25.0118, lng: 88.1432 };

export const LocationsService = {
  /** All locations for the current user's college, sorted by name. */
  async listLocations(): Promise<DbLocation[]> {
    if (!isSupabaseConfigured()) return [];
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, college_id, name, code, parent_location_id, latitude, longitude, description, building_type')
        .order('name');
      if (error || !data) return [];
      return data as unknown as DbLocation[];
    } catch {
      return [];
    }
  },

  /** Default campus centre for the map (used when no location is focused). */
  campusCenter(): { lat: number; lng: number } {
    return MALDA_CENTER_FALLBACK;
  },

  /** Map a DB location to the CampusBuilding shape the UI expects. */
  toBuilding(row: DbLocation): CampusBuilding {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      lat: row.latitude ?? MALDA_CENTER_FALLBACK.lat,
      lng: row.longitude ?? MALDA_CENTER_FALLBACK.lng,
      departments: [],
      floors: 1,
      description: row.description ?? '',
      type: (row.building_type as CampusBuilding['type']) ?? 'ACADEMIC',
    };
  },
};
