# Going live

These are the steps to put Alicia Staffing Agency on its own domain, with payments and notifications switched on. Most steps are copy-paste. Anything marked **(owner)** needs an account or a decision from the agency.

## 1. Deploy the website to Vercel

1. Sign in at [vercel.com](https://vercel.com) with the GitHub account that owns `aliciastaffingagency-pixel/staffing-agency`, then choose **Add New → Project** and import the repo.
2. Framework preset: **Next.js**. Root directory: the repo root (not `mobile/`). Keep the default build command.
3. Add the environment variables from `.env.example`. At minimum:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_AGENCY_SLUG` | `alicia` |
   | `NEXT_PUBLIC_SITE_URL` | Leave it unset. The production domain is detected automatically, and a leftover `http://localhost:3000` value is ignored on Vercel. Set it only to force a specific domain. |

   `DATABASE_URL` is only needed for migrations from your computer. Don't add it to Vercel.
4. Deploy. Then go to **Settings → Domains** and add your domain **(owner)**.

## 2. Point Supabase at the live site (do this first: sign-up and password reset depend on it)

On 28 September 2026 the **Site URL was still `http://localhost:3000`**. That was tested with a reset link. It means every confirmation or reset email sent to a real user leads to a dead page.

Go to Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://staffing-agency-beta.vercel.app`, and later your own domain. Any page on this address is automatically allowed as a link target.
- **Redirect URLs:** `http://localhost:3000/**` and `http://localhost:3100/**` (local development and tests). Once you have a custom domain, also add the other address: the Vercel one, or the custom one.

Then go to **Authentication → Emails → SMTP settings** and turn on custom SMTP with Resend (see step 4). Supabase's built-in sender only delivers to your own team's addresses and only a few per hour, so real clients never get their emails without this.

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |
| Sender | an address on your verified domain, e.g. `hello@<your-domain>`, name `Alicia Staffing Agency` |

**Test it:** on the live site, click **Log in → Forgot password?** and enter your own email. The link should open the "Choose a new password" page.

How the emails work:
- **Password reset links** carry the session in the link itself, so they work whether they're opened on the same phone or another device. They also work for app users: the page opens on the website, and they then log in to the app with the new password.
- **Sign-up confirmations from the app** land on the website's login page, which tells the person their email is confirmed.

## 3. Payments

### M-Pesa (Daraja STK Push) (owner)

1. Create an app at [developer.safaricom.co.ke](https://developer.safaricom.co.ke) and test it with the sandbox first:
   - `MPESA_ENV=sandbox`
   - `MPESA_SHORTCODE=174379`
   - `MPESA_PASSKEY` = the sandbox passkey
   - `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` from your app
2. Set `MPESA_CALLBACK_SECRET` to a long random string. It becomes part of the callback URL, `https://<your-domain>/api/payments/mpesa/callback?secret=…`, which the app builds automatically.
3. To go live, apply for **Lipa na M-Pesa Online** on your paybill or till. Then set `MPESA_ENV=production` and the production shortcode and passkey.
   - For a **till number** (Buy Goods), also set `MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline` and `MPESA_PARTY_B=<till>`.
4. **Never** set `MPESA_ENV=simulate` in production. The code ignores it there.

Until M-Pesa is connected, clients see instructions to pay the agency number manually. The owner then records each payment on the booking, which marks the placement as paid.

### Cards (Paystack) (owner)

1. Create a Paystack account with KES enabled.
2. Set `PAYSTACK_SECRET_KEY`.
3. In the Paystack dashboard, set the webhook URL to `https://<your-domain>/api/payments/paystack/webhook`.

## 4. Notifications

| Channel | What to do |
| --- | --- |
| Email | Create a [Resend](https://resend.com) account and verify your domain. Set `RESEND_API_KEY` and `EMAIL_FROM="Alicia Staffing Agency <hello@<your-domain>>"`. |
| SMS | Create an [Africa's Talking](https://africastalking.com) account. Set `AFRICASTALKING_USERNAME` and `AFRICASTALKING_API_KEY`, plus `AFRICASTALKING_SENDER_ID` once your sender name is approved. For testing, use username `sandbox`. |
| Push | Works automatically for the mobile app once it's built with EAS (see `mobile/README.md`). |

In-app notifications work without any keys.

## 5. AI features (optional)

Set `ANTHROPIC_API_KEY` to switch Smart match and the website concierge from the built-in rules to Claude. Everything keeps working without it.

## 6. Legal and privacy (owner)

The website has the pages Kenyan law and Google Play expect. They are linked from every page footer, the sign-up form and the app:
- `/privacy`: Privacy Policy, written for the Kenya Data Protection Act, 2019;
- `/terms`: Terms of Service;
- `/cookies`: Cookie Policy (essential cookies only, so it needs a notice, not a consent banner);
- `/refunds`: Refund & Cancellation Policy;
- `/delete-account`: how to delete an account.

They are a solid starting point, not legal advice. Before launch:

- [ ] **Register with the Office of the Data Protection Commissioner** (https://www.odpc.go.ke) as a data controller. An agency that handles ID documents and background checks almost certainly has to. Put the registration number in **Admin → Settings** ("ODPC registration number"), and it appears in the Privacy Policy.
- [ ] Add the agency's **registered business address** there too ("Business address"). It shows in the footer and the policies (today they say "Nairobi, Kenya").
- [ ] **Confirm the promises the policies make:**
  - refunds within **14 days** when we can't provide staff;
  - account deletion within **7 days** when someone asks by email or WhatsApp;
  - keeping contracts and payments for **5 years** (Kenyan tax law);
  - keeping applications, chats and searches for **12 months**.

  Change the pages under `src/app/(site)/` if your practice differs.
- [ ] Ask a **Kenyan advocate** to read the Terms, Privacy and Refund policies once. Tell them about the trial, notice and replacement terms in your contract template.
- [ ] **Staff consent:** a staff profile can only be public once "Has agreed to be shown publicly" is ticked. Keep each person's signed consent on file.

Deleting data:
- **Staff** (Admin → Staff → a profile → Delete) removes their profile, vetting records, reviews, photos, ID documents and login. It also blanks their details in the activity log.
- **Clients** can delete their own account: on the website (Account → Settings) or in the app (Account → Delete my account). The owner can also do it for them (Admin → Client accounts).
- **What is kept:** signed contracts and payment records, with the client's details removed, as the law requires.
- **Applications:** delete them from the application page.

## 7. The mobile app

`mobile/PLAY_STORE.md` walks through publishing on Google Play. It covers:
- the developer account;
- EAS builds;
- the Data safety, content rating and app access answers;
- the store listing text and graphics (in `mobile/store/`);
- a login for Google's reviewers, created with `node scripts/create-review-account.mjs`.

## 8. Before the first real client

- [ ] Do **step 2** (Supabase Site URL and SMTP). Then test sign-up and **Forgot password?** on the live site with your own email.
- [ ] Log in as the owner (`aliciastaffingagency@gmail.com`) and **change the password**.
- [ ] Change the Supabase **database password**. Then update `DATABASE_URL` in your local `.env.local`. If `DATABASE_URL` was ever added to Vercel, delete it there; the website doesn't need it.
- [ ] **Vercel plan:** the free Hobby plan is for non-commercial use only. Move the project to **Pro** before taking real bookings.
- [ ] **Admin → Settings:** check the contract template and confirm the trial period, notice period and replacement policy, then save. The save records that you've confirmed them. The Terms and Refund pages quote these numbers.
- [ ] **Admin → Settings:** fill in the business address and ODPC number, and add real figures for the homepage counters or leave them empty.
- [ ] **Admin → Staff:** add real staff profiles, record their vetting checks, and tick consent to publish.
- [ ] Demo data was removed on 28 September 2026. If you run `node scripts/seed-demo.mjs` for a presentation, remove it again with `node scripts/seed-demo.mjs --remove`.
- [ ] Replace the flyer-cropped photos in `public/brand/`. The hero apron still says "Househelps Bureau".

## 9. Keeping the database in step

Schema changes live in `supabase/migrations/`. From your computer, with `.env.local` filled in:

```bash
npm run db:push        # applies new migrations, then regenerates TypeScript types
node scripts/test-rls.mjs
```
