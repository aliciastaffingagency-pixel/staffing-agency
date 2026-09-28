# Domestic & Home Staffing Agency Platform — Build Brief

> This is the original brief the owner supplied at kickoff, kept here for reference. Decisions made since then are recorded in `PROJECT_NOTES.md`:
> - The name became **Alicia Staffing Agency**.
> - The build uses Next.js 16 rather than 14.
> - Phone OTP login is deferred until an SMS hook exists.

## 1. Naming
"Alicia Househelps Bureau" only covers house helps. The agency also staffs house boys, shamba boys, drivers, house managers, chefs, cooks and shop attendants, plus any other role the admin adds. The brand should therefore read as a full staffing house.

- **Final choice: Alicia Staffing Agency**
- Alternatives that were considered: Alicia StaffHub, BomaCrew, Nyumba Network, Kazi Nyumbani

## 2. Market notes
- **SweepSouth (South Africa):** home-size-based pricing, plus a mode for Airbnb hosts. Worth copying: pricing tiers and a short-let host mode.
- **Mama Fua (Eldoret):** worker earnings drive retention. The staff experience matters: fair pay, visible ratings and steady bookings.
- **SafiSafi (Kenya):** on-demand hourly booking from KES 300/hr. This could be a secondary mode alongside permanent placement.
- **Nairobi agencies** (Bestcare, VikMac Ajiralink, Outsource Pro EA): all work through a website plus phone calls, with identity, reference and skills checks. **None lets a client self-serve end to end.** That gap is this product.
- **CDTD Homecare Hub:** about KES 850/day or KES 15,000/month. Useful as a price anchor.

**What all of them are missing:**
- Self-service booking and contract signing
- A filterable staff catalog with verified badges and ratings
- An in-app dispute and replacement flow
- M-Pesa payments
- Real trust signals

## 3. Feature set

### Public site
- A landing page in the flyer's style: pink, navy and gold, a crown motif, and the trust badges Trained, Verified, and Trusted & Ready to Serve.
- Service categories shown as cards. The admin can extend the list; it isn't hardcoded.
- Search and filter by role, location, availability, live-in/live-out and price band.
- A testimonials and ratings preview, a WhatsApp/Call CTA, and a "Serving all areas" map.

### Client (household or business)
- Sign up and browse staff profiles (photo, skills, experience, languages, location, availability, background-check status, rating).
- Request or book staff → digital contract (terms, trial period, replacement policy) → e-signature → pay (M-Pesa STK push or card).
- Manage active hires: message the agency, request a replacement, extend or end a contract.
- Rate and review staff, and see the history of past hires.
- Claim existing staff: register someone already working for them. The agency confirms, which unlocks rating and replacement requests.

### Agency owner / admin
- Add, edit and deactivate staff profiles: bio, photo, ID and vetting documents, skills, category, location, availability, pay rate, references.
- Add new staff categories and roles at any time.
- Review requests, assign staff, and generate and send contracts.
- Track placements, handle replacement requests, and moderate ratings and disputes.
- A payments dashboard: owed, paid, and outstanding invoices.
- Analytics: demand by category and location, top-rated staff, churn, and the funnel from inquiry to signed contract.

### Staff (optional login, controlled by the agency)
- See their own placements, schedule and ratings (read-only).
- Staff can't list themselves; only the admin creates or edits profiles.

## 4. Trust, payments and contracts
- **Contracts:** a stored template filled with the client, staff and rate details, e-signed with a typed name, timestamp and IP. DocuSign can come later.
- **Payments:**
  - M-Pesa Daraja STK Push is the primary method, with Paystack or Flutterwave for cards.
  - The client pays the agency; staff are paid separately offline.
  - The platform records what's owed and paid.
- **Vetting badges:** Verified, Trained and Background-Checked.
- **Notifications:**
  - Events: new request, staff matched, contract ready, payment received, rating submitted, replacement requested, dispute raised.
  - Each goes to whichever role acts next.
- **Audit trail:** every profile, category, contract and payment change is logged with who made it and when.

## 5. Ideas to get ahead of local competitors
- AI matching from a plain-language request
- An AI concierge chat that answers FAQs and qualifies leads
- 20–30 second video intros on staff profiles
- GPS shift check-in and check-out, shown to the client as a status
- Micro-training modules that award certification badges
- A demand heatmap for recruiting
- A referral program and loyalty tiers
- A multi-tenant, white-label-ready architecture

## 6. Stack
- **Web:** Next.js, TypeScript, Tailwind CSS and Framer Motion, hosted on Vercel
- **Mobile:** React Native (Expo), sharing the Supabase client and types
- **Backend:** Supabase (Postgres with RLS, Auth, Storage, Realtime)
- **Payments:** M-Pesa Daraja, plus Paystack or Flutterwave
- **Notifications:** Africa's Talking (SMS), Resend (email), WhatsApp Business API or Twilio (or a plain `wa.me` link at launch)
- **Maps:** Leaflet, loaded with SSR-safe dynamic imports
- **AI:** the Anthropic API, or Groq
- **Ops:** GitHub Actions, Sentry (error tracking), PostHog

## 7. Build phases

**Phase 1 — Foundation:**
- Schema and RLS for all tables
- Auth for all three roles
- The public marketing site: landing page, category grid, testimonials, Call/WhatsApp CTA, service-area section

**Phase 2 — Staff catalog & admin CRUD:**
- Admin CRUD for staff and categories, including live category editing
- Uploads to Storage
- The client-facing catalog with filters, profile pages and badges

**Phase 3 — Booking, contracts, payments:**
- The booking flow, then admin matching, then a contract generated from the template with e-signature and a PDF
- M-Pesa STK Push, with card as a fallback
- The payments dashboard
- SMS and email notifications

**Phase 4 — Ratings, messaging, claims:**
- Post-placement ratings
- Existing-staff claims
- Realtime messaging
- A moderation queue, plus replacement and dispute handling

**Phase 5 — Trust, AI, growth:**
- Badge logic
- AI matching (Anthropic API with tool use)
- AI concierge
- Analytics and heatmap
- Optional: GPS check-in, micro-training, referral program

**Phase 6 — Mobile (Expo):**
- Client flows ported to the app
- Push notifications
- Admin stays web-only, or gets a light mobile view

**Phase 7 — Hardening & deployment:**
- RLS review:
  - A client never sees another client's contracts or payments.
  - Staff never see other staff members' pay.
- Rate limiting and input validation
- Seed and demo data
- Deploy to Vercel and document the Expo builds

## 8. Design language
- **Palette and tone:** from the flyer. Pink/magenta, navy and gold. Crown and heart motifs used sparingly, never childish.
- **Shapes:** rounded pill buttons and badges.
- **Photography:** a warm lifestyle style.
- **Type:** bold sans headings, with a script accent for the brand name.
- **Animation:**
  - The hero entrance
  - Staff cards lifting on hover
  - Animated stat counters (using real numbers only)
  - Smooth page transitions
  - A testimonial carousel

**Never hardcode the staff roles.** Categories are a database table that the admin edits.

## 9. Setup checklist
- [x] Name confirmed: Alicia Staffing Agency
- [x] Supabase project and keys
- [x] GitHub repo: aliciastaffingagency-pixel/staffing-agency (private)
- [ ] M-Pesa Daraja developer account and keys (sandbox first)
- [ ] Africa's Talking account
- [ ] Resend account (also fixes Supabase auth email limits via SMTP)
- [ ] WhatsApp route: Business API or `wa.me` (`wa.me` is used for now)
- [ ] Domain name
- [ ] 2–3 real staff profiles with photos, and the real contract terms
