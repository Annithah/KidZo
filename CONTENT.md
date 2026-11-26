# KIDZO video library

How videos get into KIDZO, who sees them, and the commands that manage them. Run all commands from
the repo root. They use the same database and media storage as the API (`apps/api/.env`). Run only
one of them at a time, and stop `pnpm dev:api` first, because the local PGlite database allows a single process.

## Commands

| Command | What it does |
|---|---|
| `pnpm content:import [--dry-run] [--limit N] [--only id,id] [--max-mb 400]` | Searches Pexels, Pixabay, NASA and Wikimedia Commons following `content/import-plan.json`, filters for safety, downloads, makes 480p and 720p variants and a thumbnail, and saves each clip in review. |
| `pnpm content:generate [--dry-run] [--limit N] [--topics a,b] [--ids a,b]` | Builds KIDZO's own narrated learning videos from `content/generate/*.json`, each with its quiz, in review. |
| `pnpm content:adventures [--dry-run]` | Builds the 9 branching adventures in `content/adventures/*.json` from library clips. Run it again after importing or generating to link new clips. |
| `pnpm content:report` | Published, in review and draft counts per category and age group, and the categories below 12 published items (those stay hidden). |
| `pnpm content:approve-dev` | Local development only. Publishes imported and generated items so the app can be tested without reviewing every item. Refuses to run when `NODE_ENV=production`. |

All commands are idempotent. Imports are deduplicated by source and original id, generated videos
by their id in the data file, and adventures by slug, so running a command twice creates no duplicates.

## Review is mandatory

Nothing is published automatically. Imported and generated items land in review. In production a
reviewer approves each one in the admin dashboard (draft, review, published), checks the age group
badges and changes them if needed. `content:approve-dev` exists only for local testing.

## Sources and licenses

| Source | Needs | License kept |
|---|---|---|
| Pexels | `PEXELS_API_KEY` | Pexels License |
| Pixabay | `PIXABAY_API_KEY` (SafeSearch always on) | Pixabay Content License |
| NASA Image and Video Library | nothing | Public Domain |
| Wikimedia Commons | nothing | CC0, Public Domain or CC-BY only |
| KIDZO generated | FFmpeg (bundled through ffmpeg-static) and a TTS voice | Owned by KIDZO |

When a key is missing, the importer prints which source it skipped and continues with the others.
YouTube, TikTok, Vimeo and any commercial cartoon or TV content are never used.

Every clip stores its source, source URL, original id, author, license, attribution text and
download date. Parents can see this on the Video credits screen (Account, Video credits), served by
`GET /catalog/credits`.

## Safety filters (importer)

- A blocklist of words in titles, tags and descriptions (violence, weapons, scary, alcohol and so on).
- Allowed subjects only (animals, nature, space, farms, vehicles, music, weather, Rwanda and African landscapes and wildlife, and similar).
- License check, length limits for the age group, and at least 720p source resolution.
- Source audio is dropped when its music rights are unclear (the clip is marked `audio: none`).

The dry run summary lists how many results each filter removed.

## Age groups

| Group | Ages | Longest video | Answers per question |
|---|---|---|---|
| Little Explorers | 2 to 5 | 3 min | 2, no timer before answering |
| Young Adventurers | 6 to 8 | 6 min | 3 |
| Big Explorers | 9 to 12 | 12 min | 3 or 4 |

Every item has `age_groups`, set by the plan file or the generator data. The API reads the child's
group from the child-scoped token (`x-kidzo-child`) and filters every catalog route by it, plus
the parent's category blocks. A category shows for a group only once it has 12 published items.

## Adding content

- More imports: add an entry to `content/import-plan.json` (category, age groups, search terms, count, length limits).
- More generated videos: add a row to the right file in `content/generate/` (scenes with art and narration, plus the quiz).
- More adventures: add a file to `content/adventures/`.

## TTS voices

`KIDZO_TTS=windows|espeak|piper|none`. By default the first available voice is used; on Windows
that is the built-in speech voice. Recorded voice-over can replace it later.
