# LoreStudio

A production-ready MVP for a personalized interactive dark fantasy lore book hosted on Vercel.

Users enter a few personal traits, then the app generates an eight-page illustrated lore book with page-flip interaction, optional background music, and lazy ElevenLabs narration per page.

The free experience includes the first five illustrated pages. After payment, the full interactive book and a downloadable PDF are delivered by email through Supabase persistence, Stripe, and Resend.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- react-pageflip
- OpenAI Node SDK
- ElevenLabs text-to-speech API
- Supabase Postgres + Storage
- Stripe Checkout + webhooks
- Resend email
- @react-pdf/renderer for PDF generation
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

### Core generation

```bash
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-5
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=1024x1536
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=t9VKj6QDu6evrQNoV6Ij
ELEVENLABS_MODEL_ID=eleven_v3
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Use `SUPABASE_SERVICE_ROLE_KEY` only on the server. Never expose it to the client.

### Stripe

```bash
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### Email

```bash
RESEND_API_KEY=
FROM_EMAIL=LoreStudio <onboarding@yourdomain.com>
```

### Internal fulfillment

```bash
INTERNAL_FULFILLMENT_SECRET=replace-with-a-long-random-secret
```

This secret protects `/api/fulfill-book`, which is triggered by the Stripe webhook after payment.

## Supabase setup

### 1. Create the database table and storage bucket

Open the Supabase SQL Editor and run the migration in:

```text
supabase/migrations/001_books_and_storage.sql
```

That script creates:

- the `books` table
- indexes on `access_token`, `stripe_session_id`, and `email`
- an `updated_at` trigger
- the private `book-pdfs` storage bucket
- storage policies for service-role access only

### 2. Books table

Columns:

- `id`
- `access_token`
- `email`
- `status` (`free`, `checkout_started`, `paid`, `generating`, `ready`, `failed`)
- `form_input`
- `free_book`
- `full_book`
- `free_pages`
- `premium_pages`
- `images`
- `audio`
- `pdf_url`
- `pdf_storage_path`
- `stripe_session_id`
- `stripe_payment_intent_id`
- `created_at`
- `updated_at`

### 3. Storage bucket

Bucket name:

```text
book-pdfs
```

PDFs are uploaded to:

```text
books/{bookId}/book.pdf
```

Downloads use signed URLs generated server-side by `/api/download-pdf`.

## Premium flow

1. User generates a free book.
2. The app saves the free book in Supabase and returns a private `accessToken`.
3. User reads pages 1–5.
4. A paywall popup appears on page 5.
5. User pays with Stripe Checkout.
6. Stripe webhook marks the book as `paid`.
7. `/api/fulfill-book` generates premium images/audio, builds the full 8-page book, creates a PDF, uploads it to Supabase Storage, and marks the book `ready`.
8. Resend sends an email with:
   - interactive book link: `${NEXT_PUBLIC_APP_URL}/book/{accessToken}`
   - PDF download link: `${NEXT_PUBLIC_APP_URL}/api/download-pdf?token={accessToken}`
9. User opens the full interactive book and can download the PDF.

## Stripe webhook setup

Create a webhook endpoint in Stripe pointing to:

```text
https://your-domain.com/api/webhooks/stripe
```

Subscribe to:

```text
checkout.session.completed
```

Copy the signing secret into:

```bash
STRIPE_WEBHOOK_SECRET=
```

### Local webhook testing

Use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Then trigger a test event:

```bash
stripe trigger checkout.session.completed
```

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

To test the full paid flow locally you need:

- Supabase project with the migration applied
- Stripe test keys and webhook forwarding
- Resend API key and verified sender domain
- OpenAI and ElevenLabs keys for premium asset generation

## Build

```bash
npm run build
```

## Deploy on Vercel

1. Import the GitHub repository in Vercel.
2. Add all environment variables from `.env.example`.
3. Deploy with the default Next.js settings.
4. Configure the Stripe webhook to your production `/api/webhooks/stripe` URL.

`/api/fulfill-book` is configured with `maxDuration = 300` for premium generation and PDF creation.

## Background music and textures

To enable background music, add an MP3 at:

```text
public/audio/mysterious-theme.mp3
```

The music toggle is hidden automatically when the file is absent.

## Notes

- Free books are persisted in Supabase with a private `access_token`.
- Premium PDFs are generated only after successful payment.
- PDF downloads require `status = ready` and a valid `access_token`.
- Image and narration generation failures are non-fatal; the book continues with fallbacks where possible.
