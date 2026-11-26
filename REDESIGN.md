# KIDZO redesign: "Storybook Playground"

Brand and UI overhaul of the mobile app (child area, guest flow, parent center) and the admin
dashboard. Functionality, routes, API calls and tests stay the same. This file tracks the audit,
the plan, decisions and per-phase verification.

## Phase 1: Audit (done 2026-11-19)

### Screens
**Mobile, public:** welcome, sign-in, sign-up, forgot-password, reset-password, guest/age,
guest/home, guest/play/[id].
**Mobile, child:** (app)/index (who is playing), kid/home (day + calm variants),
kid/content/[id], kid/play/[id] (story, quiz, song players, time's up), kid/complete,
kid/blocked, kid/replay, kid/stickers.
**Mobile, parent:** ParentGate (PIN create, confirm, enter, offline math), parent/index
(control center), parent/limits/[id], parent/child/new, parent/child/[id], parent/downloads,
parent/account.
**Admin:** Login, Dashboard, ContentList, ContentEditor (branching, quiz, song body editors,
JSON tab, video upload), Stickers, Users (Families), Audit.

### Shared components
Mobile: Button, Typography (Text), Layout (Screen, Header, Card, Row, Chip, SectionTitle),
Controls (TextField, ToggleRow, Stepper, ProgressBar, Segmented), Kid (Avatar, StarCounter,
ContentCard), States (Loading, Error, Empty, OfflineBanner, InlineMessage), Zo (PNG + drawn face),
PinPad, ParentGate, ChildForm, players (StoryPlayer, QuizPlayer, SongPlayer).
Admin: ui.tsx (Loading, ErrorBox, Empty, Field, LocalizedInput, StatusBadge), BodyEditors,
one global `styles.css`.

### Emoji usage (247 lines, 31 files; `node scripts/check-style.mjs --report`)
- **As UI icons:** admin sidebar (5), mobile buttons and labels (lock, family, play, replay,
  stickers, read aloud, stop, done, sparkles filter, offline antenna, timer, child, star,
  sync, shield, download, storage, pencil, moon, speaker), chips, tile icons, check badge,
  back chevron and close glyphs.
- **As images/data:** `Sticker.emoji`, `Content.coverEmoji`, story `scene.emoji`, story
  `choice.emoji`, quiz `question.emoji` and `option.emoji`, song `line.emoji`,
  `AVATAR_EMOJI` (8 avatars), blocked-screen art, replay clapper, quiz count prompts
  (for example three apples).
- **Seed data:** 46 distinct emoji in `apps/api/src/seed-data.ts` and the copy in
  `apps/mobile/src/lib/local-backend/seed-data.ts` (85 lines each).
- **Defaults:** admin `content-model.ts` blank drafts (sparkle, question, letters A/B, note).
- **Tests:** shared, API and admin tests build fixtures with emoji.

### Hardcoded styles (164 hex lines)
- `packages/shared/src/tokens.ts` (36): old palette, Baloo 2, pressedShade map.
- `apps/admin/src/styles.css` (30): duplicated palette as CSS variables plus literal shades.
- Seed data (42 each), scene/cover colors stored as data (stay data, but default to token
  values).
- Literal hex in mobile screens: content detail chips, parent stat tiles, InlineMessage
  backgrounds, quiz correct tint, Button moon edge, BodyEditors/Stickers defaults.
- Shadows are grey-navy `rgba(27,42,78,...)`, not tinted. Radii 12/20/24/28 (not the new scale).
- Fonts: Baloo 2 + Nunito loaded from Google Fonts on admin, expo-google-fonts on mobile.

### Validation UX today
- Mobile forms use `lib/form.ts` with raw Zod messages keyed by path.
- Admin content editor shows every schema issue as `path: message` in one box
  (for example `title.en: Too small: expected string to have >=1 characters`).
- Admin sticker form joins raw issues into one string. Server returns raw Zod messages.

## Plan
1. Audit (this section).
2. `packages/ui-tokens`: brand + world + feedback + bedtime colors with generated 50-900
   scales, semantic themes (light, bedtime, admin), Fredoka + Nunito type scale, radius
   8/12/16/24/32/full, 4pt spacing, 3 tinted elevations, touch targets, motion. Mobile theme and
   admin CSS variables generated from it. Contrast test.
3. Icon wrapper per platform (Phosphor duotone + bold), replace every UI emoji and glyph.
4. `packages/art`: one vector art DSL shared by both platforms (react-native-svg renderer on
   mobile, inline SVG renderer on admin). Stickers, objects, categories, avatars + wardrobe,
   Zo in 6 expressions, empty/error/offline/time-up/bedtime scenes. Data uses art keys
   (`sticker.ocean-pearl`). Schema fields renamed (`emoji` to `art`, `coverEmoji` to
   `coverArt`), SQL migration renames columns and converts values, plus an idempotent data
   migration for story/quiz/song bodies. Downloaded packages on devices are upgraded on read.
5. Component library rebuild on both platforms.
6. Admin redesign + validation UX (friendly per-field messages, blur/submit validation,
   auto slug, toasts, confirmation modal, skeletons).
7. Mobile child app redesign.
8. Mobile parent center redesign.
9. Accessibility, consistency script in lint, full check, screenshots, docs.

## Decisions and deviations (kept honest)
- **Contrast over white-on-coral.** White text on Coral #FF6B4A is 2.8:1 and fails WCAG AA
  even for large text. Primary buttons use Coral faces with Navy Ink labels (5.5:1); coral
  text on cream uses the darker `coral.700` shade. Verified by `packages/ui-tokens` tests.
- **No React Flow.** The admin story editor is a form list today, not a node canvas. Adding
  React Flow is new functionality, so the existing editor gets typed node cards (start,
  scene, choices, ending) with icons and colors instead.
- **Sidebar.** Items with real features: Dashboard, Content, Stories (content filtered to
  adventures and stories), Games (content filtered to games), Stickers, Families, Analytics
  (the existing performance stats on their own page), Audit log. Reviews, Jobs and Settings
  have no backing feature or API, so they are left out instead of linking to empty pages.
- **Categories.** The data model has skills and content types, not the 8 brief categories.
  All 8 category badges are drawn and mapped onto existing skills/types for display
  (for example Brain Games for games, Music & Dance for songs, Bedtime for calm content).
  No new category field.
- **Wardrobe.** Children have no wardrobe data. Hat, glasses, cape and crown layers are drawn
  and the Avatar component stacks them via an optional prop, but no picker is added.
- **Confetti and charts.** Reanimated confetti in brand colors instead of a Lottie file
  (no hand-made Lottie JSON or extra native module), and token-styled SVG charts instead of
  victory-native (which needs Skia). Same visual outcome, fewer native dependencies.
- **Art fidelity.** All illustrations are original vector art drawn in code with a shared
  style. They are production-usable but simple; an illustrator pass later can replace any
  key without touching screens or data.

## Progress
- [x] Phase 1 Audit
- [x] Phase 2 Tokens, fonts, theme providers: `packages/ui-tokens` (scales, light/bedtime/admin themes, Fredoka + Nunito, radius, 4pt spacing, tinted elevation, motion), contrast tests, mobile `theme/core.ts`, admin CSS variables generated at startup, fonts self-hosted on admin (no Google Fonts request).
- [x] Phase 3 Icon wrapper: shared `IconName` list in `@kidzo/art`, `<Icon>` on mobile (phosphor-react-native, per-icon imports) and admin (@phosphor-icons/react), duotone with brand secondary fill, bold for actions. Screen-by-screen replacement happens with each redesign phase below.
- [x] Phase 4 Art package + data migration: 107 pieces (55 objects, 12 stickers, 8 categories, 8 avatars, 4 wardrobe layers, Zo x 6, 6 scenes, 4 motifs) as shared shape data, renderers for react-native-svg and inline SVG, count keys (`object.apple*3`). Schema `emoji` to `art`, `coverEmoji` to `coverArt`; migration `0003_art_keys` renames columns and converts values, `upgrade-art.ts` converts bodies after migrations, devices upgrade downloads and the on-device database on read. Seeds use art keys and token colors.
- [x] Phase 5 Component library. Mobile: Text, Button (chunky edge, spring press, world colors, icons), IconButton, Screen (parallax world backdrop), Header, layered Card, Chip, TextField (inline error + icon), ToggleRow, Stepper, ProgressBar, SwooshProgress (stars along the swoosh), Segmented, Zo (6 moods) and ZoSays, States (swoosh loader, scene art), Sticker (die-cut, locked silhouette + lock, unlock shine), Avatar (wardrobe layers), ContentCard, TabBar (floating, animated bubble), Confetti, BarChart, ConfirmDialog. Admin: token stylesheet, Button, IconButton, Field, LocalizedInput with per-language errors, Skeleton, Empty (Zo art), PageHeader, Toasts, Modal with focus trap, ConfirmDialog, OverflowMenu, DataTable (search, sort, pagination), KpiCard with trend and sparkline, BarChart with screen reader table, RankList, ArtPicker.
- [x] Phase 6 Admin redesign + validation UX: navy sidebar (logo on cream card, grouped nav, coral active bar), top bar with breadcrumbs, content search and account menu; Dashboard (KPIs, daily chart, recent activity, most played), new Analytics page, Content list with Stories and Games views and overflow row actions, sectioned Content editor with per-field errors, auto slug, art pickers and typed scene cards, Stickers with art picker and previews, Families and Audit data tables, split-screen Login. Friendly validation (shared `errors.ts`) on blur and submit, server errors mapped to fields, destructive actions behind a confirmation modal, toasts for results.
- [x] Phase 7 Mobile child app: illustrated parallax backgrounds (clouds, hills, swoosh trail; moon and twinkling stars at bedtime), age-adaptive home (2 to 5 huge tiles, 6 to 8 category carousels, 9 to 12 dense grid), illustrated category tiles, floating tab bar, content detail with art cover and category badge, story player with Zo speech bubble, big illustrated choice bubbles and swoosh progress, quiz with art answers and marks, song lines with art, confetti celebration and sticker shine, illustrated blocked and time-up scenes, sticker album, welcome, sign-in, guest flow.
- [x] Phase 8 Mobile parent center: calm cards, icon tiles in world tints, stat tiles, SVG bar chart for the week, branded confirmation dialogs (exit, delete profile), icons throughout limits, downloads and account. Temporary theme bridge removed.
- [x] Phase 9: `scripts/check-style.mjs` runs first in `pnpm lint` and fails on emoji or hex outside `packages/ui-tokens`; WCAG AA contrast enforced by token tests; labels on every icon button; decorative art hidden from screen readers (aria-hidden on web); reduced motion respected (Reanimated and Motion, CSS fallback); 64 point targets for kid controls, 48 elsewhere; text scales to 1.6x; admin focus rings and modal focus trap; charts ship a hidden data table. Visual check in Chrome of admin login, dashboard, content list and editor (validation), and mobile welcome, guest age, guest home and the video story player.

## Verification log
| Phase | Typecheck | Lint | Tests | Style check | Notes |
|---|---|---|---|---|---|
| 1 | n/a | n/a | n/a | report only | 247 emoji lines, 164 hex lines in 31 files |
| 2-4 | tokens, art, shared, api pass; admin and mobile screens pending rewrite | pass | tokens 18, art 8, shared 31, api 33 (new migration test) | packages clean | Art reviewed visually in a rendered gallery; turtle and scene ground fixed after review |
| 5-9 | pass, all 6 packages | pass | 118 pass (tokens 18, art 8, shared 35, admin 6, mobile 18, api 33) | passes, wired into lint | Admin production build passes. Existing dev database migrated by 0003 with no emoji left. Fixed during visual check: hills layer, web accessibility props, login art, table wrapping |

## Known limits and next steps
- Art is original, code-drawn vector art in one consistent style. It is ready to ship, but an illustrator pass can replace any key later without touching screens or data.
- Kinyarwanda and Kiswahili labels added in this redesign (tabs, categories, story path) need a native speaker check, like the rest of those locales.
- Reviews, Jobs and Settings are not in the sidebar because there is no feature behind them yet.
- No React Flow canvas; scenes are typed cards in a list (see decisions above).
- Content created earlier with an emoji that has no matching art falls back to the sparkles picture; pick a new picture in the editor.
- Tested in a desktop browser. Check on real iPhone and Android devices (Expo Go supports every dependency used).
