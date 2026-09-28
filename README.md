# Alicia Staffing Agency

This platform lets clients browse, book, contract, pay for and rate vetted home and business staff.
The agency owner manages the staff catalog, categories, placements and payments.

- **Handoff notes, status and open items:** [docs/PROJECT_NOTES.md](docs/PROJECT_NOTES.md)
- **Full product brief and phase plan:** [docs/BUILD_BRIEF.md](docs/BUILD_BRIEF.md)

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
| `node scripts/test-rls.mjs` | End-to-end row-level-security checks |
| `node scripts/create-admin.mjs <email>` | Creates or promotes a super admin |

Built with Next.js 16, Supabase, Tailwind CSS v4 and Motion.
