-- =============================================================================
-- Alicia Staffing Agency — core schema
-- Multi-tenant ready: every business table carries agency_id.
-- =============================================================================

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('super_admin', 'staff', 'client');
create type public.client_kind as enum ('household', 'business');
create type public.live_arrangement as enum ('live_in', 'live_out', 'either');
create type public.staff_availability as enum ('available', 'placed', 'unavailable');
create type public.vetting_status as enum ('pending', 'in_review', 'verified', 'rejected');
create type public.booking_status as enum ('pending', 'matched', 'contracted', 'active', 'completed', 'cancelled');
create type public.contract_status as enum ('draft', 'sent', 'client_signed', 'fully_signed', 'active', 'ended', 'cancelled');
create type public.rate_period as enum ('day', 'month');
create type public.payment_method as enum ('mpesa', 'card', 'cash', 'bank');
create type public.payment_status as enum ('pending', 'processing', 'paid', 'failed', 'refunded');
create type public.claim_status as enum ('pending', 'confirmed', 'rejected');
create type public.notification_type as enum (
  'new_request', 'matched', 'contract_ready', 'payment_received',
  'rating_submitted', 'replacement_requested', 'dispute_raised'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text,
  phone text,
  whatsapp text,
  email text,
  brand jsonb not null default '{}'::jsonb,     -- colours, logo url, fonts
  settings jsonb not null default '{}'::jsonb,  -- marketing stats, service areas, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per auth user. Role is never taken from user input.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete restrict,
  role public.user_role not null default 'client',
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_agency_idx on public.profiles (agency_id);

create table public.staff_categories (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  icon text,                 -- lucide icon name, chosen by the admin
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, slug)
);
create index staff_categories_agency_idx on public.staff_categories (agency_id, sort_order);

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete set null,  -- optional staff login
  category_id uuid not null references public.staff_categories (id) on delete restrict,
  full_name text not null,
  photo_url text,
  video_url text,
  bio text,
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  location_text text,
  lat double precision,
  lng double precision,
  availability public.staff_availability not null default 'available',
  live_arrangement public.live_arrangement not null default 'either',
  day_rate numeric(12, 2),
  month_rate numeric(12, 2),
  years_experience int,
  vetting_status public.vetting_status not null default 'pending',
  id_doc_url text,
  verified_badge boolean not null default false,
  trained_badge boolean not null default false,
  background_checked_badge boolean not null default false,
  rating_avg numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index staff_profiles_agency_idx on public.staff_profiles (agency_id, is_active);
create index staff_profiles_category_idx on public.staff_profiles (category_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  phone text,
  email text,
  location_text text,
  lat double precision,
  lng double precision,
  kind public.client_kind not null default 'household',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, user_id)
);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  staff_id uuid references public.staff_profiles (id) on delete set null,
  category_id uuid references public.staff_categories (id) on delete set null,
  status public.booking_status not null default 'pending',
  live_arrangement public.live_arrangement,
  start_date date,
  location_text text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_target check (staff_id is not null or category_id is not null)
);
create index booking_requests_client_idx on public.booking_requests (client_id);
create index booking_requests_staff_idx on public.booking_requests (staff_id);
create index booking_requests_agency_status_idx on public.booking_requests (agency_id, status);

create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  version int not null,
  name text not null,
  body text not null,                               -- template text with {{placeholders}}
  defaults jsonb not null default '{}'::jsonb,      -- trial period, notice period, replacement policy
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (agency_id, version)
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  booking_request_id uuid not null references public.booking_requests (id) on delete restrict,
  template_id uuid references public.contract_templates (id) on delete set null,
  template_version int,
  terms_json jsonb not null default '{}'::jsonb,
  rate numeric(12, 2),
  rate_period public.rate_period,
  starts_on date,
  ends_on date,
  client_signature text,
  client_signed_at timestamptz,
  client_ip inet,
  admin_signature text,
  admin_signed_at timestamptz,
  admin_signed_by uuid references auth.users (id) on delete set null,
  pdf_url text,
  status public.contract_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contracts_booking_idx on public.contracts (booking_request_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  contract_id uuid not null references public.contracts (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'KES',
  method public.payment_method not null,
  payer_phone text,
  mpesa_checkout_request_id text unique,
  mpesa_receipt text unique,
  card_ref text,
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_contract_idx on public.payments (contract_id);

create table public.existing_staff_claims (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  staff_full_name_freeform text not null,
  staff_phone_freeform text,
  notes text,
  agency_confirmed_staff_id uuid references public.staff_profiles (id) on delete set null,
  status public.claim_status not null default 'pending',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index existing_staff_claims_client_idx on public.existing_staff_claims (client_id);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  contract_id uuid references public.contracts (id) on delete set null,
  claim_id uuid references public.existing_staff_claims (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete cascade,
  staff_id uuid not null references public.staff_profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text,
  is_published boolean not null default false,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rating_source check (contract_id is not null or claim_id is not null)
);
create index ratings_staff_idx on public.ratings (staff_id);

create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  booking_request_id uuid references public.booking_requests (id) on delete set null,
  subject text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index message_threads_client_idx on public.message_threads (client_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  sender_role public.user_role not null,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (thread_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  type public.notification_type not null,
  message text not null,
  link text,
  target_user_id uuid references auth.users (id) on delete cascade,
  target_role public.user_role,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notification_target check (target_user_id is not null or target_role is not null)
);
create index notifications_user_idx on public.notifications (target_user_id, read);
create index notifications_role_idx on public.notifications (agency_id, target_role, read);

create table public.audit_log (
  id bigint generated always as identity primary key,
  agency_id uuid references public.agencies (id) on delete cascade,
  actor_id uuid,
  action text not null,
  target_table text not null,
  target_id text,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_agency_idx on public.audit_log (agency_id, created_at desc);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array[
    'agencies', 'profiles', 'staff_categories', 'staff_profiles', 'clients',
    'booking_requests', 'contracts', 'payments', 'existing_staff_claims'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end $$;
