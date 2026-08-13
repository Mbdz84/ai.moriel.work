-- ============================================================
-- Voice-AI | Platform super admin (developer/debugger)
-- A user in super_admins can view/manage ALL companies.
-- Run in Supabase SQL Editor.
-- ============================================================

create table if not exists super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table super_admins enable row level security;
-- Intentionally no policies: only the service role / SECURITY DEFINER
-- functions below can read it.

create or replace function is_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from super_admins where user_id = auth.uid());
$$;
grant execute on function is_super_admin() to authenticated;

-- Extend the core access checks so super admins pass everywhere.
create or replace function is_member(b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select is_super_admin() or exists (
    select 1 from memberships m
    where m.business_id = b and m.user_id = auth.uid()
  );
$$;

create or replace function is_admin(b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select is_super_admin() or exists (
    select 1 from memberships m
    where m.business_id = b and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

-- To grant super admin (run separately with the real UID):
-- insert into super_admins (user_id) values ('USER-UID') on conflict do nothing;
