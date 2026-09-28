# Alicia Staffing: mobile app (Expo)

The client app for Alicia Staffing Agency, for Android and iOS. It covers:

- **Find staff:** browse vetted staff who are available now, filtered by service.
- **Smart match:** describe who you need in plain words and get a ranked shortlist.
- **Request staff:** pick a service, then choose one of the people available in it, or let the agency choose.
- **My hires:** track progress, read and sign the contract, pay the agency fee by M-Pesa, rate staff, and request a replacement, report an issue, or extend or end the contract.
- **Messages:** live chat with the agency.
- **Push notifications:** matches, contracts, payments and replies.

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

After `eas init`, the app registers each device's Expo push token after sign-in. The website sends pushes through Expo's push service, alongside the in-app, email and SMS notifications. It needs no extra keys. For iOS, add push credentials when EAS prompts you during `eas build`.

## Releasing

```bash
npx eas-cli@latest build --platform android --profile production   # Play Store .aab
npx eas-cli@latest build --platform ios --profile production       # App Store
npx eas-cli@latest submit --platform android                       # upload to Play Console
npx eas-cli@latest update --branch production                      # over-the-air JS updates
```

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

Database types come straight from the web app (`../src/lib/supabase/database.types.ts`, a type-only import). When the database changes, run `npm run db:types` at the repo root, and the app picks up the new types.
