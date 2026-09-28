-- =============================================================================
-- Phase 3: bookings → contracts → payments.
-- =============================================================================

alter type public.notification_type add value if not exists 'contract_signed';
alter type public.notification_type add value if not exists 'booking_update';

-- What the client pays the agency for this contract (placement / service fee),
-- plus the duties and arrangement written into the contract.
alter table public.contracts
  add column amount_due numeric(12, 2) check (amount_due is null or amount_due >= 0),
  add column duties text,
  add column live_arrangement public.live_arrangement,
  add column ended_at timestamptz,
  add column end_reason text;

alter table public.booking_requests
  add column budget numeric(12, 2) check (budget is null or budget >= 0),
  add column cancelled_reason text;

-- One open contract per booking at a time (older ones must be cancelled first).
create unique index contracts_one_open_per_booking
  on public.contracts (booking_request_id)
  where status not in ('cancelled', 'ended');

create index payments_status_idx on public.payments (agency_id, status, created_at desc);
create index contracts_agency_status_idx on public.contracts (agency_id, status);

-- Card payments are looked up by provider reference from webhooks.
create unique index payments_card_ref_idx on public.payments (card_ref) where card_ref is not null;

-- Clients may cancel their own booking while nothing is signed yet.
create policy "client cancels own open booking" on public.booking_requests
  for update to authenticated
  using (client_id in (select private.my_client_ids()) and status in ('pending', 'matched'))
  with check (client_id in (select private.my_client_ids()) and status = 'cancelled');
grant update (status, cancelled_reason) on public.booking_requests to authenticated;
-- (admins keep full update rights through the table-level grant from the grants migration)

-- The staff member assigned to a placement can see the client's name and area.
create policy "staff reads clients of own placements" on public.clients
  for select to authenticated
  using (exists (
    select 1 from public.booking_requests b
    where b.client_id = clients.id
      and b.staff_id = private.my_staff_id()
      and b.status in ('contracted', 'active', 'completed')
  ));

-- ---------------------------------------------------------------------------
-- Default contract template. Values in `defaults` are PLACEHOLDERS until the
-- owner confirms their real trial / notice / replacement terms in
-- Admin → Contract template (each save creates a new version).
-- ---------------------------------------------------------------------------
insert into public.contract_templates (agency_id, version, name, body, defaults)
select a.id, 1, 'Standard placement agreement',
$body$STAFF PLACEMENT AGREEMENT

This agreement is made on {{contract_date}} between {{agency_name}} ("the Agency") and {{client_name}} of {{client_location}} ("the Client").

1. PLACEMENT
The Agency places {{staff_name}} ("the Staff Member") with the Client as a {{staff_role}}, starting on {{start_date}}. Arrangement: {{live_arrangement}}.

2. DUTIES
{{duties}}

3. PAY
The Client agrees to pay the Staff Member {{rate}} per {{rate_period}}, paid on time and in full. Pay, hours and days off must meet Kenyan employment law.

4. AGENCY FEE
The Client pays the Agency a placement fee of {{amount_due}}. The placement is confirmed once this fee is received.

5. TRIAL PERIOD
The first {{trial_period_days}} days are a trial period. During the trial either party may end the placement with notice to the Agency.

6. REPLACEMENT POLICY
If the Staff Member leaves or is not suitable within {{replacement_window_days}} days of the start date, the Agency will provide up to {{max_replacements}} replacement(s) at no extra placement fee, subject to availability.

7. NOTICE
After the trial period, either the Client or the Staff Member gives {{notice_period_days}} days' notice to end the placement, and informs the Agency.

8. CONDUCT AND SAFETY
The Client provides a safe working environment, fair treatment, and (for live-in placements) decent accommodation and meals. The Staff Member follows the household's reasonable instructions and the Agency's code of conduct.

9. DISPUTES
Any concern is raised with the Agency first, through the Client's account or by phone, so the Agency can mediate.

10. SIGNATURES
Signed electronically by typing full names. Each signature is recorded with the date, time and IP address.$body$,
jsonb_build_object(
  'trial_period_days', 14,
  'notice_period_days', 14,
  'replacement_window_days', 90,
  'max_replacements', 2,
  'confirmed_by_owner', false
)
from public.agencies a
where a.slug = 'alicia'
on conflict (agency_id, version) do nothing;
