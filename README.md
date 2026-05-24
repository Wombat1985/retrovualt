# Retro Vault Collector

A responsive retro video game collection app built with Vite and TypeScript.

## What this version includes

- Works in a browser on phones, tablets, laptops, and desktops.
- PWA install support for an app-like experience.
- Capacitor config for an iPhone and Android packaging path.
- Real sample box art images for a larger starter retro catalog.
- Current sample market prices in USD.
- Full-color covers for every game, with clearer ownership badges and collection stamps.
- Search, console filtering, sorting, smart lists, wishlist tracking, top-shelf favorites, spotlight cards, and browser-local persistence.
- Local account backend, cloud-style sync, barcode linking, collector notes, condition/edition tracking, and target-price alerts.
- JSON import and export for growing the catalog.

## Run it

```bash
npm install
npm run backend
npm run dev
```

If you want the frontend to point somewhere other than `http://127.0.0.1:8787`, create `.env` from `.env.example` and set `VITE_API_BASE_URL`.

## Build it

```bash
npm run build
```

## Generate short-form promo videos

This repo already includes a working browser-capture + FFmpeg pipeline under [C:\Users\krist\OneDrive\Desktop\retro-game-collector\video-generator](C:\Users\krist\OneDrive\Desktop\retro-game-collector\video-generator). The short-form batch system builds on that instead of creating a second video stack.

Editable config lives in:

- [C:\Users\krist\OneDrive\Desktop\retro-game-collector\video-assets\short-form-videos.json](C:\Users\krist\OneDrive\Desktop\retro-game-collector\video-assets\short-form-videos.json)

What you can edit there:

- hook text
- scene captions
- voiceover text
- YouTube title and description copy
- Reddit and X post copy
- base URL
- demo account credentials for auth-required videos

Before the first run:

```bash
npm install
npx playwright install chromium
```

Optional:

- Drop a licensed `.mp3`, `.wav`, `.m4a`, `.aac`, or `.ogg` track into [C:\Users\krist\OneDrive\Desktop\retro-game-collector\video-assets\music](C:\Users\krist\OneDrive\Desktop\retro-game-collector\video-assets\music). If you do not, the system falls back to generated retro audio.
- Update the demo account credentials in the config if you want the trade/auth videos to log into a different account.

Generate all 10 vertical videos:

```bash
node video-generator/scripts/generate-short-form-batch.js
```

Generate just one video:

```bash
node video-generator/scripts/generate-short-form-batch.js --only 4
```

Skip the demo-account seed step:

```bash
node video-generator/scripts/generate-short-form-batch.js --skipAuthSeed
```

Outputs land here:

- final vertical videos: [C:\Users\krist\OneDrive\Desktop\retro-game-collector\generated-videos](C:\Users\krist\OneDrive\Desktop\retro-game-collector\generated-videos)
- working capture/render runs: [C:\Users\krist\OneDrive\Desktop\retro-game-collector\video-generator\exports](C:\Users\krist\OneDrive\Desktop\retro-game-collector\video-generator\exports)

The batch also writes:

- `captions.txt`
- `reddit-ad-titles.txt`
- `youtube-shorts-descriptions.txt`
- `x-posts.txt`

All final videos are exported as `1080x1920` MP4 files named:

- `01-collection-tracker.mp4`
- `02-duplicates-for-trade.mp4`
- `03-wanted-list.mp4`
- `04-trade-matches.mp4`
- `05-no-more-spreadsheets.mp4`
- `06-collector-vision.mp4`
- `07-feature-feedback.mp4`
- `08-discogs-for-games.mp4`
- `09-private-user-trading.mp4`
- `10-built-for-collectors.mp4`

## Sync mobile builds

```bash
npm run cap:sync
```

## Refresh the retro catalog

```bash
npm run catalog:generate
```

This regenerates the local retro catalog JSON used by the app.

## JSON import shape

Import an array of objects with these fields:

```json
[
  {
    "id": "ps1-crash-bandicoot",
    "title": "Crash Bandicoot",
    "console": "PlayStation",
    "year": 1996,
    "region": "North America",
    "coverUrl": "https://example.com/real-cover.jpg",
    "priceLoose": 18.5,
    "priceComplete": 42.0,
    "priceSourceUrl": "https://example.com/price-page",
    "coverSourceUrl": "https://example.com/cover-source",
    "trendDelta": 2.4,
    "rarity": "Classic"
  }
]
```

## Current backend shape

The app now includes a working local backend for:

- email/password accounts
- collection sync
- barcode-to-game mapping

See:

- `docs/LOCAL-BACKEND-AND-SCANNER.md`
- `docs/HOSTED-BACKEND-DEPLOYMENT.md`
- `docs/LIVE-WEBSITE-LAUNCH.md`
- `docs/PRODUCTION-AUTH-EMAIL.md`

## Launch it as a public website

This repo now includes ready-to-use deployment files for:

- `render.yaml` for a full web + backend launch on Render
- `netlify.toml` for Netlify frontend hosting
- `vercel.json` for Vercel frontend hosting

For the quickest public launch path, use the Render blueprint in `render.yaml`.
