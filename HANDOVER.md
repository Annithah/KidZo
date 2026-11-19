# KIDZO development handover

## Repository

- Location: `C:\Users\user\Desktop\kidzo`
- Branch: `main`
- Changes are uncommitted. Do not commit or push; the owner handles commits.
- Preserve the supplied requirements PDF: `kidzo document  (1).pdf`.
- Read this file together with `PROGRESS.md` and `README.md` before continuing.

## Product and stack

KIDZO is an interactive learning and entertainment app for children ages 2 to 12, with
parent controls and a content administration dashboard. The repo is a pnpm monorepo:

- `packages/shared`: schemas, types, play rules and story graph logic.
- `apps/api`: Fastify, Drizzle and PostgreSQL; PGlite is used locally without `DATABASE_URL`.
- `apps/mobile`: Expo SDK 58, React Native, Expo Router.
- `apps/admin`: Vite and React dashboard.

## Current implementation

The previous completed milestone was M8, the admin performance dashboard. The current work
adds M9:

- Added guest age selection and age-filtered catalog/content APIs. The guest age remains only
  in app memory; no guest or child profile is created.
- Added guest playback reporting. The API validates completed story paths and aggregates
  play count, completion count and durations by content and UTC date. It does not retain a
  guest identifier. The admin performance endpoint includes these aggregates.
- Guest catalog/content APIs use POST request bodies for age filters rather than query-string
  parameters, avoiding age in request URLs.
- Added optional MP4 clips to branching story scenes, admin upload/preview, and looping video
  playback in the mobile story player. Emoji scenes remain the fallback when video playback
  fails.
- MP4 uploads are limited to 100 MB and checked by file signature. Media is currently stored
  on local disk, with request data buffered in memory.
- Added guest flow copy in English, French, Kinyarwanda and Kiswahili.
- Added migration `apps/api/drizzle/0002_amazing_roxanne_simpson.sql` and its snapshot.
- Updated `README.md` and `PROGRESS.md`.

## Verification

- Full workspace `pnpm check` passed: typecheck, lint and 84 tests (shared 31, API 32,
  admin 6, mobile 15).
- After the full check, the final mobile-only adjustments passed mobile typecheck and lint.
- Admin production build passed.
- Mobile web export passed.
- API production bundle passed after replacing the unsupported tsup CLI flag with
  `apps/api/tsup.config.ts`.
- Started the built API with an in-memory PGlite database and confirmed `/health` returned
  `{"status":"ok"}`; the temporary server was stopped afterward.
- Guest integration tests cover public age filtering, age-inappropriate denial, completion
  validation, aggregate-only persistence, and inclusion in admin stats.
- MP4 upload coverage checks detected content type and `.mp4` storage URL.
- The API build script previously failed because tsup 9 rejects `--noExternal` as a CLI option.
  The build now uses tsup configuration and succeeds.

## Next steps

1. If any code changes follow, rerun the smallest relevant checks; the latest full workspace
   test run predates the final mobile-only state and age-guard adjustments.
2. Perform manual playback and guest-flow checks on iPhone and Android devices.
3. Before production, replace local buffered media handling with streaming/cloud storage and
   suitable video delivery/CDN infrastructure.
4. Continue the remaining brief items in `PROGRESS.md`: interest-based recommendations,
   personalized recap video generation, parent category controls, popular story choice/ending
   analytics, and separate review states.
5. Owner decisions/accounts still needed include production database and JWT secret, email
   provider, cloud media credentials, app-store/EAS accounts, privacy/legal review and native
   speaker review of Kinyarwanda and Kiswahili.

## Local development

Use the startup and check instructions in `README.md`. `pnpm` may need to be invoked through
`npm exec --yes --package=pnpm@12.21.0 -- pnpm ...` on this machine if it is not on `PATH`.
API tests start embedded databases and should be run sequentially.
