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
- [x] **M11 Full-brief features** - review workflow, category controls, recommendations, choice and ending analytics, personal recap.
- [x] **M10 Timed interactive video** - timestamped video questions, three-second default-answer timer, selected-choice path recording, safe publish validation for branch clips, and admin preview/answer-branch testing.

## M12 Real video library, age groups and answer feedback (in progress)
Brief: "Master Prompt: Real Video Library, Age-Based Content & 5-Second Answer Feedback" (2026-11-25).
The brief describes Express, Next.js, SQLite and Jest; this repo is Fastify, Vite, PostgreSQL (PGlite locally) and
Vitest. The real stack is kept. FFmpeg comes from the ffmpeg-static npm package, narration uses the Windows
speech voices behind a TTS interface, and only NASA and Wikimedia downloads run here (no Pexels/Pixabay keys).

What existed before this milestone: age ranges per item (ageMin/ageMax) with catalog filtering by child age,
parent category blocks, a 1.2 second quiz advance with "try again" retries, timed video questions with a
3 second auto-answer, MP4 scene uploads, no video content type, no import or generation pipeline.

- [x] **Part 3 answer feedback** - shared state machine (`apps/mobile/src/lib/answer-feedback.ts`, idle -> locked -> showing -> paused -> done), `useAnswerFeedback` hook with AppState pause, `AnswerFeedback` panel (countdown ring with seconds, Zo, caption, confetti off for reduced motion, icons besides color, Next after 1.5 s). Used by quizzes, story choices and timed video questions. Wrong quiz answers now show the right answer and an optional explanation instead of retrying. Parent setting 3, 5 or 8 seconds (default 5) stored per child on the server. Little Explorers get no auto-answer timer before answering. Tests: 9 state machine tests with fake timers (Vitest, not Jest/RNTL, matching the repo) and an API settings test.
- [x] **Part 2 age groups on the server** - groups Little Explorers 2-5 (videos up to 3 min, 2 answers, no pre-answer timer), Young Adventurers 6-8 (up to 6 min, 3 answers), Big Explorers 9-12 (up to 12 min, 3-4 answers) in `packages/shared/src/age-groups.ts`. Every content row has `age_groups` (migration 0004 backfills from the age range) and `video_seconds`. Child-scoped token: `POST /children/:id/token`, sent as `x-kidzo-child`; it can never act as a login. `/catalog`, `/catalog/recommendations`, `/content/:id`, `POST /sessions`, offline sync and the guest routes all filter by the token's age group, video length, age range and parent blocks; a `childId` in the query may only repeat the token's child. Same rules in the on-device backend. Admin shows age group badges and lets reviewers change groups. New `video` content type (variants, thumbnail, credit, optional quiz) with an admin editor and a mobile `VideoPlayer` (480p on mobile data, 720p on Wi-Fi). Tests: `apps/api/test/age-groups.test.ts` (Fastify inject, the repo's equivalent of Supertest).
- [x] **Part 1.2 import pipeline** (`pnpm content:import`) - plan in `content/import-plan.json` (29 entries, 356 clips wanted), Pexels, Pixabay, NASA and Wikimedia adapters, blocklist, subject, license, length and 720p filters, 480p/720p variants and thumbnail through FFmpeg, audio dropped when rights are unclear, everything lands in review, dedupe by source and original id, `--dry-run`, `--limit`, `--only`, `--max-mb`. Missing keys are reported and the source is skipped. Verified on 2026-11-26: dry run (78 found, filters applied) and a real import from Wikimedia. Tests: `content-import.test.ts`.
- [~] **Part 1.3 generated learning videos** (`pnpm content:generate`) - data-driven from `content/generate/*.json`: 321 videos in 13 topics with Windows TTS narration and KIDZO art, each with its quiz, in review. 88 of 321 rendered so far on this machine (about 30 s each); the run was paused to test the app and resumes with the same command (made videos are skipped). Gaps: each video is about 20 to 35 s and has 1 quiz question (brief: 1 to 6 min for Young, 2 to 12 min for Big, 2 to 4 questions); quiz answer pictures are generic. Longer scripts and more questions need content writing in the JSON files.
- [x] **Part 1.4 and 1.5** `pnpm content:report` (per category x age group x status, flags categories under 12) and `pnpm content:approve-dev` (refuses `NODE_ENV=production`). Tests: `content-tools.test.ts`.
- [~] **Part 4** - 9 branching adventures (3 per age group) from `content/adventures/*.json` via `pnpm content:adventures`, scenes marked as placeholders in admin; quizzes after generated videos with the shared 5 s feedback; data saver (480p on mobile data, 720p on Wi-Fi); Video credits screen (`GET /catalog/credits`, Account, Video credits); bedtime sleep timer (10, 20 or 30 min, volume fade, goodnight screen). Not done: seasonal home row (no content is tagged by season yet). Library volume is below target until the full import (needs Pexels and Pixabay keys) and the full generate run finish.

Report on 2026-11-26 after 88 generated videos plus earlier imports (published / review / draft): Learning 30, 17, 13 and Morning Activities 19, 13 for little and young are visible; every other category and age group pair is under 12 and stays hidden.

Browser check on 2026-11-26 (API, admin and mobile web): admin dashboard and content list show the generated and imported videos with age group badges; guest age 4 sees little content, age 10 sees different content; a Wikimedia clip and a generated video both play with credits; the quiz locks, marks the right answer green and the wrong one gently, holds, then moves on.

## Reconciled full-brief requirements
- [x] Admin analytics for weekly family and child growth, plays, completions, duration, popular skills and games, and low-completion content.
- [x] Interactive scene video: admins can attach MP4 clips up to 100 MB; timed questions pause playback at their configured timestamp, show a three-second countdown, and choose a required default answer. Publishing checks that every answer destination has its own clip; the admin preview tests all answer branches.
- [x] Guest play without a family account: age-filtered catalog and content routes; guest age is transient and reports store daily content aggregates without a guest or child identifier.
- [x] Separate content review and unpublished states: draft -> review -> published, with "request changes" back to draft, unpublish to `unpublished` (republish without another review), archive and restore. Publishing a draft directly is refused (409 REVIEW_REQUIRED).
- [x] Interest-based recommendations using minimal activity data: "Picked for you" row on the kid home screen, scored only from which items the child played and finished (`recommendContent` in shared, `GET /catalog/recommendations`, also in the on-device backend). Age range and blocked categories always apply.
- [x] Personalized recap from a child's story path: the "My adventure" replay opens with the child's name and avatar, narrates each scene they visited with the choice they made, and ends with a summary of their choices. Built on the device; nothing is uploaded. A downloadable rendered video file is not produced (see Needs Jay).
- [x] Parent controls to restrict content categories: per-child switches on the Time & bedtime screen. Blocked categories are hidden from the catalog and recommendations and refused when a session starts (reason `category`), online and offline.
- [x] Aggregated analytics for popular story choices and endings: "Story choices and endings" on the admin Analytics page (7, 30 or 90 days), from finished adventures; totals only, no child identified.

- [x] **M8 Standalone APK** - on-device backend (`apps/mobile/src/lib/local-backend`) answers every API route the app uses from a JSON database on the phone, seeded with the demo family and full catalog. Enabled by `EXPO_PUBLIC_LOCAL_BACKEND=1` in the `standalone` profile of `apps/mobile/eas.json`. Build with `eas build -p android --profile standalone`. Data stays on that phone and does not reach the real API. Password reset is not available in this mode.

## Verification log
| Date | Scope | Typecheck | Lint | Tests | Run |
|---|---|---|---|---|---|
| 2026-11-18 | shared | pass | pass | 26 pass | n/a |
| 2026-11-18 | api | pass | pass | 27 pass | server up, seeded, smoke tested with curl |
| 2026-11-18 | mobile (M8) | pass | pass | 18 pass (3 new local backend tests) | EAS cloud APK build |
| 2026-11-18 | full workspace (M2 to M7) | pass | pass | 81 pass (shared 31, api 29, admin 6, mobile 15) | API seeded and up, password reset smoke tested with curl, admin production build, mobile web export |
| 2026-11-18 | M8 and full workspace | pass | pass | 82 pass (shared 31, api 30, admin 6, mobile 15) | API health and admin analytics smoke tested; admin production build |
| 2026-11-18 | M9 and full workspace | pass | pass | 84 pass (shared 31, api 32, admin 6, mobile 15) | Admin production build and mobile web export passed |
| 2026-11-18 | API production bundle | pass | pass | n/a | Fixed tsup 9 config compatibility; API bundle built and `/health` smoke-tested |
| 2026-11-19 | Pulled M9 (3dae095) merged with local on-device backend | pass | pass | 87 pass (shared 31, api 32, admin 6, mobile 18) | API on fresh PGlite seeded, `/health` and `/guest/catalog` smoke-tested, admin and mobile web dev servers up |
| 2026-11-19 | End-to-end interactive video (browser) | n/a | n/a | n/a | Admin created branching adventure, uploaded MP4 scene clip, published; mobile web guest (age 6) saw it, video looped with choices, ending reached; admin dashboard showed 1 play, 1 completion |
| 2026-11-19 | Storybook Playground redesign (see REDESIGN.md) | pass | pass | 118 pass (tokens 18, art 8, shared 35, admin 6, mobile 18, api 33) | Admin build; migration 0003 run on dev data; admin and mobile web checked in browser |
| 2026-11-24 | M10 timed video (targeted) | pending | pending | pending | Timestamp question/default-answer editor and mobile player in progress |
| 2026-11-25 | Pulled 2f379d7 (timed video questions, My Day My Way, kindness scene, branching preview, EAS) merged with local redesign | pass | pass | 133 pass (tokens 18, shared 40, art 8, admin 6, mobile 28, api 33) | Friend's emoji and hex colors converted to art keys and tokens; StoryPlayer and BodyEditors merged by hand; API on fresh seeded PGlite, admin and mobile web bundle served |
| 2026-11-25 | M11 full-brief features | pass | pass | 146 pass (tokens 18, shared 48, art 8, admin 6, mobile 31, api 35) | Admin production build; full mobile web export; live API smoke test of recommendations, story-choice analytics and status counts |
| 2026-11-26 | M12 pipelines, credits, sleep timer | pass | pass | 190 pass (tokens 18, art 10, shared 48, admin 6, mobile 47, api 61) | API, admin and mobile web run in the browser; content:report, approve-dev and adventures run on dev data |

## Dev accounts (seed script, local only)
- Admin: `admin@kidzo.local` / `KidzoAdmin2026`
- Demo parent: `parent@kidzo.local` / `KidzoParent2026`, PIN `1234`, children Mia (5) and Kayla (8)

## Needs Jay
- **Video API keys:** set `PEXELS_API_KEY` and `PIXABAY_API_KEY` in `apps/api/.env`, then run `pnpm content:import`. Without them only NASA and Wikimedia are searched, which will not reach 100+ real clips per age group. Decide where media lives first: a full import is 10 GB or more, which should not sit in OneDrive.
- **Finish generating:** run `pnpm content:generate` (about 2 hours for the remaining videos), then `pnpm content:adventures`, `pnpm content:approve-dev` and `pnpm content:report`. Stop `pnpm dev:api` first.
- **Longer learning videos and more quiz questions:** generated videos are 20 to 35 s with 1 question each. Older groups need longer scripts and 2 to 4 questions per video in `content/generate/*.json`.
- **Review imported titles:** some Wikimedia titles are scientific captions (for example the cichlid clip). Rename them during review.
- **Email provider:** password reset emails are only logged in development. In production nothing is sent until a provider (Resend, Postmark, SES) is wired into `apps/api/src/lib/mailer.ts`. Also set `PASSWORD_RESET_URL` if reset links should go through a web page or universal link.
- **Mobile LICENSE file:** `apps/mobile/LICENSE` is the Expo template's MIT license. Replace or remove it to match how you license KIDZO.
- **Manual device pass:** screens were verified by typecheck, lint, tests and a web bundle. Run the app on a real iPhone and Android phone before release.
- **Production Postgres:** set `DATABASE_URL` (Neon, Supabase, RDS). PGlite is for local dev only.
- **JWT secret:** set `JWT_SECRET` (32+ random chars) in production.
- **Media storage:** uploads go to local disk. A cloud bucket (S3, R2, GCS) needs credentials; implement `MediaStorage` in `apps/api/src/lib/storage.ts`.
- **Video delivery:** the current upload endpoint buffers video files in memory before writing to local disk. Production needs streaming uploads and a cloud video/CDN setup before accepting large clips at scale.
- **Kinyarwanda and Kiswahili review:** UI translations for RW and SW were drafted by Claude and need a native speaker check. Story content is EN, with FR for some titles.
- **Real art and narration audio:** content uses emoji scenes and device text-to-speech until illustrations and recorded audio exist.
- **Interactive branch footage:** the four bundled source excerpts do not contain all alternate morning-routine scenes. Produce and upload a separate clip for every answer destination; the Talk, Play, Thrive source still needs editorial review and excerpting.
- **App store accounts and EAS:** Apple and Google developer accounts, `eas init` project id, bundle ids.
- **Legal:** privacy policy and terms URLs, and a COPPA / GDPR-K review. The app records parental consent at signup and supports export and delete.
- **Rendered recap videos:** the personal recap plays inside the app. Producing a shareable MP4 per child needs a server-side render pipeline (for example ffmpeg or Remotion workers) plus storage and a decision on whether recap files may leave the device under your privacy policy.
- **Separate reviewer role:** any admin can approve content in review. If writers and approvers should be different people, add a reviewer role.
- **Mascot art for Zo:** only the logo exists. Zo is drawn from the logo star for now.

## Notes
- Expo packages are pinned to the 58.0.25 patch line. pnpm's minimumReleaseAge policy rejected the 58.0.26 releases from 2026-11-17, so the lockfile was rebuilt (old copy not kept in the repo). After 2026-11-18 12:00 UTC you can bump with `npx expo install --fix`.
- `apps/admin/package.json` had lost its dependency list. It was restored from the code's imports.
- PGlite cold start takes about 30 s on this machine, so API test files run one at a time.
- OneDrive makes Metro miss files in folders it has not synced yet (Node lists them as symlinks), so the web bundle fails with "Unable to resolve". Rewriting the files fixed it on 2026-11-26. Moving the repo outside OneDrive avoids it for good.
- Installs are slow because the repo is inside OneDrive. Consider moving it outside OneDrive.
- The local PGlite database was corrupted twice on 2026-11-25 while inside OneDrive (sync plus several API processes). On this machine `apps/api/.env` now sets `PGLITE_DIR=C:/Users/hp/.kidzo/pglite`. Run only one `pnpm dev:api` at a time.
- Media uploaded in development is saved as `http://localhost:4000/media/...`. The mobile app now rewrites loopback media links to the API address it uses (`apps/mobile/src/lib/media-url.ts`), so uploaded videos play on a phone.
