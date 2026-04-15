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

## Launch it as a public website

This repo now includes ready-to-use deployment files for:

- `render.yaml` for a full web + backend launch on Render
- `netlify.toml` for Netlify frontend hosting
- `vercel.json` for Vercel frontend hosting

For the quickest public launch path, use the Render blueprint in `render.yaml`.
