# LoreStudio

A production-ready MVP for a personalized interactive dark fantasy lore book hosted on Vercel.

Users enter a few personal traits, then the app generates an eight-page illustrated lore book with page-flip interaction, optional background music, and lazy ElevenLabs narration per page.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- react-pageflip
- OpenAI Node SDK
- ElevenLabs text-to-speech API
- Vercel-compatible serverless API routes

## Install

```bash
npm install
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

Required:

```bash
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=32RJn1LZiXZZLVacVQoD
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional defaults:

```bash
OPENAI_TEXT_MODEL=gpt-5
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=1024x1536
ELEVENLABS_MODEL_ID=eleven_v3
```

If your OpenAI account does not have access to `gpt-image-2`, set:

```bash
OPENAI_IMAGE_MODEL=gpt-image-1
```

Image generation automatically falls back to `gpt-image-1` if the configured image model fails. The app generates 5 illustrated double-page spreads. `/api/generate-book` returns the lore first so the book appears quickly, then the browser requests all 5 images in the background through `/api/generate-image`.

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

## Deploy on Vercel

1. Import the GitHub repository in Vercel.
2. Make sure Vercel deploys the branch that contains this app, or merge this branch into `main` before deploying production.
3. Add the environment variables from `.env.example` in Vercel Project Settings.
4. Deploy with the default Next.js settings.

All OpenAI and ElevenLabs calls happen in server routes under `app/api`, so API keys are not exposed client-side.

The narration defaults to ElevenLabs voice `32RJn1LZiXZZLVacVQoD` with model `eleven_v3`. You can override either value in Vercel with `ELEVENLABS_VOICE_ID` or `ELEVENLABS_MODEL_ID`.

API routes are split to avoid one long blocking request. The repository does not configure `maxDuration`; Vercel will apply the timeout allowed by your project plan.

### Vercel 404 on first deploy

If Vercel shows `404: NOT_FOUND` on `/`, the project is usually deploying the wrong branch or an older commit. The initial `main` branch only contained a placeholder README before this MVP was added.

Fix it by doing one of the following:

- Merge the MVP branch into `main`, then redeploy production.
- Or in Vercel, deploy the preview branch that contains `package.json`, `app/page.tsx`, and the `app/api` routes.
- Confirm the Vercel project root directory is the repository root, not a nested folder.

## Background music and textures

The app looks and works without binary assets. CSS gradients create leather, parchment, fog, and image placeholder fallbacks.

To enable background music, add an MP3 at:

```text
public/audio/mysterious-theme.mp3
```

The music toggle is hidden automatically when the file is absent.

Optional texture files can be added later:

```text
public/textures/paper.jpg
public/textures/leather.jpg
public/textures/noise.png
```

## Notes

- Generated books are stored in client state only for the MVP.
- Narration is generated lazily when a page becomes active.
- Image generation failures are non-fatal; the book continues with premium illustrated placeholders.
- For higher traffic or stricter serverless timeout limits, move image generation to background jobs and stream page assets as they complete.
