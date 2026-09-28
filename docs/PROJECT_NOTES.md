# Alicia Staffing Agency — project notes

Living handoff document. Read this first when picking the project up in a new session.
The original product brief is in `docs/BUILD_BRIEF.md` (phases 1–7).

## What this is

A web platform (mobile app comes in Phase 6) for **Alicia Staffing Agency**, a Kenyan domestic and business staffing agency.
The agency owner lists vetted staff. Clients (households or businesses) use it to browse, book, sign contracts, pay (M-Pesa or card) and rate staff online. Today, competing agencies do all of this by phone.

- **Brand:** taken from the client's flyer (`public/brand/flyer.jpg`). The colours are magenta `#D61F7A`, navy `#1C1F4A` and gold `#D4A43A` on cream. It uses a crown and heart motif, Poppins for text, and Dancing Script for script accents.
- **Contact:** +254 726 407 535 (call and WhatsApp), aliciastaffingagency@gmail.com.
- **Staff roles are not hardcoded.** They live in the `staff_categories` table, and the owner edits them. The icon picker list is in `src/components/category-icon.tsx`.

## Stack

| Layer | Choice |
| --- | --- |
| Web | Next.js **16** (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, Motion (formerly Framer Motion) |
| Backend | Supabase: Postgres with RLS, Auth, Storage, Realtime (project `czjftlowmqjnulinnwaq`, region eu-west-1) |
| Maps | Leaflet with react-leaflet and OpenStreetMap tiles, loaded client-only |
| Validation | zod in server actions |

**Next.js 16 differences:**
- Middleware is now `src/proxy.ts`.
- `cookies()`, `params` and `searchParams` are async.
- Read `node_modules/next/dist/docs/` before using an unfamiliar API.

## Running it

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build (also type-checks)
npm run db:push        # apply supabase/migrations/* to the remote DB, then regenerate types
npm run db:types       # regenerate src/lib/supabase/database.types.ts from the live schema
node scripts/test-rls.mjs              # end-to-end RLS checks (creates and deletes temp users)
node scripts/create-admin.mjs <email>  # create or promote a super_admin
```

Secrets are in `.env.local`, which git ignores. `.env.example` lists every variable.

**Database connection:** the direct host `db.czjftlowmqjnulinnwaq.supabase.co` only works over IPv6, and this network can't reach it. Use the **session pooler** `aws-1-eu-west-1.pooler.supabase.com:5432` with the user `postgres.czjftlowmqjnulinnwaq`. `DATABASE_URL` in `.env.local` already uses it.

**Types:** `supabase gen types` needs Docker, which isn't installed. `scripts/gen-types.mjs` builds the same types directly from the database catalog instead.

**API grants:** this Supabase project does **not** auto-grant new tables to the `anon`, `authenticated` or `service_role` roles. Every new table needs explicit `grant` statements in its migration (see `20260928100300_api_grants.sql`), or the API returns "permission denied".

## Accounts

- **Owner / super_admin:** `aliciastaffingagency@gmail.com`. It was created with a one-time password that was shared in chat. **Change it after the first login.** Run `node scripts/create-admin.mjs <email>` to add or promote another admin.
- **Roles** are stored in `profiles.role` (`super_admin` | `staff` | `client`). Every signup becomes a `client` through the `on_auth_user_created` trigger. Any role in signup metadata is ignored, and the RLS tests confirm this. Only the service role can grant `super_admin` or `staff`.

## Data model (see `supabase/migrations/`)

| Table | Purpose |
| --- | --- |
| `agencies` | Tenant record. Holds `brand` JSON (colours) and `settings` JSON (`service_area_label`, `map_center`, `stats`). |
| `profiles` | One row per auth user: role and agency. |
| `staff_categories` | Service categories the admin can edit. |
| `staff_profiles` | Staff records, created only by the admin. Covers badges, rates, vetting and rating aggregates. |
| `clients` | Household or business clients, one per user per agency. |
| `booking_requests` | Status flow: pending → matched → contracted → active → completed/cancelled. |
| `contract_templates`, `contracts` | Template plus signed instance: typed-name signature, timestamp and IP. |
| `payments` | M-Pesa or card. Written server-side from callbacks. |
| `existing_staff_claims` | Client says they already employ someone; the admin confirms, which unlocks rating. |
| `ratings` | Only allowed for staff the client actually had. Unpublished until the admin moderates it. |
| `message_threads`, `messages` | Client ↔ admin chat. Realtime is enabled. |
| `notifications` | Targeted at a user or a role. Realtime is enabled. |
| `audit_log` | A trigger writes every change to the key tables. Only admins can read it. |

**Views:**
- `staff_catalog` is the public-safe staff list. It has no ID documents, rounds locations to about 1 km, and hides pay rates from other staff.
- `testimonials` shows published ratings with only the client's first name and area.

**Storage buckets:**
- `staff-photos`: public.
- `staff-docs`: admin only.
- `contracts`: admin, plus the owning client.

Object paths must start with `<agency_id>/`. Contract PDFs are stored at `<agency_id>/<client_id>/<file>.pdf`.

The design is **multi-tenant ready:** every business table has an `agency_id`, and RLS checks it through `private.is_admin(agency_id)`.

## Status

### Phase 1 — Foundation ✅ (2026-09-28)
- [x] Schema, RLS, grants, triggers, views and storage buckets, pushed to Supabase
- [x] Seed data: the agency record plus 11 categories
- [x] Auth: email and password, email magic link, signup (household/business, phone), callback and sign-out routes
- [x] Role areas: `/admin` (overview, categories, recent audit activity), `/account` (client), `/staff-portal` (read-only), and `/dashboard`, which sends each role to its area
- [x] Public site: landing page (hero, values, services grid from the DB, how it works, trust badges, stats when set, testimonials when present, map and contact, CTA), `/services`, `/services/[slug]` (staff from `staff_catalog`, or a WhatsApp CTA when there's none), and a floating WhatsApp button
- [x] RLS end-to-end tests: 22/22 pass
- [x] Production build passes

### Phase 2 — Staff catalog, admin CRUD & jobs board ✅ (2026-09-28)
- [x] `/admin/categories`: add, rename, describe, pick icon, reorder, hide/show, delete (blocked while staff are in it)
- [x] `/admin/staff`: list with search/filters; create/edit/deactivate; photo + ID uploads go **browser → Supabase Storage** (avoids Vercel's 4.5 MB body limit); map pin location picker; optional staff login invite
- [x] **Vetting checks drive badges** (`staff_vetting_checks` + trigger): ID verified → Verified; references + background check → Background-checked; training → Trained. Badge/rating columns can't be written through the API.
- [x] Public catalog `/staff` (filters: role, area, live-in/out, budget band, availability, keyword) and profile pages `/staff/[id]` (badges, rates, video intro, published reviews via `staff_reviews` view)
- [x] **Jobs board (owner request, added mid-build):** `/admin/jobs` to post vacancies with required documents; public `/jobs`, `/jobs/[id]` and `/jobs/apply` (general application). Applicants need no account, upload documents to the private `applications` bucket via signed upload URLs, and choose **"Join the agency as a member"** or **"Agree my own terms"** (preferred terms + expected pay). `/admin/applications` to review, add notes, change status, open documents, and **convert to a staff profile** (copies details + ID document).
- [x] Postgres-backed rate limiter (`hit_rate_limit` RPC) on public endpoints; honeypot on the application form
- [x] Tests: `node scripts/test-rls.mjs` (37 checks) and Playwright `npm run e2e` (needs `npm run dev -- -p 3100` running)

### Phases 3–7
See `docs/BUILD_BRIEF.md`:
- Phase 3: bookings, contracts, M-Pesa and notifications.
- Phase 4: ratings, messaging and claims.
- Phase 5: trust features, AI and analytics.
- Phase 6: Expo mobile app.
- Phase 7: hardening and deployment.

## Open items for the owner

1. **Supabase Auth settings** (Dashboard → Authentication):
   - **URL Configuration:** set the Site URL to the live domain once deployed. Add `http://localhost:3000/**` and the live domain `/**` to the Redirect URLs.
   - **Email:** Supabase's built-in email sender is heavily rate-limited, and on new projects it may only deliver to team members. Until custom SMTP is set up (Resend, Phase 3), either turn off "Confirm email" for testing or expect confirmation emails not to arrive.
   - **Phone OTP login:** needs an SMS provider. Africa's Talking isn't built in; it needs a "Send SMS" auth hook (planned).
2. **Marketing numbers:** the animated counters ("500+ staff placed", etc.) only appear once real figures are saved in `agencies.settings.stats`, e.g. `[{"label":"Staff placed","value":500,"suffix":"+"}]`. We don't publish invented numbers.
3. **Trust badge wording:** check that the copy on the landing page ("National ID confirmed in person", "References called", "Completed our training") matches the real vetting process. It's in `src/components/landing/sections.tsx` (`TRUST`).
4. **Contract terms:** trial period, notice period and replacement policy are needed for the Phase 3 template.
5. **Security:** change the database password (the current one is weak and has been shared in chat), then update `DATABASE_URL`.
6. **Photos:** the hero and service photos are cropped from the flyer (`scripts/crop-flyer.mjs`). The apron in the hero still says "Househelps Bureau". Replace it with real photos when available.
