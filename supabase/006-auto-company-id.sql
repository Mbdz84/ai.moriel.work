-- ============================================================
-- Voice-AI | Auto-generate the company account number
-- company_id is now assigned automatically (e.g. 01001), not typed.
-- Run in Supabase SQL Editor.
-- ============================================================

create sequence if not exists company_number_seq start 1001;

drop function if exists register_company(text, text);

create or replace function register_company(p_company_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_company_id  text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  loop
    v_company_id := lpad(nextval('company_number_seq')::text, 5, '0');
    exit when not exists (select 1 from businesses where company_id = v_company_id);
  end loop;

  insert into businesses (name, company_id)
    values (p_company_name, v_company_id)
    returning id into v_business_id;

  insert into memberships (business_id, user_id, role)
    values (v_business_id, auth.uid(), 'owner');

  insert into dispatch_targets (business_id) values (v_business_id);
  insert into credentials (business_id)       values (v_business_id);
  insert into agents (business_id)            values (v_business_id);

  return v_business_id;
end;
$$;

grant execute on function register_company(text) to authenticated;
