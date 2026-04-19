# Shop Clock

Mobile-first production time tracking for the Craft MFG press floor. Runs alongside Printavo / HQ Print to capture real setup / production / teardown durations per press per decoration — so when HQ's weighted-slot scheduler ships, it has real calibration data.

## What it does

- Operator taps the Printavo invoice # -> sees the job + decorations.
- Picks a press (Roq Eco or Roq You) and a decoration.
- Taps SETUP, PRODUCTION, or TEARDOWN -> clock starts.
- Taps STOP -> elapsed time + optional notes persist to Postgres.

No login. No user tracking. Per-press / per-decoration / per-phase granularity only.

## Stack

- Next.js 15 (App Router) + React 19, TypeScript, Tailwind
- Prisma 5 + Postgres (Neon in production)
- Printavo GraphQL v2 for invoice lookup (gracefully degrades to manual entry)

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL + Printavo creds
npx prisma db push           # create tables
npm run dev                  # http://localhost:3008
```

## Dev port

`3008`. HQ Print owns 3000, image-tagger 3005, separation-agent 3010.

## Data model

Three tables, all prefixed `PhaseZero` so the HQ migration story is obvious:

- `PhaseZeroJob` — one row per unique Printavo invoice seen.
- `PhaseZeroDecoration` — location + method + color count per job.
- `PhaseZeroTimeEntry` — one row per clock start/stop, with press/phase/notes.

See `prisma/schema.prisma`.

## API

- `POST /api/jobs/lookup` `{ invoice }` -> cached or Printavo fetch
- `POST /api/jobs/[invoice]/repull` -> force-refresh Printavo data on an existing job
- `POST /api/jobs/[invoice]/decorations` `{ location, method, colorCount }`
- `PATCH /api/jobs/[invoice]/decorations/[id]` `{ location?, method?, colorCount? }` -> edit an imported or manual decoration
- `POST /api/clock/start` `{ invoice, decorationId, press, phase }`
- `POST /api/clock/stop` `{ entryId, notes }`
- `GET /api/active` — debug: list open (unstopped) entries

## Printavo quantity

Quantity is fetched via a second narrow GraphQL call (`lineItems.sizes.count`) after the wide match search confirms the `visualId`. Kept separate so the match search stays under the 25k complexity budget. Misses are logged to console (`[printavo] qty …`) with `total=0` warnings so low/zero quantities can be traced later.

## Deploying

See `DEPLOYMENT.md`.

## Swapping shops

Presses and phases live in `src/lib/config.ts`. Change them there and the UI + API validation follow.
