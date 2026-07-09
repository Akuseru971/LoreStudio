# AGENTS.md

## Cursor Cloud specific instructions

LoreStudio is a single self-contained Next.js 16 (App Router) + TypeScript app. There is no database, cache, Docker, or separate backend to orchestrate — the only process is the Next.js server, and the only external dependencies are optional outbound calls to OpenAI and ElevenLabs.

### Services / commands

- Dev server: `npm run dev` (serves app + API routes on `http://localhost:3000`). This is the only service to run.
- Lint: `npm run lint`. Build: `npm run build`. Standard scripts live in `package.json`; setup is documented in `README.md`.

### Non-obvious notes

- API keys are optional for local development and testing. With no `OPENAI_API_KEY`/`ELEVENLABS_API_KEY`, the app degrades gracefully: `app/api/generate-book` returns hardcoded fallback lore (`lib/fallback-lore.ts`), `app/api/generate-image` returns CSS/gradient placeholder art, and narration is simply disabled. The full book-generation flow is therefore testable end-to-end without any secrets. Add keys to `.env.local` (copy from `.env.example`) only to exercise real AI generation.
- Known app defect (not an environment issue): in the interactive book reader, advancing past the 5 illustrated pages (i.e. reaching page 6+) crashes to a black screen with a spinning cube. The reader also has an auto-narration mode that auto-advances pages on its own, so this crash can trigger even without manual navigation. When demoing the reader, stay within the first ~5 pages.
