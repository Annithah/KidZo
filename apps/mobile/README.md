# KIDZO mobile app

Expo SDK 58 app with Expo Router. See the root README for the whole project.

## Run

```bash
pnpm db:seed          # once, to add the sample catalog
pnpm dev:api          # from the repo root, in one terminal
pnpm --filter @kidzo/mobile exec expo start --lan  # in another terminal
```

The signed-out app opens directly to the age-appropriate guest experience without requiring an
account. After age selection, the guest catalog highlights a story the child can tap to start;
stories keep their interactive choices and narration. Account creation and sign-in remain available
from the welcome screen.

For ages 5–10, the guest home includes **My Day, My Way**, an offline interactive video lesson.
It uses four bundled 14-second excerpts from the supplied Power of Routine, Visual Schedules,
Foundations to Communication, and technology-development videos. Each clip plays before a timed
question appears; the player pauses, shows a three-second countdown, and follows the selected or
configured default answer. Answer selections are included in the play path.

The supplied footage does not contain distinct animated alternatives for every answer. The demo
therefore uses the source excerpt and choice-specific feedback, rather than claiming unseen footage
exists. To publish fully visual branches for the example morning routine, upload additional clips
for brushing teeth, safe showering, and breakfast, plus any distinct follow-up scenes (wash face,
get dressed, comb hair, breakfast choices, and getting ready for school). The admin editor blocks
publishing a timed question until each answer destination has its own video clip. The provided
Talk, Play, Thrive video has not yet been excerpted into this demo.

In the admin visual editor, enable a timed question on a scene with choices, set its timestamp,
choose the default answer, and upload the source clip and each answer-destination clip. Open
**Preview and test answer paths** to play the flow and exercise every answer branch. The timeout
is fixed at exactly three seconds.

In Expo LAN mode, the mobile app reaches the API on port 4000 of the Metro host. Start the API
first and keep the phone and computer on the same Wi-Fi. Expo tunnel mode tunnels Metro only, not
the KIDZO API; set `EXPO_PUBLIC_API_URL` to a reachable API address when using a tunnel or a
preview/production build (see `.env.example`).

## Layout

- `src/app` - screens and layouts (Expo Router). `welcome`, `sign-in`, `sign-up`,
  `forgot-password` and `reset-password` are for signed-out parents; `(app)/kid` is the kid
  experience and `(app)/parent` is the PIN-gated parent area.
- `src/components` - design-system components, story, quiz and song players.
- `src/lib` - API client, session, offline downloads and queue, play-time ledger, sync.
- `src/i18n` - English, French, Kinyarwanda and Kiswahili strings.

## Deep links

The `kidzo` scheme opens password reset links: `kidzo://reset-password?token=...`.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test
```
