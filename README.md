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

- `POST /api/jobs/lookup` `{ invoice }` -> cached or Printavo fetch (auto-fills `customerName` + `printavoSnapshot`)
- `GET  /api/jobs/[invoice]` -> job + decorations
- `PATCH /api/jobs/[invoice]` `{ customerName?, hqOrderHint? }` -> override auto-filled customer / attach HQ order hint
- `POST /api/jobs/[invoice]/repull` -> force-refresh Printavo data (snapshot is immutable once set)
- `POST /api/jobs/[invoice]/decorations` `{ location, locationOther?, method, colorCount }` -> picklist validated
- `PATCH /api/jobs/[invoice]/decorations/[id]` `{ location?, locationOther?, method?, colorCount? }` -> picklist validated
- `POST /api/operators` `{ name, pin }` -> 4-digit PIN, unique
- `PATCH /api/operators/[id]` `{ name?, pin?, active? }` -> edits do NOT rewrite history (snapshots freeze at clock-in)
- `GET  /api/operators` `?active=1` -> list
- `POST /api/operators/resolve` `{ pin }` -> active operator or 404
- `POST /api/clock/start` `{ invoice, decorationId, press, phase, operatorPin }` -> PIN gate required
- `POST /api/clock/pause` `{ entryId, reason, reasonOther? }` -> reason from `PAUSE_REASONS` picklist; "Other" requires freeform text
- `POST /api/clock/resume` `{ entryId }`
- `POST /api/clock/stop` `{ entryId, notes?, sessionQuantity?, scrapCount? }` -> session output captured
- `GET /api/active` — debug: list open (unstopped) entries

## Capture hardening (2026-04-19)

- **Operator identity** — every time entry carries `operatorId` + frozen `operatorNameSnapshot` + `operatorPinSnapshot`. Editing operators in `/admin/operators` does NOT rewrite history.
- **Pause reasons** — picklist + freeform "Other". `pauseReason` is the most recent; `pauseLog` (Json) is the full history with `pausedAt` / `resumedAt` / `reason` triples.
- **Session output** — `sessionQuantity` and `scrapCount` captured on stop (both optional).
- **Printavo snapshot** — first successful fetch is frozen in `printavoSnapshot`; re-pulls update live fields but never overwrite the snapshot.
- **Customer name** — auto-extracted from snapshot, editable on the job page.
- **HQ order hint** — optional freeform reconcile key (`hqOrderHint`).
- **Picklists** — `LOCATIONS`, `METHODS`, `PAUSE_REASONS` live in `src/lib/config.ts`. `PRESS_TO_DEPARTMENT` maps presses to HQ Print department slugs for the eventual fold-in.

## Seeding operators

```bash
node prisma/seed-operators.mjs
```

Creates Eric / 1111, Press Op / 2222, Shop Test / 3333 if missing. Idempotent — never rotates existing PINs.

## Printavo quantity

Quantity is fetched via a second narrow GraphQL call (`lineItems.sizes.count`) after the wide match search confirms the `visualId`. Kept separate so the match search stays under the 25k complexity budget. Misses are logged to console (`[printavo] qty …`) with `total=0` warnings so low/zero quantities can be traced later.

## Deploying

See `DEPLOYMENT.md`.

## Swapping shops

Presses and phases live in `src/lib/config.ts`. Change them there and the UI + API validation follow.
