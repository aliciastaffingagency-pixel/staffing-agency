# Publishing the app on Google Play

Everything Google Play asks for, with the answers for this app. Work through it top to bottom. Steps marked **(owner)** need your own Google or Expo account.

## Already done in the app

- **Branding:** the icon, Android adaptive icon (including the themed/monochrome version), notification icon and splash screen all use the Alicia logo. `node scripts/app-icons.mjs` (run from the repo root) regenerates them.
- **Android version:** targets Android 16 (API 36) and runs on Android 7 (API 24) and newer. Google Play requires API 35 or higher for new apps.
- **Permissions:** only the ones the app needs: internet, network state, vibration, notifications (asked for when needed) and restoring notifications after a restart.
  - Storage, camera, microphone, location, "draw over other apps" and the advertising ID are removed at build time (`android.blockedPermissions` in `app.json`).
- **Account deletion:** in the app (Account → Delete my account) and on the web at https://staffing-agency-beta.vercel.app/delete-account. Google requires both.
- **Legal:** the Privacy Policy and Terms are linked on the sign-in and sign-up screens and under Account. Clients agree to them when they sign up, and the date is recorded.
- **Forgot password** is on the sign-in screen.
- **No ads, tracking or in-app purchases:** there are no ads, no analytics or tracking tools, and nothing is sold through Google Play.
- **Store graphics:** in `mobile/store/`:
  - `play-icon-512.png`: the 512 × 512 app icon;
  - `feature-graphic-1024x500.png`: the banner.

## 1. One-time setup

1. **(owner) Create a Google Play developer account** at https://play.google.com/console/signup. It costs US$25 once. Google checks your identity before you can publish.
   - **Organisation account:** use this if the agency is a registered business. You need a free D-U-N-S number from Dun & Bradstreet, which takes a few days. Organisation accounts can publish to the public straight away.
   - **Personal account:** it must first run a closed test with at least 12 testers for 14 days in a row. Only then can it publish to the public.
2. **(owner) Create a free Expo account** at https://expo.dev/signup. Expo's EAS service builds the app. Then, in `mobile/`:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init   # links the project and adds its ID to app.json (commit that change)
   ```
3. **Give the build servers the Supabase settings.** The app's `.env` file stays on your computer. The values are the same public ones the website uses (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`):
   ```bash
   npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://<project-ref>.supabase.co" --environment production --environment preview --environment development --visibility plaintext
   npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>" --environment production --environment preview --environment development --visibility plaintext
   ```
   The website address (`EXPO_PUBLIC_API_URL`) and agency slug are already set in `eas.json`. When you move to your own domain, change `EXPO_PUBLIC_API_URL` there.
4. **(owner) Set up push notifications for Android.** They go through Firebase Cloud Messaging:
   - Create a Firebase project.
   - Add an Android app with the package name `ke.aliciastaffing.app`.
   - Download its `google-services.json`.
   - Create an FCM V1 service-account key.

   Then follow Expo's "Push notifications setup" guide: point `android.googleServicesFile` in `app.json` at the file, and upload the key with `npx eas-cli@latest credentials`. Until this is done, the app works but phones get no push alerts. In-app, email and SMS notifications still work.

## 2. Build

```bash
cd mobile
npx eas-cli@latest build --platform android --profile preview      # an APK to install on your own phone
npx eas-cli@latest build --platform android --profile production   # the .aab file for Google Play
```

Install the preview APK on a phone. Try every screen, and take the store screenshots (see step 5).

Every production build gets a higher build number automatically. For a release people will notice, also raise `version` in `app.json`, e.g. to `1.1.0`.

## 3. Create the app in Play Console

**Create app** →
- **App name:** Alicia Staffing
- **Default language:** English (United Kingdom)
- **App or game:** App
- **Free or paid:** Free

Tick the declarations.

Upload the first `.aab` by hand: **Test and release → Testing → Internal testing → Create new release**, then add yourself as a tester. After that, `npx eas-cli@latest submit --platform android` can upload later builds. It needs a Google service-account key; see Expo's "Submit to the Google Play Store" guide.

## 4. App content (Policy → App content)

| Section | Answer |
| --- | --- |
| **Privacy policy** | `https://staffing-agency-beta.vercel.app/privacy` (switch to your own domain later) |
| **App access** | "All or some functionality is restricted". See the reviewer login below. |
| **Ads** | No, the app has no ads. |
| **Advertising ID** | No, the app does not use it. |
| **Content rating** | Use the answers below the table. |
| **Target audience** | 18 and over only. The app is not designed for children. |
| **News app** | No |
| **Government app** | No |
| **Financial features** | "My app doesn't provide any financial features". Clients pay the agency's fee for a real-world service (staffing) with M-Pesa. That isn't a financial product, and Google Play Billing isn't used for real-world services. |
| **Health** | Not a health app |
| **Data safety** | See section 4a. |

**Content rating questionnaire.** Choose the category that fits a service/utility app (not a game), then answer:
- Violence, sexual content, bad language, drugs, gambling: all **No**.
- Can users interact or exchange messages? **Yes**, clients chat with the agency.
- Shares the user's location with others? **No**.
- Sells digital goods? **No**.

The expected result is a rating suitable for everyone, with a "Users interact" note.

**Reviewer login.** Google's reviewers need a working client login. Email confirmation is skipped for this one account. From the repo root, run:
```bash
node scripts/create-review-account.mjs
```
It prints an email address and a password. Paste them into App access with this note:
> Log in on the first screen. You can browse staff, use Smart match, request staff, message the agency and see bookings. Signing a contract and paying need a booking the agency has matched, which a new account won't have.

Delete the account in **Admin → Client accounts** once the app is approved.

### 4a. Data safety form

**Overview**
- Does the app collect or share user data? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS only)
- Does the app let people create an account? **Yes**, with a username (email) and password.
- **Delete account URL:** `https://staffing-agency-beta.vercel.app/delete-account`
- Can users ask to delete some of their data without deleting the account? **Yes**, by emailing or WhatsApp-ing the agency (Privacy Policy, "Your rights").

**Data collected.** Every type below is **collected**, **not shared**, and **not processed ephemerally**.

| Google's data type | Required or optional | Purposes | What it is |
| --- | --- | --- | --- |
| Personal info → Name | Required | App functionality, Account management | Name on the account |
| Personal info → Email address | Required | App functionality, Account management | Login and booking emails |
| Personal info → Phone number | Required | App functionality, Account management | M-Pesa payments and SMS updates |
| Personal info → Address | Optional | App functionality | The area where the staff will work |
| Financial info → Purchase history | Optional | App functionality | Agency fees paid and M-Pesa receipts |
| Messages → Other in-app messages | Optional | App functionality | Chat with the agency |
| App activity → In-app search history | Optional | App functionality, Analytics | Smart match requests |
| App activity → Other user-generated content | Optional | App functionality | Reviews of staff, and reports about a placement |
| Device or other IDs | Optional | App functionality | The push-notification token for the phone |

**Not collected:**
- location (the app never reads GPS);
- photos, videos, audio, contacts and calendar;
- files (job applicants upload documents on the website, not in the app);
- web browsing;
- health;
- crash logs and diagnostics.

**Why "not shared".** Two kinds of transfer happen, and Google doesn't count either as sharing:
- **Service providers:** the agency's providers handle data on its behalf. They are Supabase (database), Vercel (website), Safaricom M-Pesa, and the email and SMS senders.
- **The hired staff member:** giving a client's name and area to the person they hire is the service the client asked for.

If you ever add advertising, analytics, or a partner who uses the data for their own purposes, update this form and the Privacy Policy first.

## 5. Store listing (Grow users → Store presence → Main store listing)

**App name** (30 characters max): `Alicia Staffing`

**Short description** (80 characters max):
> Hire vetted house helps, nannies & staff in Kenya. Book, sign & pay by M-Pesa.

**Full description:**
> Alicia Staffing Agency connects Kenyan homes and businesses with trained, vetted staff: house helps, nannies, cleaners, caregivers, cooks and chefs, drivers, gardeners, shop attendants and security guards.
>
> WHY ALICIA
> • Vetted people: we confirm national IDs in person, call references and run background checks. Each profile shows which checks the person has passed.
> • Honest reviews: only clients who actually hired someone can rate them, and we check every review before it is published.
> • Clear terms: a written contract with a trial period, notice period and replacements, signed on your phone.
>
> WHAT YOU CAN DO IN THE APP
> • Browse staff who are available now, by service, area, live-in or live-out and budget.
> • Smart match: describe who you need in your own words and get a shortlist.
> • Request staff: pick the person yourself or let the agency choose.
> • Sign your contract and pay the agency fee with M-Pesa.
> • Chat with the agency, ask for a replacement, or extend or end a placement.
> • Get notified when you're matched, when your contract is ready and when a payment goes through.
>
> Your data stays private: no ads, and we never sell it. You can download or delete your data at any time.
>
> Questions? Call or WhatsApp +254 726 407 535, or email aliciastaffingagency@gmail.com.

Before you publish, check that the vetting sentence matches what you actually do. It must stay true.

**Graphics**
- **App icon:** `mobile/store/play-icon-512.png`
- **Feature graphic:** `mobile/store/feature-graphic-1024x500.png`
- **Phone screenshots:** 2 to 8, portrait (9:16), taken from the preview build. Good choices are Find staff, a staff profile, Request staff, My hires and Messages. Use at least 1080 px wide so Google can feature them.

**Category and contact**
- **Category:** House & Home (or Business).
- **Email:** aliciastaffingagency@gmail.com
- **Phone:** +254 726 407 535
- **Website:** https://staffing-agency-beta.vercel.app

## 6. Release

1. **Internal testing:** install from the Play link. With a spare account, check sign-up, forgot password, a booking, messages and **Delete my account**.
2. **Closed testing** (personal accounts only): run it with at least 12 testers for 14 days, then apply for production access in Play Console.
3. **Production:** create a release from the tested build and roll it out.

## Before every release

- [ ] The website is deployed. The app relies on its API.
- [ ] In `mobile/`, run `npx tsc --noEmit`, `npx expo lint` and `npx expo-doctor`; all should pass.
- [ ] You tried the preview build on a real phone.
- [ ] Screenshots still match the app.
- [ ] Data safety answers are still true: no new kinds of data, and no new SDKs that collect data.

## These must work for real users

Sign-up confirmation and password-reset emails need two Supabase settings. See `docs/DEPLOYMENT.md`, step 2:
- **Site URL:** as of 28 September 2026 it is still `http://localhost:3000`, so email links from the live site don't work yet.
- **Email sending (SMTP):** it isn't set up yet. Supabase's built-in sender only delivers to your team's own addresses.
