-- 0007_locations_geo_and_staff_visibility.sql
-- 1. Add real GPS coordinates (latitude, longitude) to public.locations
alter table public.locations add column if not exists latitude double precision;
alter table public.locations add column if not exists longitude double precision;

-- Seed authentic Malda College landmark coordinates
update public.locations set latitude = 25.0088, longitude = 88.1394 where code = 'MAIN';
update public.locations set latitude = 25.0089, longitude = 88.1402 where code = 'LIB';
update public.locations set latitude = 25.0095, longitude = 88.1385 where code = 'HOST-A';
update public.locations set latitude = 25.0082, longitude = 88.1397 where code = 'CAF';
update public.locations set latitude = 25.0078, longitude = 88.1408 where code = 'SPORT';

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
