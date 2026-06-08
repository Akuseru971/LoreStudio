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
ELEVENLABS_VOICE_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional defaults:

```bash
OPENAI_TEXT_MODEL=gpt-5
OPENAI_IMAGE_MODEL=gpt-image-2
```

If your OpenAI account does not have access to `gpt-image-2`, set:

```bash
OPENAI_IMAGE_MODEL=gpt-image-1
```

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
2. Add the environment variables from `.env.example` in Vercel Project Settings.
3. Deploy with the default Next.js settings.

All OpenAI and ElevenLabs calls happen in server routes under `app/api`, so API keys are not exposed client-side.

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
