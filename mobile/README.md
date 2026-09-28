# Alicia Staffing: mobile app (Expo)

The client app for Alicia Staffing Agency, for Android and iOS. It covers:

- **Find staff:** browse vetted staff who are available now, filtered by service.
- **Smart match:** describe who you need in plain words and get a ranked shortlist.
- **Request staff:** pick a service, then choose one of the people available in it, or let the agency choose.
- **My hires:** track progress, read and sign the contract, pay the agency fee by M-Pesa, rate staff, and request a replacement, report an issue, or extend or end the contract.
- **Messages:** live chat with the agency.
- **Push notifications:** matches, contracts, payments and replies.
- **Account and privacy:** forgot password, agreeing to the Terms and Privacy Policy at sign-up, links to both, downloading your data (on the website) and deleting your account in the app.

The app uses the same Supabase project and row-level security as the website. Work that needs the server (e-signature with IP capture, M-Pesa prompts, notifications) goes through the website's JSON API at `/api/mobile/*` and `/api/match`. Clients get the same rules and behaviour on the web and in the app.

The agency owner's admin tools stay on the website.

## Setup

```bash
cd mobile
npm install
cp .env.example .env      # fill in the Supabase URL + anon key and the website URL
npx expo start            # scan the QR code with a development build (see below)
```

| Variable | What |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | The same public values as the website's `NEXT_PUBLIC_*` |
| `EXPO_PUBLIC_API_URL` | The deployed website, e.g. `https://aliciastaffing.co.ke`. For local testing on a phone, use your computer's LAN address (`http://192.168.x.x:3000`). |
| `EXPO_PUBLIC_AGENCY_SLUG` | `alicia` |

The app uses native modules (SQLite session storage and notifications), so run it in a **development build**, not Expo Go:

```bash
npx eas-cli@latest login
npx eas-cli@latest init                       # creates the EAS project (needed for push tokens)
npx eas-cli@latest build --profile development --platform android
```

## Push notifications

After `eas init`, the app registers each device's Expo push token after sign-in. The website sends pushes through Expo's push service, alongside the in-app, email and SMS notifications. The website needs no extra keys. The builds do:
- **Android:** Firebase Cloud Messaging credentials (see `PLAY_STORE.md`, step 1).
- **iOS:** add push credentials when EAS prompts you during `eas build`.

## Releasing

`eas.json` has three build profiles:
- `development`: a dev client for `npx expo start`;
- `preview`: an installable APK for testing on phones;
- `production`: the store build. Build numbers are managed by EAS and go up automatically.

Build servers don't see your `.env` file. The Supabase URL and anon key are stored as EAS environment variables (`PLAY_STORE.md`, step 1), and the website URL is in `eas.json`.

```bash
npx eas-cli@latest build --platform android --profile preview      # APK for testing
npx eas-cli@latest build --platform android --profile production   # Play Store .aab
npx eas-cli@latest build --platform ios --profile production       # App Store
npx eas-cli@latest submit --platform android                       # upload to Play Console (after the first manual upload)
```

**Google Play:** `PLAY_STORE.md` covers every Play Console answer: data safety, content rating, app access, store listing and the release checklist.

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

App icons, the notification icon, the splash image and the store graphics are generated from the logo: run `node scripts/app-icons.mjs` at the repo root.

Database types come straight from the web app (`../src/lib/supabase/database.types.ts`, a type-only import). When the database changes, run `npm run db:types` at the repo root, and the app picks up the new types.
