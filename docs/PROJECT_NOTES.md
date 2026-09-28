# Alicia Staffing Agency — project notes

Living handoff document. Read this first when picking the project up in a new session.
The original product brief is in `docs/BUILD_BRIEF.md` (phases 1–7).

## What this is

A web platform plus an Expo mobile app (`mobile/`) for **Alicia Staffing Agency**, a Kenyan domestic and business staffing agency.
The agency owner lists vetted staff. Clients (households or businesses) use it to browse, book, sign contracts, pay (M-Pesa or card) and rate staff online. Today, competing agencies do all of this by phone.

- **Brand:** taken from the client's flyer (`public/brand/flyer.jpg`). The colours are magenta `#D61F7A`, navy `#1C1F4A` and gold `#D4A43A` on cream. It uses a crown and heart motif, Poppins for text, and Dancing Script for script accents.
- **Contact:** +254 726 407 535 (call and WhatsApp), aliciastaffingagency@gmail.com.
- **Live:** https://staffing-agency-beta.vercel.app (Vercel project `staffing-agency`, team "Alicia agency"). Every push to `main` deploys to production automatically.
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
node scripts/create-review-account.mjs # client login for Google Play / App Store reviewers (prints the password once)
node scripts/app-icons.mjs             # regenerate the mobile icons, splash and Play Store graphics from the logo
```

Secrets are in `.env.local`, which git ignores. `.env.example` lists every variable.

**Database connection:** the direct host `db.czjftlowmqjnulinnwaq.supabase.co` only works over IPv6, and this network can't reach it. Use the **session pooler** `aws-1-eu-west-1.pooler.supabase.com:5432` with the user `postgres.czjftlowmqjnulinnwaq`. `DATABASE_URL` in `.env.local` already uses it.

**Types:** `supabase gen types` needs Docker, which isn't installed. `scripts/gen-types.mjs` builds the same types directly from the database catalog instead.

**API grants:** this Supabase project does **not** auto-grant new tables to the `anon`, `authenticated` or `service_role` roles. Every new table needs explicit `grant` statements in its migration (see `20260928100300_api_grants.sql`), or the API returns "permission denied".

## Accounts

- **Owner / super_admin:** `aliciastaffingagency@gmail.com`. On 2026-09-28 the password was set to one the owner chose in chat, and live sign-in was verified. **Before real clients arrive, change it to a long, unique password** (Supabase → Authentication → Users). Never commit it. Run `node scripts/create-admin.mjs <email>` to add or promote another admin.
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
| `staff_vetting_checks` | ID, references, background and training checks confirmed by the admin. A trigger derives the three badges and `vetting_status` from them. |
| `vacancies`, `job_applications` | Jobs board. Applications are written by the server only (rate-limited). Their documents are in the private `applications` bucket. |
| `leads` | Callback requests captured by the website concierge |
| `match_queries` | Every Smart match search, including ones with no results. Feeds the analytics. |
| `push_tokens` | Expo push tokens for the mobile app, one per device |

**Views:**
- `staff_catalog` is the public-safe staff list. It has no ID documents, rounds locations to about 1 km, and hides pay rates from other staff.
- `testimonials` shows published ratings with only the client's first name and area.

**Storage buckets:**
- `staff-photos`: public.
- `staff-docs`: admin only.
- `contracts`: admin, plus the owning client.
- `applications`: admin reads only. Applicants upload through short-lived signed upload URLs.

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

### Phase 3 — Bookings, contracts, payments, notifications ✅ (2026-09-28)
- [x] `/book` (from any staff profile or service page): choosing a service **lists the people available in it** as cards to pick from, or "Let the agency choose for me"; start date, live-in/out, area, budget, job notes. Sign-up/login round-trips back via `?next=`.
- [x] `/admin/bookings`: tabs (needs action / contracted / active / closed); booking page to confirm or assign staff, generate the contract from the active template, countersign, record manual payments (M-Pesa/bank/cash/card), withdraw contract, end placement, cancel
- [x] Contracts: template with `{{placeholders}}` (Admin → Settings, versioned; starter terms flagged until the owner saves them), typed-name e-signature with timestamp + IP, PDF generated with pdf-lib into the private `contracts` bucket
- [x] State machine in `lib/contracts.ts#advanceContract`: sent → client_signed → fully_signed → active (both signed + fee paid). Booking → contracted on client signature, → active when paid; staff marked placed / available again when the placement ends
- [x] Payments (`lib/payments.ts`): M-Pesa Daraja STK Push + callback `/api/payments/mpesa/callback?secret=…` (idempotent, amount-checked) + STK query fallback; Paystack card checkout + signed webhook `/api/payments/paystack/webhook`. Without keys, clients see manual-payment instructions and the admin records payments. `MPESA_ENV=simulate` = local testing only.
- [x] `/admin/payments`: outstanding invoices, received this month / all time, awaiting signature, full ledger
- [x] Notifications: in-app bell with Supabase Realtime in every portal; email (Resend) and SMS (Africa's Talking) sent after the response once keys are set
- [x] `/admin/settings`: agency details, homepage counters (real figures only), contract template editor
- [x] e2e: full request → pick staff → match → contract → sign → M-Pesa callback → countersign → active → end flow, plus cross-client isolation

### Phase 4 — Ratings, messaging, claims, moderation ✅ (2026-09-28)
- [x] Ratings: clients rate staff (1–5 stars + comment) from an active/ended placement or a confirmed claim; one review per placement; reviews stay private until the owner publishes them (`/admin/moderation`); rating averages update by trigger; published reviews show on staff profiles and in the staff portal
- [x] Messaging: client ↔ agency conversations with Supabase Realtime (`/account/messages`, `/admin/messages`), unread counts in the nav, resolve/reopen
- [x] Requests on a placement: replacement, issue/dispute, extend, end contract. Each opens a conversation and alerts the owner (SMS for replacements and disputes)
- [x] "Staff already working for me" claims (`/account/staff`): the owner confirms against an existing profile or creates a hidden one; confirmation unlocks rating and replacement requests
- [x] Staff portal: placements (with client name and area) and own published reviews
- [x] Fixes: thread SELECT policy (RETURNING visibility) and guard trigger so clients can only mark threads read
- [x] Tests: 45 RLS checks; e2e for rating → moderation → public, replacement request + live two-way chat, claims

### Phase 5 — Trust, AI and growth ✅ (2026-09-28)
- [x] Trust badges tied to admin-confirmed vetting checks (built in Phase 2)
- [x] **Smart match** (`/match`): clients describe their need in plain language. With `ANTHROPIC_API_KEY` set, Claude (`claude-opus-5`, tool use via the SDK tool runner, server-side refusal fallback `fallbacks: "default"`) searches live availability with a `search_staff` tool and submits a ranked shortlist with one-line reasons (ids validated server-side). Without a key (or on any API error) a transparent rules engine ranks by role synonyms, distance (area gazetteer), live-in/out, budget, skills, languages, badges and ratings. Every query is logged to `match_queries`.
- [x] **Website concierge** (chat bubble on every public page, `/api/concierge`): answers only from real agency facts (services, live pay ranges, contract terms, contacts) and captures callback leads (`save_lead` tool → `leads` table + owner SMS/in-app alert). Rules-mode FAQ + phone-number lead capture without a key. Rate-limited per IP.
- [x] `/admin/leads`: callback list with call/WhatsApp buttons and status (new → contacted → converted/closed)
- [x] `/admin/analytics` (30/90/365 days): conversion funnel, fees by month, demand map (requests + unmatched searches by area), demand by role, **searches that found nobody** (recruiting signal), top-rated staff, retention/churn (placements ended within trial, average length, replacements, disputes)
- [ ] Optional items not built: GPS shift check-in/out, in-app micro-training, referral programme (see "Ideas" below)

### Phase 6 — Mobile app (Expo SDK 57) ✅ (2026-09-28)
- [x] `mobile/`: Expo Router app. Sign-in and sign-up use `Stack.Protected`. Tabs: Find staff, Smart match, My hires, Messages, Account. Other screens:
  - staff profile
  - request (choose a service, then pick an available person or let the agency choose)
  - booking detail (progress, contract, sign, M-Pesa pay, rate, replacement/issue/extend/end requests)
  - live chat (Realtime)
- [x] The session is stored with `expo-sqlite` localStorage, as the Expo Supabase guide recommends. Database types are imported type-only from the web app.
- [x] Web API for the app. It shares code with the website through `src/lib/services/client-ops.ts` and `src/lib/services/match.ts`, so the web and the app behave identically.
  - `POST /api/mobile/{bookings|sign|pay|threads|messages|ratings|push-token}`: Bearer = the user's Supabase access token, and RLS applies.
  - `POST /api/match`
- [x] Expo push: `push_tokens` table. `notify()` sends Expo pushes alongside in-app, email and SMS notifications, and prunes dead tokens.
- [x] Verified:
  - `npx tsc --noEmit`, `npx expo lint`, and `npx expo-doctor` (21/21)
  - `npx expo export --platform android` bundles
  - `e2e/phase6-mobile-api.spec.ts` covers auth, booking, push-token registration, a conversation and smart match
- [ ] **Owner:** run `npx eas-cli@latest init` and a development build to try it on a phone (see `mobile/README.md`)

### Phase 7 — Hardening & deployment ✅ (2026-09-28)
- [x] Rate limiting on every public or abusable endpoint: applications, uploads, match, concierge, bookings, messages, threads, M-Pesa prompts. zod validation on all inputs.
- [x] Security headers (`next.config.ts`): HSTS, nosniff, frame DENY, referrer and permissions policies, no `X-Powered-By`.
- [x] Admin portal uses a grouped sidebar on large screens (Clients / Staffing / Business). Phones keep a scrolling menu.
- [x] Demo data: `node scripts/seed-demo.mjs` adds 12 vetted staff, 2 vacancies, and a demo client (`demo.client@aliciastaffing.test`) with six placements over recent months and published reviews. The client's password is new on every run and printed once, because the repo is public. `--remove` deletes only what the script created (everything is owned by `demo-seed@aliciastaffing.test`). **The demo data was removed on 2026-09-28 at the owner's request.** The live database now holds only the owner's account and the real setup (agency, categories, contract template).
- [x] `docs/DEPLOYMENT.md`: Vercel, Supabase URLs and SMTP, M-Pesa, Paystack, Resend, Africa's Talking, and a go-live checklist.
- [x] Tests: `node scripts/test-rls.mjs` (45 checks) and `npm run e2e` (10 flows) both pass. The production build passes.
- [x] Deployed on Vercel (https://staffing-agency-beta.vercel.app). The keys are added as they arrive; see `docs/DEPLOYMENT.md`.

### Speed ✅ (2026-09-28)
- [x] `vercel.json` pins functions to **`dub1` (Dublin)**, next to the Supabase database in eu-west-1. Before this, every query crossed the Atlantic, from Washington, and took 1–2 s per page.
- [x] Public pages are pre-rendered and cached on the CDN (ISR, `revalidate = 300`): home, services, staff profiles and jobs. They read through the cookie-free `createPublicClient()`, and the header works out whether someone is signed in in the browser (`HeaderAuth`). Admin changes refresh them straight away with `revalidatePath('/', 'layout')`.
- [x] The proxy (session refresh) only runs on signed-in areas.
- Locally, pages feel slow for a different reason: each database round trip from this PC to Ireland takes 0.6–1 s. That is also why the e2e `expect` timeout is 45 s.

### Phase 8 — Privacy, legal and Google Play readiness ✅ (2026-09-28)
Requested by the owner: delete the demo data, delete staff properly, add forgot password, cover the legal requirements, and prepare for the Google Play audit.
- [x] **Deletion that removes everything:** `src/lib/services/erasure.ts`.
  - **Staff** (Admin → Staff → Delete, confirmed by typing their name): profile, vetting checks, reviews, photos, ID documents and login. Matched bookings go back to the queue. Blocked while they are on an active placement.
  - **Job applications:** the row and its documents.
  - **Client accounts:** by the client (web Account → Settings, app Account, `POST /api/mobile/delete-account`) or by the owner (Admin → Client accounts). Signed contracts and payments are kept, but the client record is anonymised (`clients.deleted_at`, login detached). Everything else about them is deleted.
  - **Activity log:** entries about deleted people are redacted by `redact_audit_entries()`, which only the service role can call. The action history stays.
- [x] **Data rights:** `/account/settings` lets clients edit their details. `/account/export` downloads everything held about them as JSON.
- [x] **Consent:** staff profiles only go public once `staff_profiles.publish_consent_at` is recorded. The `staff_catalog` view enforces this. Sign-up requires agreeing to the Terms and Privacy Policy, stored as `profiles.terms_accepted_at` by the sign-up trigger.
- [x] **Forgot password:** web (`/forgot-password` → `/reset-password`) and app.
  - Reset emails use the implicit flow, so the link carries the session and works on any device. `ResetGate` reads it from the URL fragment.
  - `AuthLinkHandler` (root layout) forwards reset links that fall back to the home page, and removes tokens from the address bar.
- [x] **Legal pages** (`src/app/(site)/`):
  - `/privacy` (Kenya Data Protection Act 2019), `/terms`, `/cookies`, `/refunds`, `/delete-account` (the Google Play deletion page) and `/account-deleted`;
  - links to them in the footer, at sign-up, on the booking form and in the application declaration;
  - an essential-cookies notice;
  - business address and ODPC number fields in Admin → Settings.
- [x] **Mobile / Google Play:**
  - branded icons (`scripts/app-icons.mjs`);
  - blocked permissions (storage, camera, microphone, location, overlay, advertising ID);
  - `eas.json`;
  - forgot password, sign-up consent, legal links, and in-app account deletion.

  `mobile/PLAY_STORE.md` has every Play Console answer (Data safety, content rating, app access, listing). `scripts/create-review-account.mjs` creates the reviewer login.
- [x] **Pre-launch cleanup:** activity-log entries about test and demo records that no longer exist were purged (933 rows). The 15 real setup entries remain.
- [x] **Tests:**
  - RLS: 48 checks, including consent in the catalog and only the server being able to redact.
  - e2e: `e2e/phase8-privacy-legal.spec.ts` covers the legal pages, sign-up consent, forgot and reset password, deleting staff, applications and client accounts (web, app and admin), and the data export.

## Testing notes
- The RLS script and e2e tests run against the **live** Supabase project. They create temporary users (`e2e-…@example.test`, `rls-…@example.test`) and records tagged with a run tag: a digit, a letter a–f, then four hex characters, e.g. `Grace Wanjiru 3fa9c1`. Teardown removes all of it: users, client records, bookings, contracts, payments, reviews, vacancies, applications, uploaded files, owner notifications and search-log rows. Each run also sweeps anything an interrupted earlier run left behind. Real names and messages never contain such a token, so real data isn't touched.
  - **Activity log:** entries written during the run about records that no longer exist are removed. Entries about records that still exist are never touched.
  - **Deleting a login doesn't remove its client record:** `clients.user_id` is `on delete set null`, so signed contracts can be kept. Scripts that delete test users must delete their `clients` rows first; the teardown, the RLS script and the seed script already do.
- Pre-launch test clutter (notifications, searches, files) was cleared from the live database on 2026-09-28.
- Once real clients are on the platform, create a separate Supabase **staging** project for tests. Point a copy of `.env.local` at it and run `npm run db:push` there first.
- The e2e suite needs the dev server on port 3100 (`npm run dev -- -p 3100`) and `MPESA_ENV=simulate` in `.env.local`, which is local only.

## Ideas not built (optional extras from the brief)
- GPS shift check-in/out for drivers, cleaners and gardeners
- In-app micro-training modules with completion badges
- A referral programme, and loyalty tiers for recurring clients
- Phone-number (OTP) login. This needs an SMS "Send SMS" auth hook with Africa's Talking.

## Open items for the owner

1. **Supabase Auth settings (urgent; blocks real sign-ups and password resets).** On 2026-09-28 the Site URL was verified to still be `http://localhost:3000`, and email confirmation is required. Set both in Dashboard → Authentication:
   - **URL Configuration:** set **Site URL** to `https://staffing-agency-beta.vercel.app` (or the custom domain later); any path on it is then allowed. Add the **Redirect URLs** `http://localhost:3000/**` and `http://localhost:3100/**`.
   - **Email:** the built-in sender only delivers to the project team and only a few per hour. Set up custom SMTP with Resend; `docs/DEPLOYMENT.md` step 2 has the values.

   With a Supabase personal access token in `.env.local` (`SUPABASE_ACCESS_TOKEN`), a developer can set all of this through the Management API.
2. **Legal:** register with the ODPC, then fill in the business address and ODPC number in Admin → Settings. Confirm the promises in the policies (14-day refunds, 7-day deletion on request, retention periods), and have a Kenyan advocate review the pages. See `docs/DEPLOYMENT.md` step 6.
3. **Google Play:** create a developer account (an organisation account needs a D-U-N-S number; a personal one needs 12 testers for 14 days) and an Expo account. Set up Firebase for Android push. Everything else is in `mobile/PLAY_STORE.md`.
4. **Vercel plan:** Hobby is for non-commercial use only; move to Pro before taking real bookings.
5. **Marketing numbers:** the animated counters ("500+ staff placed", etc.) only appear once real figures are saved in `agencies.settings.stats`, e.g. `[{"label":"Staff placed","value":500,"suffix":"+"}]`. We don't publish invented numbers.
6. **Trust badge wording:** check that the copy on the landing page ("National ID confirmed in person", "References called", "Completed our training") matches the real vetting process. It's in `src/components/landing/sections.tsx` (`TRUST`). The Play Store description makes the same claims.
7. **Contract terms:** the template uses placeholder terms (14-day trial, 14 days' notice, 2 free replacements within 90 days). Confirm or change them in **Admin → Settings** and save. The Terms and Refund pages quote them.
8. **Keys to add when ready** (see `docs/DEPLOYMENT.md`): M-Pesa Daraja, Paystack, Resend, Africa's Talking, and optionally `ANTHROPIC_API_KEY`. Everything works without them in a manual/rules mode.
9. **Security:** change the owner's login password, and the database password (weak and shared in chat); then update `DATABASE_URL`.
10. **Photos:** the hero and service photos are cropped from the flyer (`scripts/crop-flyer.mjs`). The apron in the hero still says "Househelps Bureau". Replace it with real photos when available.
11. **Phone OTP login** (optional): needs an SMS "Send SMS" auth hook with Africa's Talking.
