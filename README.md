# Oddity

A daily multi-mode random roll scoring game. Roll, collect badges, chase EP (Entropy Points).

Inspired by rngdle.com's daily-number-and-badges loop, extended with a Number Mode, Letter Mode, and four more minigames (Dice, Cards, Coordinates, Time Capsule) that all feed into one shared EP/rarity progression system.

## Structure

```
oddity/
├── package.json              # Next.js + TypeScript + Tailwind + Prisma
├── prisma/schema.prisma      # User / Mode / Roll / Badge / RollBadge data model
├── .env.example               # DATABASE_URL + Neon Auth config — copy to .env and fill in
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page — server-authoritative daily rolls for the signed-in user
│   │   ├── globals.css        # Tailwind entrypoint
│   │   ├── auth/
│   │   │   ├── sign-in/       # Sign-in form + server action
│   │   │   └── sign-up/       # Sign-up form + server action
│   │   └── api/
│   │       ├── auth/[...path]/route.ts   # Neon Auth (Managed Better Auth) handler
│   │       └── roll/[modeId]/route.ts    # Server-authoritative roll endpoint
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── rolls.ts           # getOrCreateDailyRoll() — the one-roll-per-user-per-day enforcement
│   │   └── auth/
│   │       ├── server.ts      # Neon Auth server instance (session, sign-up/in, route handler)
│   │       └── client.ts      # Neon Auth client instance (for client components)
│   ├── modes/
│   │   ├── types.ts           # Shared engine contract: Badge, ScoreResult, ModeEngine,
│   │   │                        tier EP ranges, gradeBadge(), combo system, seeded PRNG
│   │   ├── dice.ts            # Dice Mode — full graded + combo implementation
│   │   ├── cards.ts           # Card Mode — full graded + combo implementation
│   │   ├── coordinates.ts     # Coordinate Mode — full graded + combo implementation
│   │   ├── timecapsule.ts     # Time Capsule Mode — full graded + combo implementation
│   │   └── index.ts           # Mode registry — Number/Letter Mode plug in here later
│   └── data/
│       ├── capitals.ts        # ~40 capital cities for Coordinate Mode's proximity badges
│       └── notableDates.ts    # Curated dates for Time Capsule's Historical Echo badge
```

Number Mode and Letter Mode aren't built yet — they need a bundled word list and a hex-word list as data assets first. They plug into `src/modes/index.ts` the same way the other four do once ready.

## Auth

Identity is handled by [Neon Auth (Managed Better Auth)](https://neon.com/docs/auth/overview) — no separate auth provider or `next-auth`. Users, sessions, and OAuth config live in the `neon_auth` schema inside your Neon Postgres database; our own `User` table (see `prisma/schema.prisma`) only holds app-specific profile data (`totalEp`, `streak`, `homeLat`/`homeLon`) keyed by that same user id.

To enable it on your Neon project: **Console → Project → Branch → Auth → Enable Auth**, then copy the Auth URL from the Configuration tab into `NEON_AUTH_BASE_URL`.

## Getting started

```bash
npm install
cp .env.example .env    # fill in DATABASE_URL and Neon Auth values (see .env.example)
npm run db:push         # creates tables from prisma/schema.prisma
npm run dev             # http://localhost:3000
```

Sign up at `/auth/sign-up`, then the home page rolls all four built modes for that day, server-side, and persists them — reloading or resubmitting never changes the result (see `src/lib/rolls.ts`).

## Design docs (not part of the code, for reference while building the rest)

These aren't in this repo but were produced alongside it — consider adding them under `/docs` so future contributors have the reasoning, not just the numbers:
- **Build prompt** — original full-game spec (all modes, architecture, UX notes)
- **Scoring category research (v3)** — 50+ categories per mode across all six modes, tiered Common→Mythic
- **EP balancing pass** — the tier EP ranges (`TIER_RANGES` in `types.ts`) and how every category's base EP was derived
- **Grading + combos** — how `gradeBadge()` and the combo system work, and which remaining categories are good candidates to convert from flat to graded

## Still to build

- Number Mode + Letter Mode engines (need word-list / hex-word data)
- Leaderboard + profile pages
- Share-card image generation (`@vercel/og` or `satori`)
- Monte Carlo simulation pass to replace the estimated `probability` values in each mode with real hit rates, and re-check tier placement accordingly
