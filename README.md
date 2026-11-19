# KIDZO

Interactive entertainment and learning for kids aged 2 to 12, with a PIN-protected parent area
and a content dashboard for the KIDZO team.

## What is in the repo

| Path | What it is |
|---|---|
| `apps/mobile` | Expo SDK 58 app for kids and parents (iOS, Android, web) |
| `apps/api` | Fastify 5 API with Drizzle ORM and PostgreSQL |
| `apps/admin` | Vite and React dashboard for content, stickers, users and the audit log |
| `packages/shared` | Zod schemas, types, brand tokens, play-policy rules, story graph checks, API client |
| `assets/brand` | Logo and brand files |
| `docs` | Notes extracted from the Figma prototype |

## Requirements

- Node 22 or newer
- pnpm 12 (`corepack enable`)
- No database is needed for local work. The API runs embedded PGlite when `DATABASE_URL` is unset.

## Quick start

```bash
pnpm install
pnpm db:seed        # content, stickers, a dev admin and a demo family
pnpm dev:api        # http://localhost:4000 (first start takes about 30 s)
pnpm dev:admin      # http://localhost:5173
pnpm dev:mobile     # Expo dev server, then press i, a or w
```

Dev accounts created by the seed script (local only):

- Admin: `admin@kidzo.local` / `KidzoAdmin2026`
- Parent: `parent@kidzo.local` / `KidzoParent2026`, PIN `1234`, children Mia (5) and Kayla (8)

## Configuration

Each app has an `.env.example`. Copy it to `.env` (`.env.local` for the admin app).

- `apps/api/.env.example` - port, database, JWT secret, CORS origins, uploads, reset link.
- `apps/admin/.env.example` - `VITE_API_URL`.
- `apps/mobile/.env.example` - `EXPO_PUBLIC_API_URL` for builds.

In production the API refuses to start without `DATABASE_URL` and a real `JWT_SECRET`.

## Checks

```bash
pnpm check          # typecheck, lint and tests in every package
```

API tests start an embedded database per file, so they run one file at a time.

## Features

- **Kids:** profile picker, home with featured adventure, interactive stories with branching
  choices and Family Mode, quizzes, songs with narration, stars and a sticker album, adventure replay.
- **Guest play:** try age-filtered content without creating a family or child profile. The selected
  age stays in memory; guest plays and completions are reported as anonymous daily aggregates.
- **Interactive video:** admins can attach MP4 scene clips (up to 100 MB) to branching stories.
  Clips loop behind the story choices, with the illustrated emoji scene as a fallback when a clip
  cannot play. Video clips require a connection; downloaded stories still have the fallback scene.
- **Calm mode and limits:** bedtime theme and schedule, daily time limits with a heads-up,
  lock now, all enforced on the server and on the device.
- **Offline:** downloaded adventures play without a connection. Play sessions queue and sync later.
- **Parents:** PIN gate with lockout, control center, child management, limits and bedtime
  settings, weekly insights, downloads, password reset, data export and account delete.
- **Admin:** stats, content editor with story graph validation, publish flow, stickers,
  media upload, users and audit log. Performance reporting includes weekly activity,
  completion and duration metrics, including guest aggregates, popular skills and games,
  and low-completion content.
- **Languages:** English, French, Kinyarwanda and Kiswahili.

## Security notes

- Argon2 password and PIN hashing, short-lived JWT access tokens with rotating refresh tokens.
- Rate limits on auth, PIN and reset endpoints. PIN locks after five wrong tries.
- Every child and session route checks that the child belongs to the signed-in parent.
- Admin role is re-read from the database on every admin request.
- Uploads are checked by file signature, not by the declared type.
- Guest reports retain only content/day aggregates. Guest age, profile and progress are not stored.
- Sensitive actions are written to the audit log.

## Project status

See `PROGRESS.md` for milestones, the verification log and the items that need account owners
(production database, email provider, app store accounts and legal review).
