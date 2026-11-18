# KIDZO mobile app

Expo SDK 58 app with Expo Router. See the root README for the whole project.

## Run

```bash
pnpm dev:api          # from the repo root, in one terminal
pnpm dev:mobile       # in another, then press i, a or w
```

In development the app reaches the API on port 4000 of the Metro host, so a phone on the
same Wi-Fi works without config. Set `EXPO_PUBLIC_API_URL` for preview and production builds
(see `.env.example`).

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
