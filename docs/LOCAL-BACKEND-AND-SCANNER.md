# Local Backend and Barcode Scanner

Last updated: April 13, 2026

## What works now

- Local email/password accounts
- Cloud-style collection sync against the local backend
- Sync of library state, custom catalog, currency choice, and barcode mappings
- Barcode scanning from a camera photo or uploaded image where `BarcodeDetector` is supported
- Manual barcode entry fallback
- One-time barcode-to-game linking so future scans recognize the same code instantly

## Run the backend

```powershell
npm run backend
```

Backend URL:

```text
http://127.0.0.1:8787
```

Health check:

```text
http://127.0.0.1:8787/health
```

## Run the app

```powershell
npm run dev
```

## Important notes

- The backend stores account data locally in `server/data/db.json`.
- That file is ignored by git.
- This is a working local backend, not a public hosted production backend yet.
- Barcode scanning depends on browser/device support for `BarcodeDetector`. If unsupported, manual barcode entry still works.

## Best next step for production

Move the backend to a hosted service and keep the same sync shape:

- auth
- sync state
- barcode mappings

That will let the current frontend transition to real multi-device cloud sync with minimal rewriting.
