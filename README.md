# Alfaterm — Client (Web)

Vite + React SPA for Alfaterm. Split out of the original monorepo; the API lives
in a separate `alfaterm-server` repo.

## Run locally
```bash
pnpm install        # or npm install
pnpm dev            # Vite dev server (http://localhost:3000)
```
In dev, requests to `/api` are proxied to the backend (see `vite.config.js`,
target `http://localhost:5001`). Start `alfaterm-server` alongside it.

## Environment
- `VITE_API_URL` — backend API base URL. Empty → same-origin `/api` (dev proxy).
  For a separately hosted backend set e.g. `https://api.example.com/api`.
  See `.env.example`.

## Build & deploy (Vercel or any static host)
```bash
pnpm build          # outputs dist/
```
- Framework: Vite (auto-detected by Vercel).
- `vercel.json` rewrites all routes to `index.html` for client-side routing.
- Set `VITE_API_URL` in the host's env to point at the deployed backend.
