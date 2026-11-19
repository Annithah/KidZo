# KIDZO build progress

The first handover was cut off after "Use a pnpm workspace monorepo:". The full project description
was later supplied as `kidzo document  (1).pdf`; it calls for animated video uploads, personalized
recap videos, interest-based recommendations, category controls and expanded analytics. M0 to M7
below remain the completed first implementation; these additional product requirements are being
delivered incrementally.

## Stack
- **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`), TypeScript strict, Zod everywhere.
- **packages/shared:** Zod schemas, types, brand tokens, play-policy rules (limits, bedtime, locks), story graph validation, scoring.
- **apps/api:** Fastify 5, Drizzle ORM, PostgreSQL. Uses embedded PGlite locally when `DATABASE_URL` is unset (no Docker on the dev machine). Argon2 hashing, JWT access + rotating refresh tokens, rate limits, Helmet, audit log.
- **apps/mobile:** Expo SDK 58, Expo Router, TanStack Query, SecureStore, expo-file-system downloads, expo-speech narration, expo-video, Baloo 2 + Nunito.
- **apps/admin:** Vite + React content dashboard.

## Milestones
- [x] **M0 Workspace and shared package** - tokens, schemas, policy and graph logic, 26 unit tests.
- [x] **M1 API** - auth, PIN gate, children, catalog, sessions, offline sync, insights, admin CRUD, media upload, seed, 27 integration tests, server smoke tested.
- [x] **M2 Mobile foundation** - theme, fonts, design-system components, API client with token refresh, auth screens, i18n (EN, FR, RW, SW).
- [x] **M3 Kid experience** - welcome, who's playing, home, adventure detail, story player with Family Mode, quiz, song, completion with stars and stickers, sticker album, adventure replay.
- [x] **M4 Calm mode, limits and offline** - bedtime theme, time limit enforcement and heads-up, downloads, offline catalog and session queue.
- [x] **M5 Parent area** - PIN gate, control center, child management, limits and bedtime settings, lock now, insights, downloads, account export and delete, forgot and reset password.
- [x] **M6 Admin dashboard** - login, stats, content list and editor with story graph validation, publish flow, stickers, media upload, users, audit log.
- [x] **M7 Hardening and docs** - security review, accessibility pass, README, env docs, final full check.
- [x] **M8 Admin performance reporting** - add privacy-conscious weekly engagement, completion, duration, category, game and low-completion metrics.
- [x] **M9 Guest video experience** - age-filtered guest catalog and playback without profiles or saved age, MP4 uploads and looping branching-scene video with emoji fallback, and anonymous daily play/completion/duration aggregates.

## Reconciled full-brief requirements
- [x] Admin analytics for weekly family and child growth, plays, completions, duration, popular skills and games, and low-completion content.
- [x] Interactive scene video: admins can attach MP4 clips up to 100 MB; the mobile branching-story player loops the clip with story choices and falls back to the emoji scene if video playback fails.
- [x] Guest play without a family account: age-filtered catalog and content routes; guest age is transient and reports store daily content aggregates without a guest or child identifier.
- [ ] Separate content review and unpublished states. Current workflow uses draft, published and archived.
- [ ] Interest-based recommendations using minimal activity data. Guest catalog age filtering is implemented, but recommendations are not.
- [ ] Personalized recap video generation from a child's story path. No video rendering pipeline exists yet.
- [ ] Parent controls to restrict content categories.
- [ ] Aggregated analytics for popular story choices and endings.

## Verification log
| Date | Scope | Typecheck | Lint | Tests | Run |
|---|---|---|---|---|---|
| 2026-11-18 | shared | pass | pass | 26 pass | n/a |
| 2026-11-18 | api | pass | pass | 27 pass | server up, seeded, smoke tested with curl |
| 2026-11-18 | full workspace (M2 to M7) | pass | pass | 81 pass (shared 31, api 29, admin 6, mobile 15) | API seeded and up, password reset smoke tested with curl, admin production build, mobile web export |
| 2026-11-18 | M8 and full workspace | pass | pass | 82 pass (shared 31, api 30, admin 6, mobile 15) | API health and admin analytics smoke tested; admin production build |
| 2026-11-18 | M9 and full workspace | pass | pass | 84 pass (shared 31, api 32, admin 6, mobile 15) | Admin production build and mobile web export passed |
| 2026-11-18 | API production bundle | pass | pass | n/a | Fixed tsup 9 config compatibility; API bundle built and `/health` smoke-tested |

## Dev accounts (seed script, local only)
- Admin: `admin@kidzo.local` / `KidzoAdmin2026`
- Demo parent: `parent@kidzo.local` / `KidzoParent2026`, PIN `1234`, children Mia (5) and Kayla (8)

## Needs Jay
- **Email provider:** password reset emails are only logged in development. In production nothing is sent until a provider (Resend, Postmark, SES) is wired into `apps/api/src/lib/mailer.ts`. Also set `PASSWORD_RESET_URL` if reset links should go through a web page or universal link.
- **Mobile LICENSE file:** `apps/mobile/LICENSE` is the Expo template's MIT license. Replace or remove it to match how you license KIDZO.
- **Manual device pass:** screens were verified by typecheck, lint, tests and a web bundle. Run the app on a real iPhone and Android phone before release.
- **Production Postgres:** set `DATABASE_URL` (Neon, Supabase, RDS). PGlite is for local dev only.
- **JWT secret:** set `JWT_SECRET` (32+ random chars) in production.
- **Media storage:** uploads go to local disk. A cloud bucket (S3, R2, GCS) needs credentials; implement `MediaStorage` in `apps/api/src/lib/storage.ts`.
- **Video delivery:** the current upload endpoint buffers video files in memory before writing to local disk. Production needs streaming uploads and a cloud video/CDN setup before accepting large clips at scale.
- **Kinyarwanda and Kiswahili review:** UI translations for RW and SW were drafted by Claude and need a native speaker check. Story content is EN, with FR for some titles.
- **Real art and narration audio:** content uses emoji scenes and device text-to-speech until illustrations and recorded audio exist.
- **App store accounts and EAS:** Apple and Google developer accounts, `eas init` project id, bundle ids.
- **Legal:** privacy policy and terms URLs, and a COPPA / GDPR-K review. The app records parental consent at signup and supports export and delete.
- **Mascot art for Zo:** only the logo exists. Zo is drawn from the logo star for now.

## Notes
- Expo packages are pinned to the 58.0.25 patch line. pnpm's minimumReleaseAge policy rejected the 58.0.26 releases from 2026-11-17, so the lockfile was rebuilt (old copy not kept in the repo). After 2026-11-18 12:00 UTC you can bump with `npx expo install --fix`.
- `apps/admin/package.json` had lost its dependency list. It was restored from the code's imports.
- PGlite cold start takes about 30 s on this machine, so API test files run one at a time.
- Installs are slow because the repo is inside OneDrive. Consider moving it outside OneDrive.
