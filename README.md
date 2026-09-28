# Alicia Staffing Agency

Alicia Staffing Agency is a Kenyan domestic and business staffing platform. Clients find vetted staff, request them, sign a digital contract, pay by M-Pesa or card, and rate the staff afterwards, all online. The agency owner manages staff, vetting, job vacancies and applications, bookings, contracts, payments, reviews and analytics.

- **Handoff notes, status and open items:** [docs/PROJECT_NOTES.md](docs/PROJECT_NOTES.md)
- **Going live (Vercel, Supabase, M-Pesa, SMS, email):** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Mobile app (Expo):** [mobile/README.md](mobile/README.md)
- **Original product brief:** [docs/BUILD_BRIEF.md](docs/BUILD_BRIEF.md)

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase keys and DATABASE_URL
npm run dev                  # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the local dev server |
| `npm run build` | Production build, including the type check |
| `npm run db:push` | Applies `supabase/migrations`, then regenerates the DB types |
| `npm run db:types` | Regenerates `src/lib/supabase/database.types.ts` |
| `node scripts/test-rls.mjs` | Row-level-security checks against the live database (makes and removes temporary users) |
| `npm run e2e` | Browser end-to-end tests. Needs `npm run dev -- -p 3100` running |
| `node scripts/seed-demo.mjs` | Loads demo staff, vacancies and a demo client for presentations. `--remove` deletes them |
| `node scripts/create-admin.mjs <email>` | Creates or promotes a super admin |

Built with Next.js 16, Supabase, Tailwind CSS v4 and Motion. The mobile app uses Expo SDK 57.
