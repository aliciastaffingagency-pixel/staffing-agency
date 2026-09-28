-- =============================================================================
-- Phase 2: admin staff management + public catalog.
--  * vetting checks drive the trust badges (admins confirm checks; badges follow)
--  * badge / rating columns can no longer be written directly through the API
--  * staff_reviews view: published reviews per staff member, privacy-safe
-- =============================================================================

create type public.vetting_check_type as enum ('id_verification', 'reference_check', 'background_check', 'training');

create table public.staff_vetting_checks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  staff_id uuid not null references public.staff_profiles (id) on delete cascade,
  check_type public.vetting_check_type not null,
  passed boolean not null default true,
  notes text,
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz not null default now(),
  unique (staff_id, check_type)
);
create index staff_vetting_checks_staff_idx on public.staff_vetting_checks (staff_id);

alter table public.staff_vetting_checks enable row level security;
create policy "admin manages vetting checks" on public.staff_vetting_checks
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));
create policy "staff reads own vetting checks" on public.staff_vetting_checks
  for select to authenticated using (staff_id = private.my_staff_id());

grant select, insert, update, delete on public.staff_vetting_checks to authenticated;
grant select, insert, update, delete on public.staff_vetting_checks to service_role;

create trigger audit_changes after insert or update or delete on public.staff_vetting_checks
  for each row execute function private.audit_row_change();

-- Badges are derived from confirmed checks:
--   Verified           = ID verified in person
--   Background-checked = references called AND background check passed
--   Trained            = training completed
-- vetting_status follows the same checks unless the admin rejected the person.
create or replace function private.refresh_staff_badges()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_staff uuid := coalesce(new.staff_id, old.staff_id);
  v_id boolean;
  v_ref boolean;
  v_bg boolean;
  v_train boolean;
  v_any boolean;
begin
  select
    coalesce(bool_or(check_type = 'id_verification' and passed), false),
    coalesce(bool_or(check_type = 'reference_check' and passed), false),
    coalesce(bool_or(check_type = 'background_check' and passed), false),
    coalesce(bool_or(check_type = 'training' and passed), false),
    count(*) > 0
  into v_id, v_ref, v_bg, v_train, v_any
  from public.staff_vetting_checks
  where staff_id = v_staff;

  update public.staff_profiles
     set verified_badge = v_id,
         background_checked_badge = v_ref and v_bg,
         trained_badge = v_train,
         vetting_status = case
           when vetting_status = 'rejected' then vetting_status
           when v_id and v_ref and v_bg then 'verified'::public.vetting_status
           when v_any then 'in_review'::public.vetting_status
           else 'pending'::public.vetting_status
         end
   where id = v_staff;
  return coalesce(new, old);
end;
$$;

create trigger refresh_staff_badges
  after insert or update or delete on public.staff_vetting_checks
  for each row execute function private.refresh_staff_badges();

-- Admins edit staff through the API, but never the derived columns.
revoke update on public.staff_profiles from authenticated;
grant update (
  category_id, user_id, full_name, photo_url, video_url, bio, skills, languages, location_text, lat, lng,
  availability, live_arrangement, day_rate, month_rate, years_experience, vetting_status, id_doc_url, is_active
) on public.staff_profiles to authenticated;

-- Inserts can't smuggle in badges or ratings either.
create or replace function private.reset_derived_staff_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    new.verified_badge := false;
    new.trained_badge := false;
    new.background_checked_badge := false;
    new.rating_avg := 0;
    new.rating_count := 0;
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger reset_derived_staff_columns
  before insert on public.staff_profiles
  for each row execute function private.reset_derived_staff_columns();

-- ---------------------------------------------------------------------------
-- staff_reviews: published reviews for a staff profile page.
-- ---------------------------------------------------------------------------
create view public.staff_reviews
with (security_barrier = true)
as
select
  r.id,
  r.agency_id,
  r.staff_id,
  r.stars,
  nullif(trim(r.comment), '') as comment,
  split_part(coalesce(c.name, 'Client'), ' ', 1) as client_first_name,
  c.location_text as client_area,
  r.created_at
from public.ratings r
join public.clients c on c.id = r.client_id
join public.staff_profiles sp on sp.id = r.staff_id
where r.is_published and sp.is_active;

grant select on public.staff_reviews to anon, authenticated, service_role;
