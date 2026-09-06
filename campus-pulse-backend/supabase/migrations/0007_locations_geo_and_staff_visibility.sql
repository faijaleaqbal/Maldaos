-- 0007_locations_geo_and_staff_visibility.sql
-- 1. Add real GPS coordinates (latitude, longitude) to public.locations
alter table public.locations add column if not exists latitude double precision;
alter table public.locations add column if not exists longitude double precision;

-- Seed authentic Malda College landmark coordinates
-- (canonical campus dataset; kept in sync with campus-pulse-backend/scripts/seed.ts,
--  src/lib/backendTypes.ts MALDA_CAMPUS_COORDINATES, and src/services/mockData.ts)
update public.locations set latitude = 25.0018, longitude = 88.1366 where code = 'MAIN';
update public.locations set latitude = 25.0007, longitude = 88.1368 where code = 'LIB';
update public.locations set latitude = 25.0022, longitude = 88.1362 where code = 'HOST-A';
update public.locations set latitude = 25.0013, longitude = 88.1363 where code = 'CAF';
update public.locations set latitude = 25.0011, longitude = 88.1375 where code = 'SPORT';

-- 2. Allow staff and department administrators to view active staff colleagues in their department
-- while preserving total privacy for student profiles and anonymous complaints.
drop policy if exists "profiles: staff and dept admins view colleagues" on public.profiles;
create policy "profiles: staff and dept admins view colleagues" on public.profiles
  for select to authenticated
  using (
    is_staff_or_above() and (
      department_id = user_department_id() or is_super_admin()
    ) and role in ('STAFF', 'DEPARTMENT_ADMIN') and is_active
  );
