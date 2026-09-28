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
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` |

   `DATABASE_URL` is only needed for migrations from your computer. Don't add it to Vercel.
4. Deploy. Then go to **Settings → Domains** and add your domain **(owner)**.

## 2. Point Supabase at the live site

Go to Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://<your-domain>`
- **Redirect URLs:** `https://<your-domain>/**` and `http://localhost:3000/**`

Then go to **Authentication → Emails → SMTP settings** and plug in Resend's SMTP details (see step 4). Supabase's built-in mailer only sends a handful of emails per hour.

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

## 6. Before the first real client

- [ ] Log in as the owner (`aliciastaffingagency@gmail.com`) and **change the password**.
- [ ] Change the Supabase **database password**. Then update `DATABASE_URL` in your local `.env.local`.
- [ ] **Admin → Settings:** check the contract template and confirm the trial period, notice period and replacement policy, then save. The save records that you've confirmed them.
- [ ] **Admin → Settings:** add real figures for the homepage counters, or leave them empty.
- [ ] **Admin → Staff:** add real staff profiles and record their vetting checks.
- [ ] If you ran `node scripts/seed-demo.mjs` for a presentation, remove the demo data with `node scripts/seed-demo.mjs --remove`.
- [ ] Replace the flyer-cropped photos in `public/brand/`. The hero apron still says "Househelps Bureau".

## 7. Keeping the database in step

Schema changes live in `supabase/migrations/`. From your computer, with `.env.local` filled in:

```bash
npm run db:push        # applies new migrations, then regenerates TypeScript types
node scripts/test-rls.mjs
```
