-- ============================================================
-- CampusPulse 0008: Add lat/lng to public.locations
--
-- The previous build shipped hardcoded coordinates from
-- MOCK_BUILDINGS in the client, while the DB locations table had
-- no spatial columns. This migration adds latitude / longitude so
-- the map, location picker, and report workflow can source real
-- coordinates from the DB.
-- ============================================================

alter table public.locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists description text,
  add column if not exists building_type text
    check (building_type is null or building_type in
      ('ACADEMIC','ADMINISTRATIVE','LABORATORY','STUDENT_FACILITY','RESIDENTIAL'));

-- Existing RLS policies on locations (0004_rls.sql) remain in force.
-- No data migration: the seeded locations must be populated with
-- real coordinates via supabase/seed or the admin UI.
