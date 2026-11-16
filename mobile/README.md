# LEFT — mobile app

The Expo (SDK 58) app for LEFT, a disposable camera for events. The project
guide is [`../CLAUDE.md`](../CLAUDE.md); the road to launch is
[`../docs/MILESTONES.md`](../docs/MILESTONES.md).

## Running it

```bash
npm install
npm start
```

Scan the QR code with **Expo Go** to walk the navigation. The camera, sign-in,
purchases, notifications and QR scanning need a dev build (`eas build --profile development`).

Other scripts: `npm run typecheck`, `npm run lint`.

## Environment

```bash
cp .env.example .env      # then fill in the two Supabase values
```

The app boots without a `.env`; screens that read data will error. On a physical
device use the machine's LAN IP, not `127.0.0.1`.

Docs: [docs/social-sign-in.md](docs/social-sign-in.md) (Google and Apple),
[docs/payments.md](docs/payments.md) (the four price tiers and RevenueCat),
[docs/analytics.md](docs/analytics.md) (usage statistics and error reports —
off without a key).
