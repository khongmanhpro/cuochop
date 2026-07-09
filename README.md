# Cuochop

Cuochop is a Vietnamese meeting-notes app built with Next.js 16, Prisma, SQLite, and Gemini. It supports chunked audio/video uploads, transcription, structured meeting notes, action tracking, search, exports, auth, billing, team workspaces, Slack integration, and scheduled reminders.

## Features

- Upload `.mp3`, `.mp4`, `.wav`, and `.m4a` files in client-side chunks.
- Transcribe Vietnamese meetings with Gemini.
- Generate structured notes with summaries, decisions, action items, risks, open questions, and transcript.
- Save meeting history and export notes as Markdown, DOCX, or organization data.
- Track action items, owners, deadlines, reminders, and notifications.
- Search meeting notes and decisions.
- Email/password auth plus Google and Microsoft OAuth.
- LemonSqueezy billing for Pro and Business plans.
- Slack integration for team notifications and deadline reminders.
- Cron endpoints for weekly digests and deadline reminders.

## Requirements

- Node.js compatible with Next.js 16.
- pnpm `10.32.1`.
- SQLite-compatible filesystem persistence for `data/`.
- Gemini API key.

## Install

```bash
pnpm install
```

## Environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Required for the core meeting-notes flow:

```bash
GEMINI_API_KEY=
DATABASE_URL=file:./data/cuochop.db
SESSION_SECRET=replace_with_at_least_32_random_characters
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Production and optional integrations:

```bash
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_VARIANT_ID=
LEMONSQUEEZY_BUSINESS_VARIANT_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=
CRON_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_TOKEN_ENCRYPTION_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
```

Do not commit `.env.local` or real secrets.

## Run Dev

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build And Test

```bash
pnpm test
pnpm build
```

Docker (recommended when you run the app via Compose):

```bash
# Unit + integration tests in a Node 22 container
pnpm test:docker
# or: docker compose -f docker-compose.test.yml run --rm test

# Rebuild & restart the app image after code changes
pnpm docker:rebuild
# or: docker compose up --build -d
```

## Run With Docker

Build and start the app with `.env.local`:

```bash
docker compose up --build -d
```

The app listens on [http://localhost:3000](http://localhost:3000). Docker uses `DATABASE_URL=file:/app/data/cuochop.db` and persists uploads in `tmp/uploads` and the SQLite database in `data/`.

Useful Docker checks:

```bash
docker compose ps
docker compose logs --tail=120 app
```

## OAuth Setup

Set `NEXT_PUBLIC_BASE_URL` to the public app URL in production. Configure provider callback URLs:

- Google: `https://yourdomain.com/api/auth/oauth/google/callback`
- Microsoft: `https://yourdomain.com/api/auth/oauth/microsoft/callback`

OAuth state is bound to a short-lived `httpOnly` cookie. `SESSION_SECRET` must be stable across deploys and at least 32 characters.

## Cron Setup

Set `CRON_SECRET`, then call cron endpoints with:

```text
Authorization: Bearer <CRON_SECRET>
```

Endpoints:

- `POST /api/cron/weekly-digest`
- `POST /api/cron/deadline-reminders`

## API Overview

- `POST /api/upload-chunk`: store upload chunks in `tmp/uploads`.
- `POST /api/uploads`: create a server-owned upload record and return an upload ID.
- `POST /api/complete-upload`: assemble chunks into the final uploaded file.
- `POST /api/transcribe`: call Gemini transcription for an uploaded file by upload ID.
- `POST /api/generate-notes`: generate notes JSON and Markdown.
- `POST /api/export-notes`: export a meeting note.
- `POST /api/export`: export organization data.
- `GET /api/search`: search saved content.
- `POST /api/billing/checkout`: create a LemonSqueezy checkout.
- `POST /api/webhooks/lemonsqueezy`: process signed LemonSqueezy webhooks.
- `GET /api/auth/oauth/[provider]`: start Google or Microsoft OAuth.
- `GET /api/auth/oauth/[provider]/callback`: handle OAuth callback.

## Production Checklist

- Generate a strong `SESSION_SECRET` with at least 32 characters.
- Set `NEXT_PUBLIC_BASE_URL` to the exact production origin.
- Configure Google and Microsoft OAuth callback URLs if OAuth is enabled.
- Configure LemonSqueezy webhook signing secret before enabling billing webhooks.
- Configure `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` before enabling email digests/reminders.
- Configure `SLACK_TOKEN_ENCRYPTION_KEY` as 32 bytes or base64-encoded 32 bytes before enabling Slack.
- Protect cron invocations with `CRON_SECRET`.
- Persist `data/` and `tmp/uploads/` when running Docker.
- Back up SQLite before deploys or migrations:
  ```bash
  mkdir -p backups
  cp data/cuochop.db backups/cuochop-$(date +%Y%m%d-%H%M).db
  ```
- Run `pnpm test` and `pnpm build` before deploy.

## Known Limitations

- Local chunked uploads are not suitable for serverless file storage. Use S3 or GCS signed URLs for large production deployments.
- Gemini transcript speaker labels are approximate when audio has no speaker metadata.
- Gemini JSON responses may need fallback parsing if a model returns text outside the expected schema.
- Authentication redirects use the Next.js 16 `proxy.ts` convention. Keep authorization checks inside server actions and route handlers for sensitive operations.
