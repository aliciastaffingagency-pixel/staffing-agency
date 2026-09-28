-- =============================================================================
-- Vacancies (jobs board) + job applications.
-- The owner posts vacancies; anyone can apply (no account needed) and upload
-- the required documents. Applicants choose to join the agency as a member or
-- to agree their own terms with the owner. Accepted applicants can be turned
-- into staff profiles by the admin.
-- =============================================================================

create type public.vacancy_status as enum ('draft', 'open', 'closed', 'filled');
create type public.employment_type as enum ('full_time', 'part_time', 'contract', 'temporary', 'casual');
create type public.application_status as enum ('new', 'reviewing', 'shortlisted', 'interview', 'accepted', 'rejected', 'withdrawn');
create type public.engagement_preference as enum ('join_agency', 'own_terms');

alter type public.notification_type add value if not exists 'new_application';

create table public.vacancies (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  category_id uuid references public.staff_categories (id) on delete set null,
  title text not null check (length(title) between 3 and 120),
  description text not null check (length(description) between 10 and 5000),
  requirements text,
  location_text text,
  employment_type public.employment_type not null default 'full_time',
  live_arrangement public.live_arrangement not null default 'either',
  pay_min numeric(12, 2) check (pay_min is null or pay_min >= 0),
  pay_max numeric(12, 2) check (pay_max is null or pay_max >= 0),
  pay_period public.rate_period not null default 'month',
  positions int not null default 1 check (positions between 1 and 500),
  -- e.g. {"National ID", "CV", "Certificate of good conduct"}
  required_documents text[] not null default '{}',
  closes_on date,
  status public.vacancy_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_range check (pay_min is null or pay_max is null or pay_min <= pay_max)
);
create index vacancies_agency_status_idx on public.vacancies (agency_id, status);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  vacancy_id uuid references public.vacancies (id) on delete set null,  -- null = general application
  applicant_user_id uuid references auth.users (id) on delete set null,
  full_name text not null check (length(full_name) between 2 and 120),
  phone text not null,
  email text,
  location_text text,
  date_of_birth date,
  years_experience int check (years_experience is null or years_experience between 0 and 60),
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  cover_note text check (cover_note is null or length(cover_note) <= 3000),
  engagement public.engagement_preference not null,
  preferred_terms text check (preferred_terms is null or length(preferred_terms) <= 2000),
  expected_pay numeric(12, 2) check (expected_pay is null or expected_pay >= 0),
  expected_pay_period public.rate_period,
  -- [{ "label": "National ID", "path": "<agency>/<upload_token>/<file>", "name": "id.pdf", "size": 12345 }]
  documents jsonb not null default '[]'::jsonb,
  consent_at timestamptz not null default now(),
  status public.application_status not null default 'new',
  admin_notes text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  staff_id uuid references public.staff_profiles (id) on delete set null,  -- set when converted to staff
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_applications_agency_status_idx on public.job_applications (agency_id, status, created_at desc);
create index job_applications_vacancy_idx on public.job_applications (vacancy_id);

create trigger set_updated_at before update on public.vacancies
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.job_applications
  for each row execute function private.set_updated_at();
create trigger audit_changes after insert or update or delete on public.vacancies
  for each row execute function private.audit_row_change();
create trigger audit_changes after insert or update or delete on public.job_applications
  for each row execute function private.audit_row_change();

alter table public.vacancies enable row level security;
alter table public.job_applications enable row level security;

create policy "open vacancies are public" on public.vacancies
  for select to anon, authenticated using (status = 'open' and (closes_on is null or closes_on >= current_date));
create policy "admin manages vacancies" on public.vacancies
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

-- Applications are submitted through the server (service role) so uploads can be
-- verified and rate-limited. Signed-in applicants can read their own.
create policy "applicant reads own applications" on public.job_applications
  for select to authenticated using (applicant_user_id = (select auth.uid()));
create policy "admin manages applications" on public.job_applications
  for all to authenticated
  using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));

grant select on public.vacancies to anon;
grant select, insert, update, delete on public.vacancies to authenticated, service_role;
grant select, update, delete on public.job_applications to authenticated;
grant select, insert, update, delete on public.job_applications to service_role;

-- Private bucket for applicant documents: only the admin reads; uploads use
-- short-lived signed upload URLs minted by the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('applications', 'applications', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "admin reads application files" on storage.objects
  for select to authenticated
  using (bucket_id = 'applications' and private.is_admin(((storage.foldername(name))[1])::uuid));
create policy "admin deletes application files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'applications' and private.is_admin(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------------
-- Fixed-window rate limiter for public endpoints (called with the service role).
-- ---------------------------------------------------------------------------
create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits int not null
);

create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_hits int;
begin
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;

  -- Opportunistic cleanup of stale keys.
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end;
$$;

revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
