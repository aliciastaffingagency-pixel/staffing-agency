-- =============================================================================
-- Explicit table privileges for the API roles.
-- This project does not auto-grant new tables to anon/authenticated/service_role,
-- so every table is granted here with least privilege. RLS policies still decide
-- which ROWS each user can touch; these grants decide which OPERATIONS/COLUMNS.
-- =============================================================================

-- Server-side code using the service role key (webhooks, admin scripts).
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Anonymous visitors: public marketing data only.
grant select on public.agencies, public.staff_categories to anon;
-- (staff_catalog and testimonials views were granted in the RLS migration.)

-- Signed-in users: read everything RLS lets them see.
grant select on all tables in schema public to authenticated;

-- Admin-managed tables (RLS restricts writes to the agency's super_admin).
grant update on public.agencies to authenticated;
grant insert, update, delete on
  public.staff_categories,
  public.staff_profiles,
  public.booking_requests,
  public.contract_templates,
  public.contracts,
  public.payments,
  public.existing_staff_claims,
  public.ratings,
  public.message_threads
to authenticated;

-- Tables where regular users insert their own rows (RLS checks ownership).
grant insert on public.messages, public.notifications to authenticated;

-- Column-restricted self-service updates (role/agency/user_id can never change via the API).
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant update (name, phone, location_text, lat, lng, kind) on public.clients to authenticated;
grant update (read) on public.notifications to authenticated;
