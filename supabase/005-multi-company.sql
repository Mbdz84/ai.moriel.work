-- ============================================================
-- Voice-AI | Allow one user to own multiple companies
-- Removes the "one company per user" restriction.
-- Run in Supabase SQL Editor after the earlier migrations.
-- ============================================================

create or replace function register_company(
  p_company_id   text,
  p_company_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_company_id is null or length(trim(p_company_id)) = 0 then
    raise exception 'company_id required';
  end if;

  if exists (select 1 from businesses where company_id = p_company_id) then
    raise exception 'company_id already taken';
  end if;

  insert into businesses (name, company_id)
    values (p_company_name, p_company_id)
    returning id into v_business_id;

  insert into memberships (business_id, user_id, role)
    values (v_business_id, auth.uid(), 'owner');

  insert into dispatch_targets (business_id) values (v_business_id);
  insert into credentials (business_id)       values (v_business_id);
  insert into agents (business_id)            values (v_business_id);

  return v_business_id;
end;
$$;

grant execute on function register_company(text, text) to authenticated;
