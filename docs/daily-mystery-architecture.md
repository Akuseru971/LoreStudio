# The Hidden Chronicle — Technical Architecture

## Overview

The Hidden Chronicle (`/daily-mystery`) is a server-authoritative daily deduction game integrated into Lore Studio. Players reveal a masked Riot lore passage by guessing words and ultimately identifying the hidden subject.

## Stack integration

| Layer | Implementation |
| --- | --- |
| Framework | Next.js App Router (`app/daily-mystery/*`) |
| Database | Supabase (`supabase/migrations/014_daily_mystery.sql`) |
| Auth / identity | Anonymous `mystery_player_id` HttpOnly cookie; existing account system can be extended |
| Embeddings | OpenAI `text-embedding-3-small` via `lib/daily-mystery/semantic.ts` |
| UI | Existing Lore Studio tokens, `SiteHeader`, Framer Motion |
| Analytics | `safeTrackServer` / `safeTrackClient` |

## Security model

Pre-victory responses never include:

- `source_text`, `canonical_title`, `protected_terms`, `accepted_solution_aliases`
- Full solution or source URLs that expose the answer

Guess validation runs exclusively in `POST /api/daily-mystery/guess`. The client receives masked token structures and only newly revealed word text.

### Protected target rule

Only the puzzle target and its explicit `protected_terms` are masked during ordinary guesses. Other champion names in the passage remain revealable clues (see mandatory Irelia test in `lib/daily-mystery/__tests__/irelia.test.ts`).

## Core modules

```
lib/daily-mystery/
  tokenize.ts   — passage masking, placeholder widths, phrase protection
  normalize.ts  — guess normalization + English lemmatization
  match.ts      — exact/lemma/phrase matching + victory detection
  semantic.ts   — embedding cache + proximity buckets
  hints.ts      — structured hint progression
  schedule.ts   — deterministic UTC daily selection
  store.ts      — Supabase persistence
  service.ts    — safe client payload assembly
  importer/     — Data Dragon + manual manifest pipeline
```

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/daily-mystery/today` | Today's shared puzzle |
| `POST /api/daily-mystery/guess` | Server-side guess validation |
| `POST /api/daily-mystery/hint` | Next authorized hint |
| `GET /api/daily-mystery/result` | Post-victory passage + source |
| `GET /api/daily-mystery/archive` | Archive listing (no spoilers) |
| `POST /api/daily-mystery/archive/start` | Start archive session |
| `POST /api/internal/daily-mystery/import` | Seed, Data Dragon import, schedule, coverage |

## Daily scheduling

- Timezone: `MYSTERY_DAILY_TIMEZONE` (default `UTC`)
- Category weights defined in `lib/daily-mystery/types.ts`
- 180-day repeat avoidance via `MYSTERY_MIN_REPEAT_DAYS`
- Schedule rows are locked in `mystery_daily_schedule` for the calendar day

## Semantic proximity

1. Unique passage lemmas are precomputed per content item.
2. Guess embeddings are cached globally in `mystery_guess_embedding_cache`.
3. Cosine similarity maps to `close`, `warm`, `very_close` buckets.
4. Exact matching continues if embeddings are unavailable.

## Riot Developer Portal

Register Lore Studio and keep this feature current in the [Riot Developer Portal](https://developer.riotgames.com/) product registration when shipping or materially changing the experience.

## Testing answer leakage

```bash
npm test
```

Key tests:

- `lib/daily-mystery/__tests__/irelia.test.ts` — protected champion behavior
- Inspect network responses from `/api/daily-mystery/today` and `/api/daily-mystery/guess` before victory; JSON must not contain the solution or full passage.
