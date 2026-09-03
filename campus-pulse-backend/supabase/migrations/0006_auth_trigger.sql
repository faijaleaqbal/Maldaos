-- ============================================================
-- CampusPulse 0006: auth.users -> profiles autocreate trigger
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_college uuid;
begin
  -- first college is the default (single-campus MVP; multi-college later)
  select id into v_college from public.colleges order by created_at limit 1;
  if v_college is null then
    insert into public.colleges(name) values ('Default College')
    on conflict (name) do nothing
    returning id into v_college;
    if v_college is null then
      select id into v_college from public.colleges where name = 'Default College';
    end if;
  end if;

  insert into public.profiles (id, college_id, role, full_name)
  values (
    new.id,
    v_college,
    'STUDENT',
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'New User')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
