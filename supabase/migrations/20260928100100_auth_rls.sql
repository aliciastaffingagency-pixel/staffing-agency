-- =============================================================================
-- Auth helpers, signup trigger, RLS policies, audit + rating triggers,
-- public read-only views, storage buckets.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (private schema: not exposed through the API)
-- SECURITY DEFINER so they can read profiles/clients without recursing RLS.
-- ---------------------------------------------------------------------------
grant usage on schema private to anon, authenticated;

create or replace function private.my_role()
returns public.user_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function private.my_agency_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select agency_id from public.profiles where id = (select auth.uid());
$$;

create or replace function private.is_admin(p_agency uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'super_admin' and agency_id = p_agency
  );
$$;

create or replace function private.my_client_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.clients where user_id = (select auth.uid());
$$;

create or replace function private.my_staff_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.staff_profiles where user_id = (select auth.uid());
$$;

create or replace function private.can_access_thread(p_thread uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.message_threads t
    where t.id = p_thread
      and (
        t.client_id in (select id from public.clients where user_id = (select auth.uid()))
        or exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role = 'super_admin' and p.agency_id = t.agency_id
        )
      )
  );
$$;

grant execute on all functions in schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Signup: every new auth user gets a profile (role = client) and a client row.
-- The agency comes from signup metadata (agency_slug) or falls back to the
-- first agency. Role is NEVER read from metadata. Admin/staff roles are
-- granted server-side with the service role key.
-- ---------------------------------------------------------------------------
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
begin
  select id into v_agency from public.agencies
   where slug = new.raw_user_meta_data ->> 'agency_slug';
  if v_agency is null then
    select id into v_agency from public.agencies order by created_at limit 1;
  end if;
  if v_agency is null then
    raise exception 'No agency configured';
  end if;

  insert into public.profiles (id, agency_id, role, full_name, email, phone)
  values (new.id, v_agency, 'client', v_name, new.email, v_phone);

  insert into public.clients (agency_id, user_id, name, email, phone, kind)
  values (v_agency, new.id, v_name, new.email, v_phone, v_kind);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Audit log: generic row-change trigger
-- ---------------------------------------------------------------------------
create or replace function private.audit_row_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return new;
  end if;
  insert into public.audit_log (agency_id, actor_id, action, target_table, target_id, previous_value, new_value)
  values (
    (case when tg_table_name = 'agencies' then v_row ->> 'id' else v_row ->> 'agency_id' end)::uuid,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    v_row ->> 'id',
    v_old,
    v_new
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'agencies', 'profiles', 'staff_categories', 'staff_profiles', 'booking_requests',
    'contract_templates', 'contracts', 'payments', 'existing_staff_claims', 'ratings'
  ] loop
    execute format(
      'create trigger audit_changes after insert or update or delete on public.%I
         for each row execute function private.audit_row_change()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Rating aggregates on staff_profiles (published ratings only)
-- ---------------------------------------------------------------------------
create or replace function private.refresh_staff_rating()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare v_staff uuid := coalesce(new.staff_id, old.staff_id);
begin
  update public.staff_profiles sp
     set rating_avg = coalesce(r.avg_stars, 0),
         rating_count = coalesce(r.n, 0)
    from (
      select round(avg(stars)::numeric, 2) as avg_stars, count(*)::int as n
        from public.ratings
       where staff_id = v_staff and is_published
    ) r
   where sp.id = v_staff;
  if tg_op = 'UPDATE' and old.staff_id is distinct from new.staff_id then
    update public.staff_profiles sp
       set rating_avg = coalesce((select round(avg(stars)::numeric, 2) from public.ratings where staff_id = old.staff_id and is_published), 0),
           rating_count = (select count(*)::int from public.ratings where staff_id = old.staff_id and is_published)
     where sp.id = old.staff_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger refresh_staff_rating
  after insert or update or delete on public.ratings
  for each row execute function private.refresh_staff_rating();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_categories enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.clients enable row level security;
alter table public.booking_requests enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;
alter table public.payments enable row level security;
alter table public.existing_staff_claims enable row level security;
alter table public.ratings enable row level security;
alter table public.message_threads enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- ---- agencies: public branding, admin edits
create policy "agencies are public" on public.agencies
  for select to anon, authenticated using (true);
create policy "admin updates own agency" on public.agencies
  for update to authenticated
  using (private.is_admin(id)) with check (private.is_admin(id));

-- ---- profiles: self + admin. Column grants below stop users changing role/agency.
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "admin reads agency profiles" on public.profiles
  for select to authenticated using (private.is_admin(agency_id));
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "admin updates agency profiles" on public.profiles
  for update to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- ---- staff_categories: active ones are public, admin manages all
create policy "active categories are public" on public.staff_categories
  for select to anon, authenticated using (is_active);
create policy "admin manages categories" on public.staff_categories
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

-- ---- staff_profiles: admin + the staff member themselves.
-- Public/client browsing goes through the staff_catalog view (safe columns only).
create policy "admin manages staff" on public.staff_profiles
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));
create policy "staff reads own profile" on public.staff_profiles
  for select to authenticated using (user_id = (select auth.uid()));

-- ---- clients
create policy "client reads own record" on public.clients
  for select to authenticated using (user_id = (select auth.uid()));
create policy "client updates own record" on public.clients
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "admin manages clients" on public.clients
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

revoke update on public.clients from authenticated;
grant update (name, phone, location_text, lat, lng, kind) on public.clients to authenticated;

-- ---- booking_requests
create policy "client reads own bookings" on public.booking_requests
  for select to authenticated using (client_id in (select private.my_client_ids()));
create policy "client creates pending booking" on public.booking_requests
  for insert to authenticated
  with check (
    client_id in (select private.my_client_ids())
    and status = 'pending'
    and agency_id = (select c.agency_id from public.clients c where c.id = client_id)
  );
create policy "staff reads own placements" on public.booking_requests
  for select to authenticated
  using (staff_id = private.my_staff_id() and status in ('contracted', 'active', 'completed'));
create policy "admin manages bookings" on public.booking_requests
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

-- ---- contract_templates: admin only
create policy "admin manages templates" on public.contract_templates
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

-- ---- contracts: client reads own; signing happens via server-side RPC (phase 3)
create policy "client reads own contracts" on public.contracts
  for select to authenticated
  using (exists (
    select 1 from public.booking_requests b
    where b.id = booking_request_id and b.client_id in (select private.my_client_ids())
  ));
create policy "admin manages contracts" on public.contracts
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

-- ---- payments: written by the server (service role) from M-Pesa/card callbacks
create policy "client reads own payments" on public.payments
  for select to authenticated
  using (exists (
    select 1 from public.contracts ct
    join public.booking_requests b on b.id = ct.booking_request_id
    where ct.id = contract_id and b.client_id in (select private.my_client_ids())
  ));
create policy "admin manages payments" on public.payments
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

-- ---- existing_staff_claims
create policy "client reads own claims" on public.existing_staff_claims
  for select to authenticated using (client_id in (select private.my_client_ids()));
create policy "client files pending claim" on public.existing_staff_claims
  for insert to authenticated
  with check (
    client_id in (select private.my_client_ids())
    and status = 'pending'
    and agency_confirmed_staff_id is null
    and reviewed_by is null
    and agency_id = (select c.agency_id from public.clients c where c.id = client_id)
  );
create policy "admin manages claims" on public.existing_staff_claims
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

-- ---- ratings: a client can only rate staff they actually had (contract or confirmed claim).
create policy "client reads own ratings" on public.ratings
  for select to authenticated using (client_id in (select private.my_client_ids()));
create policy "staff reads own published ratings" on public.ratings
  for select to authenticated using (staff_id = private.my_staff_id() and is_published);
create policy "client rates own staff" on public.ratings
  for insert to authenticated
  with check (
    client_id in (select private.my_client_ids())
    and is_published = false
    and moderated_by is null
    and (
      exists (
        select 1 from public.contracts ct
        join public.booking_requests b on b.id = ct.booking_request_id
        where ct.id = contract_id
          and b.client_id = ratings.client_id
          and b.staff_id = ratings.staff_id
          and ct.status in ('active', 'ended')
      )
      or exists (
        select 1 from public.existing_staff_claims cl
        where cl.id = claim_id
          and cl.client_id = ratings.client_id
          and cl.agency_confirmed_staff_id = ratings.staff_id
          and cl.status = 'confirmed'
      )
    )
  );
create policy "admin manages ratings" on public.ratings
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

-- ---- messaging
create policy "participants read threads" on public.message_threads
  for select to authenticated using (private.can_access_thread(id));
create policy "client opens own thread" on public.message_threads
  for insert to authenticated
  with check (
    client_id in (select private.my_client_ids())
    and agency_id = (select c.agency_id from public.clients c where c.id = client_id)
  );
create policy "admin manages threads" on public.message_threads
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

create policy "participants read messages" on public.messages
  for select to authenticated using (private.can_access_thread(thread_id));
create policy "participants send messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and sender_role = private.my_role()
    and private.can_access_thread(thread_id)
  );

-- ---- notifications
create policy "read own notifications" on public.notifications
  for select to authenticated
  using (
    target_user_id = (select auth.uid())
    or (target_user_id is null and target_role = private.my_role() and agency_id = private.my_agency_id())
  );
create policy "mark own notifications read" on public.notifications
  for update to authenticated
  using (
    target_user_id = (select auth.uid())
    or (target_user_id is null and target_role = private.my_role() and agency_id = private.my_agency_id())
  );
create policy "admin creates notifications" on public.notifications
  for insert to authenticated with check (private.is_admin(agency_id));

revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- ---- audit_log: admin read-only; rows only come from the trigger
create policy "admin reads audit log" on public.audit_log
  for select to authenticated using (private.is_admin(agency_id));
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public read-only views (run as owner, so they expose ONLY these columns)
-- ---------------------------------------------------------------------------

-- Staff catalog: no ID documents, no user ids. Pay rates are hidden from
-- other staff members (spec: staff must never see other staff pay rates).
create view public.staff_catalog
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
  round(sp.lat::numeric, 2)::double precision as approx_lat,   -- ~1 km precision only
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
where sp.is_active and sc.is_active;

grant select on public.staff_catalog to anon, authenticated;

-- Testimonials: published ratings with first name + area only.
create view public.testimonials
with (security_barrier = true)
as
select
  r.id,
  r.agency_id,
  r.stars,
  r.comment,
  split_part(coalesce(c.name, 'Client'), ' ', 1) as client_first_name,
  c.location_text as client_area,
  sc.name as category_name,
  r.created_at
from public.ratings r
join public.clients c on c.id = r.client_id
join public.staff_profiles sp on sp.id = r.staff_id
join public.staff_categories sc on sc.id = sp.category_id
where r.is_published and r.comment is not null and length(trim(r.comment)) > 0;

grant select on public.testimonials to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets
--   staff-photos : public read, admin write
--   staff-docs   : admin only (ID copies, vetting documents)
--   contracts    : admin write; client reads files under contracts/<client_id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('staff-photos', 'staff-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('staff-docs', 'staff-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('contracts', 'contracts', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Object paths are always "<agency_id>/..." so admins only touch their own agency's files.
-- Contract PDFs live at "<agency_id>/<client_id>/<contract_id>.pdf".
create policy "admin writes staff photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'staff-photos' and private.is_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'staff-photos' and private.is_admin(((storage.foldername(name))[1])::uuid));

create policy "admin manages staff docs" on storage.objects
  for all to authenticated
  using (bucket_id = 'staff-docs' and private.is_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'staff-docs' and private.is_admin(((storage.foldername(name))[1])::uuid));

create policy "admin manages contract files" on storage.objects
  for all to authenticated
  using (bucket_id = 'contracts' and private.is_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'contracts' and private.is_admin(((storage.foldername(name))[1])::uuid));

create policy "client reads own contract files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[2] in (select private.my_client_ids()::text)
  );

-- ---------------------------------------------------------------------------
-- Realtime for messaging and notifications
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
