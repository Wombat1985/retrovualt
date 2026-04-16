# Live Website Launch

Retro Vault Elite is ready to launch as a public website while the mobile-store accounts are still in progress.

## Best launch path right now

Use two services:

1. Static frontend hosting for the Vite app
2. One small backend host for accounts, sync, and barcode mappings

The fastest options already prepared in this repo are:

- `render.yaml` for a full Render setup
- `netlify.toml` for Netlify frontend hosting
- `vercel.json` for Vercel frontend hosting

## Fastest full-stack option: Render

This repo now includes `render.yaml`, which defines:

- `retro-vault-web` for the public website
- `retro-vault-backend` for the sync backend

### Render setup

1. Push this repo to GitHub
2. In Render, create a new Blueprint from the repo
3. Set `VITE_API_BASE_URL` on the web service to your backend URL
4. Set `CORS_ORIGIN` on the backend service to your frontend URL
5. Deploy both services

Example values:

- `VITE_API_BASE_URL=https://retro-vault-backend.onrender.com`
- `CORS_ORIGIN=https://www.retrovaultelite.com,https://retrovaultelite.com,https://retro-vault-web.onrender.com`

## Frontend-only option

If you want the website live even before public accounts matter, you can deploy just the frontend.

For that mode:

1. Host `dist`
2. Point `VITE_API_BASE_URL` at your deployed backend later
3. Until then, account sync features will not work publicly

## Recommended public launch checklist

- Set a real production domain
- Replace test AdMob values before mobile release
- Publish a real privacy-policy URL
- Add a simple landing/support email
- Test account signup, login, sync, import/export, and barcode linking on the live site
- Test mobile browser install flow

## Best next product moves for growth

If the goal is to become the most wanted retro collector app, the biggest growth features from here are:

- generated share cards people post on social
- public collector profiles or shelf snapshots
- price-drop notifications by email or push
- richer game pages with publisher, genre, and release notes
- onboarding that asks favorite consoles and instantly personalizes the app
