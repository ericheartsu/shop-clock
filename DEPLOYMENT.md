# Shop Clock — Deployment

Step-by-step to get `clock.craft-mfg.net` live. Total time: ~20 minutes + DNS propagation.

## 1. Postgres (Neon)

1. Go to https://console.neon.tech
2. New Project -> name it `shop-clock` -> Postgres 17, region near Phoenix (e.g. `us-west-2`).
3. Copy the **Pooled connection string** (ends in `-pooler...`). You'll paste it into Vercel as `DATABASE_URL`.

## 2. Push repo to GitHub

Already pushed. If not:

```bash
cd /c/Dev/shop-clock
gh repo create ericheartsu/shop-clock --public --source=. --push
```

## 3. Import to Vercel

1. https://vercel.com/new -> select `ericheartsu/shop-clock`.
2. Framework preset: **Next.js** (auto-detected).
3. Root directory: leave as `./`.
4. **Environment Variables** — add all of these (also set them for Preview + Development):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled connection string from step 1 |
   | `PRINTAVO_API_URL` | `https://www.printavo.com/api/v2` |
   | `PRINTAVO_API_EMAIL` | `eric@craft-mfg.com` |
   | `PRINTAVO_API_TOKEN` | (paste from hq-print's enrich script — already known) |

5. Click **Deploy**. First build should succeed (`prisma generate` runs via `postinstall`).

## 4. Push the database schema

Vercel doesn't run migrations automatically. Two options:

**Option A — from your laptop (simplest):**

```bash
cd /c/Dev/shop-clock
cp .env.example .env.local
# edit .env.local, paste the Neon DATABASE_URL
npm install
npx prisma db push
```

**Option B — from Vercel:** add a `vercel-build` script that runs `prisma db push && next build`. Only do this if you're comfortable with it.

## 5. Smoke test

Hit `https://shop-clock.vercel.app`:

- Enter an invoice number (use a real Printavo visual ID).
- Confirm it looks up, creates the job, shows decorations.
- Start a Setup clock for 5 seconds, stop it, confirm the timer saved.
- Visit `/api/active` — should show 0 open clocks after you stopped.

## 6. Custom domain

1. Vercel -> Project -> Settings -> **Domains** -> Add `clock.craft-mfg.net`.
2. Vercel shows the CNAME target (usually `cname.vercel-dns.com`).
3. DreamHost -> Panel -> Manage Domains -> DNS for `craft-mfg.net` -> Add Custom DNS Record:
   - Name: `clock`
   - Type: `CNAME`
   - Value: `cname.vercel-dns.com.`
4. Wait 5-60 minutes for DNS.
5. Vercel auto-issues the SSL cert once it sees the record. Check the Domains page — green checkmark means you're live.

## 7. Day-one rollout

- Open `https://clock.craft-mfg.net` on the press tablets.
- Add to iPad/Android home screen ("Add to Home Screen") for a full-screen app feel.
- No login required — anyone who taps can clock.

## Rollback

If Printavo breaks, the app still works — lookups fall back to manual entry. Check server logs (Vercel -> Logs) for `[printavo]` errors.

## Migration to HQ Print (future)

When HQ Print's scheduler ships, write a script that walks `PhaseZeroTimeEntry` -> HQ's TimeEntry model, joining by invoice number -> Order. Keep these tables intact as the source of truth until the migration is verified.
