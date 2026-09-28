-- =============================================================================
-- Phase 5: leads (from the website concierge) and AI-match query log
-- (demand signal for analytics, including searches that found nobody).
-- =============================================================================

create type public.lead_status as enum ('new', 'contacted', 'converted', 'closed');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text,
  phone text,
  email text,
  need text not null check (length(need) between 2 and 1000),
  area text,
  start_date text,
  budget text,
  source text not null default 'concierge' check (source in ('concierge', 'match', 'contact')),
  transcript jsonb,
  status public.lead_status not null default 'new',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_agency_idx on public.leads (agency_id, status, created_at desc);
create trigger set_updated_at before update on public.leads for each row execute function private.set_updated_at();
create trigger audit_changes after insert or update or delete on public.leads for each row execute function private.audit_row_change();

create table public.match_queries (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  query text not null check (length(query) <= 1000),
  category_slug text,
  area text,
  results int not null default 0,
  engine text not null check (engine in ('ai', 'rules')),
  created_at timestamptz not null default now()
);
create index match_queries_agency_idx on public.match_queries (agency_id, created_at desc);

alter table public.leads enable row level security;
alter table public.match_queries enable row level security;
create policy "admin manages leads" on public.leads
  for all to authenticated using (private.is_admin(agency_id)) with check (private.is_admin(agency_id));
create policy "admin reads match queries" on public.match_queries
  for select to authenticated using (private.is_admin(agency_id));

-- Written by the server (service role) only.
grant select, update, delete on public.leads to authenticated;
grant select on public.match_queries to authenticated;
grant select, insert, update, delete on public.leads, public.match_queries to service_role;
grant usage, select on all sequences in schema public to service_role;
