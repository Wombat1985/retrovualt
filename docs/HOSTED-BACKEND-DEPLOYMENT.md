# Hosted Backend Deployment

Last updated: April 13, 2026

## Goal

Move the working local backend to a hosted environment without changing the frontend sync model.

## What was prepared

- Frontend API base URL now comes from `VITE_API_BASE_URL`
- Backend supports:
  - `PORT`
  - `DATA_DIR`
  - `CORS_ORIGIN`
  - `SESSION_TTL_DAYS`
  - `PASSWORD_RESET_TTL_MINUTES`
  - `RESEND_API_KEY`
  - `RESET_FROM_EMAIL`
- Docker image file: `Dockerfile.backend`
- Render starter config: `render.backend.yaml`

## Local development

Create `.env` from `.env.example`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787
```

Run backend:

```bash
npm run backend
```

Run app:

```bash
npm run dev
```

## Hosted deployment pattern

1. Deploy the backend first.
2. Set `CORS_ORIGIN` to your web app domains.
3. Get the hosted backend URL.
4. Set `VITE_API_BASE_URL` in the frontend environment.
5. Rebuild the frontend and resync Capacitor.

For the current live site, use:

```bash
CORS_ORIGIN=https://www.retrovaultelite.com,https://retrovaultelite.com,https://retro-vault-web.onrender.com
RESET_FROM_EMAIL=Retro Vault Elite <retrovaultelite@gmail.com>
```

## Example Render setup

- Use `render.backend.yaml` or create the service manually.
- Add a persistent disk if you want the JSON database to survive restarts.

Important:
- This backend currently uses a JSON file database.
- That works for early launch and testing.
- For serious production scale, move to a real database later.

## Recommended future production upgrade

When usage grows, replace JSON storage with:

- Postgres
- hosted auth/session storage
- server-side barcode mapping table
- server-side collection table

The current routes were designed to make that transition easier later.
