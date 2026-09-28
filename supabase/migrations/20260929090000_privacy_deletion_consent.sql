-- =============================================================================
-- Privacy & data-protection support:
--   * account deletion: a client's record can outlive their login (anonymised),
--     so signed contracts and payments can be kept for legal/tax retention
--   * terms acceptance recorded at sign-up
--   * staff profiles are only public with the staff member's recorded consent
--   * audit-log redaction for erased people (the action history stays)
-- =============================================================================

-- ---- clients.user_id: nullable, detached when the login is deleted
alter table public.clients alter column user_id drop not null;
alter table public.clients drop constraint clients_user_id_fkey;
alter table public.clients
  add constraint clients_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
alter table public.clients add column deleted_at timestamptz;

-- ---- terms acceptance (timestamp supplied at sign-up; web and mobile)
alter table public.profiles add column terms_accepted_at timestamptz;

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_agency uuid;
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  v_phone text := coalesce(new.phone, nullif(trim(new.raw_user_meta_data ->> 'phone'), ''));
  v_kind public.client_kind := case
    when new.raw_user_meta_data ->> 'client_kind' = 'business' then 'business'::public.client_kind
    else 'household'::public.client_kind end;
  v_terms timestamptz := case
    when coalesce(new.raw_user_meta_data ->> 'terms_accepted', '') = 'true' then now() end;
begin
  select id into v_agency from public.agencies
   where slug = new.raw_user_meta_data ->> 'agency_slug';
  if v_agency is null then
    select id into v_agency from public.agencies order by created_at limit 1;
  end if;
  if v_agency is null then
    raise exception 'No agency configured';
  end if;

  -- Role is never read from metadata: every sign-up is a client.
  insert into public.profiles (id, agency_id, role, full_name, email, phone, terms_accepted_at)
  values (new.id, v_agency, 'client', v_name, new.email, v_phone, v_terms);

  insert into public.clients (agency_id, user_id, name, email, phone, kind)
  values (v_agency, new.id, v_name, new.email, v_phone, v_kind);

  return new;
end;
$$;

-- ---- staff publishing consent: no consent, no public profile
alter table public.staff_profiles add column publish_consent_at timestamptz;
grant update (publish_consent_at) on public.staff_profiles to authenticated;

create or replace view public.staff_catalog
with (security_barrier = true)
as
select
  sp.id,
  sp.agency_id,
  sp.category_id,
  sc.name as category_name,
  sc.slug as category_slug,
  sp.full_name,
  sp.photo_url,
  sp.video_url,
  sp.bio,
  sp.skills,
  sp.languages,
  sp.location_text,
  round(sp.lat::numeric, 2)::double precision as approx_lat,
  round(sp.lng::numeric, 2)::double precision as approx_lng,
  sp.availability,
  sp.live_arrangement,
  case when private.my_role() = 'staff' then null else sp.day_rate end as day_rate,
  case when private.my_role() = 'staff' then null else sp.month_rate end as month_rate,
  sp.years_experience,
  sp.verified_badge,
  sp.trained_badge,
  sp.background_checked_badge,
  sp.rating_avg,
  sp.rating_count
from public.staff_profiles sp
join public.staff_categories sc on sc.id = sp.category_id
where sp.is_active and sc.is_active and sp.publish_consent_at is not null;

-- ---- audit redaction for erased people (server-side only)
-- Keeps who did what and when; replaces the stored personal data with a marker.
create or replace function public.redact_audit_entries(
  p_targets jsonb,   -- [{"table": "staff_profiles", "id": "<uuid>"}, ...]
  p_refs jsonb,      -- [{"table": "ratings", "key": "staff_id", "value": "<uuid>"}, ...]
  p_reason text
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_marker jsonb := jsonb_build_object('redacted', true, 'reason', p_reason, 'redacted_at', now());
  v_count integer;
begin
  update public.audit_log a
     set previous_value = case when a.previous_value is null then null else v_marker end,
         new_value = case when a.new_value is null then null else v_marker end
   where exists (
           select 1 from jsonb_array_elements(coalesce(p_targets, '[]'::jsonb)) t
            where a.target_table = t ->> 'table' and a.target_id = t ->> 'id')
      or exists (
           select 1 from jsonb_array_elements(coalesce(p_refs, '[]'::jsonb)) r
            where a.target_table = r ->> 'table'
              and (a.previous_value ->> (r ->> 'key') = r ->> 'value'
                or a.new_value ->> (r ->> 'key') = r ->> 'value'));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.redact_audit_entries(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.redact_audit_entries(jsonb, jsonb, text) to service_role;
