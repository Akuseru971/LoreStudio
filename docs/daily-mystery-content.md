# The Hidden Chronicle — Content Import & Moderation

## Allowed sources

Only official Riot domains:

- `ddragon.leagueoflegends.com`
- `universe.leagueoflegends.com`
- `leagueoflegends.com`
- `riotgames.com` (canonical lore pages only)

Community wikis, Fandom, Reddit, fan sites, and AI-generated summaries are rejected.

## Content lifecycle

Every item in `mystery_content_items` has `review_status`:

| Status | Meaning |
| --- | --- |
| `draft` | Imported but not ready |
| `needs_review` | Awaiting moderator approval |
| `approved` | Eligible for daily rotation and archive |
| `retired` | Removed from rotation |

Only `approved` items are served publicly.

## Required fields

- `slug`, `target_type`, `canonical_title`
- `protected_terms` — explicit list; never inferred at runtime
- `accepted_solution_aliases`
- `source_text`, `source_url`, `source_domain`, `source_hash`
- `hint_metadata` for structured hints
- `difficulty` (1–5), `region_tags`, `related_champion_ids`

## Import workflows

### 1. Seed manifest (development / staging)

```bash
curl -X POST "$APP_URL/api/internal/daily-mystery/import" \
  -H "x-internal-fulfillment-secret: $INTERNAL_FULFILLMENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"seed"}'
```

Loads `content/daily-mystery/seed-manifest.ts` and ensures today's schedule.

### 2. Data Dragon champion catalog

```bash
curl -X POST "$APP_URL/api/internal/daily-mystery/import" \
  -H "x-internal-fulfillment-secret: $INTERNAL_FULFILLMENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"ddragon","limit":10,"autoApprove":false}'
```

- Uses the current patch from `https://ddragon.leagueoflegends.com/api/versions.json`
- Falls back to official blurb when full biography is unavailable
- Imports as `needs_review` unless `autoApprove: true`

### 3. Manual manifest entries

Add verified official text to `content/daily-mystery/seed-manifest.ts` (or a dedicated manifest module) when automatic extraction is unreliable. Each entry must include an official `source_url` on an allowed domain.

### 4. Coverage report

```bash
curl -X POST "$APP_URL/api/internal/daily-mystery/import" \
  -H "x-internal-fulfillment-secret: $INTERNAL_FULFILLMENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"coverage"}'
```

Returns champion totals, imported counts, biography vs blurb split, and missing champion IDs.

## Approving content

In Supabase, update the row:

```sql
UPDATE mystery_content_items
SET review_status = 'approved', approved_at = now()
WHERE slug = 'champion-ahri';
```

Future moderation UI can wrap this workflow; the schema is ready.

## Scheduling overrides

Automatic selection runs via `ensureDailySchedule()` when no row exists for today.

Admin override: insert or update `mystery_daily_schedule` for the date before players load the puzzle:

```sql
INSERT INTO mystery_daily_schedule (schedule_date, content_item_id, difficulty, admin_override)
VALUES ('2026-06-09', '<content-uuid>', 3, true)
ON CONFLICT (schedule_date) DO UPDATE
SET content_item_id = EXCLUDED.content_item_id,
    difficulty = EXCLUDED.difficulty,
    admin_override = true,
    locked_at = now();
```

## Protected terms

Store every form that must not appear before victory:

```json
["Irelia", "Irelia's", "Xan Irelia", "The Blade Dancer"]
```

Multi-word phrases are masked as complete phrases. Other champion names in the passage are **not** protected unless listed.

## Production deployment commands

Run against the **same Supabase project** configured in Vercel (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

### Local development

```bash
# 1. Apply SQL migration in Supabase SQL Editor (014_daily_mystery.sql)
# 2. Load verified official seed + schedule today
npm run mystery:bootstrap
# 3. Verify
npm run mystery:diagnostics
curl http://localhost:3000/api/daily-mystery/today
```

### Vercel Preview / Production

Use either CLI (with production env vars loaded) or the internal API:

```bash
# CLI (recommended first deploy)
export $(grep -v '^#' .env.production.local | xargs)
npm run mystery:bootstrap

# Or HTTP bootstrap
curl -X POST "$APP_URL/api/internal/daily-mystery/import" \
  -H "x-internal-fulfillment-secret: $INTERNAL_FULFILLMENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"bootstrap"}'
```

### Package commands

| Command | Purpose |
| --- | --- |
| `npm run mystery:seed:verified` | Idempotent verified seed only |
| `npm run mystery:import:champions` | Import champions from Data Dragon |
| `npm run mystery:schedule:today` | Lock today's schedule |
| `npm run mystery:coverage` | Coverage report |
| `npm run mystery:bootstrap` | Seed + schedule (first deploy) |
| `npm run mystery:diagnostics` | Safe DB/content diagnostics |

The API also auto-runs the verified seed idempotently when scheduling if no approved content exists (`MYSTERY_DISABLE_AUTO_BOOTSTRAP=false` by default).

## Refreshing content

1. Run Data Dragon import after major patches.
2. Review `needs_review` entries.
3. Retire outdated entries: `review_status = 'retired'`, `retired_at = now()`.
4. Re-run coverage to audit gaps.
