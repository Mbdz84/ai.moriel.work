-- ============================================================
-- Voice-AI | Roles (admin/viewer) + team management
-- viewer = read-only (dashboard). admin/owner = full access.
-- Run in Supabase SQL Editor.
-- ============================================================

create or replace function is_admin(b uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    where m.business_id = b and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

drop policy if exists all_agents on agents;
create policy sel_agents on agents for select using (is_member(business_id));
create policy wr_agents  on agents for all    using (is_admin(business_id)) with check (is_admin(business_id));

drop policy if exists all_dispatch on dispatch_targets;
create policy sel_dispatch on dispatch_targets for select using (is_member(business_id));
create policy wr_dispatch  on dispatch_targets for all    using (is_admin(business_id)) with check (is_admin(business_id));

drop policy if exists all_credentials on credentials;
create policy sel_credentials on credentials for select using (is_member(business_id));
create policy wr_credentials  on credentials for all    using (is_admin(business_id)) with check (is_admin(business_id));

drop policy if exists upd_businesses on businesses;
create policy upd_businesses on businesses for update using (is_admin(id)) with check (is_admin(id));

create or replace function get_company_members(b uuid)
returns table(user_id uuid, role text, email text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(b) then raise exception 'not authorized'; end if;
  return query
    select m.user_id, m.role, u.email::text
    from memberships m
    join auth.users u on u.id = m.user_id
    where m.business_id = b
    order by m.created_at;
end;
$$;
grant execute on function get_company_members(uuid) to authenticated;
