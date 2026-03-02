# Local Setup

## 1) Fast start (guest only, no DB/auth)
1. Leave `DATABASE_URL`, `NEXTAUTH_*`, and `GOOGLE_*` unset.
2. Run:
```bash
npm install
npm run dev
```
3. Open app.
4. Expected status banner: `DB offline ... guest/session-only mode`.
5. Guest behavior:
   - widgets can be added/removed/moved/locked/reset
   - state resets when browser session ends

## 2) Real platform mode: Postgres + persistence
1. Copy `.env.example` to `.env.local` and keep DB defaults or edit values.
2. Run Docker diagnostics first (recommended on Windows):
```bash
npm run db:doctor
```
3. One-command bootstrap:
```bash
npm run db:bootstrap
```
4. Or run steps individually:
```bash
npm run db:up
npm run db:migrate
npm run db:seed
```
5. Start app:
```bash
npm run dev
```
6. Expected status:
   - signed-in users: `Signed in ... persist to database`
   - signed-out users: `Guest mode ... Sign in to save`

## Docker Desktop on Windows
If `docker compose up -d postgres` fails with `open //./pipe/dockerDesktopLinuxEngine`:
1. Ensure Docker Desktop is installed and running.
2. Open Docker Desktop settings and enable `Use the WSL 2 based engine`.
3. Verify WSL is healthy:
```bash
wsl --status
```
4. Check Docker contexts:
```bash
docker context ls
```
5. Switch to Linux desktop context if needed:
```bash
docker context use desktop-linux
```
6. Re-run:
```bash
npm run db:doctor
npm run db:bootstrap
```

## External Postgres Fallback (No Docker)
If Docker is unavailable, use an external Postgres (Neon, Supabase, or local installed Postgres).
1. Set `DATABASE_URL` in `.env.local`:
```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public"
```
2. Run migrations and seed:
```bash
npm run db:migrate
npm run db:seed
```
3. Start app:
```bash
npm run dev
```

## 3) Optional Google sign-in
Set these in `.env.local`:
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `DATABASE_URL` (required for persistent auth session strategy)

Use exact `NEXTAUTH_URL` matching the hostname in browser:
- `http://localhost:3000`
- `http://192.168.220.1:3000`

Google OAuth console:
- Authorized redirect URIs:
  - `http://localhost:3000/api/auth/callback/google`
  - `http://192.168.220.1:3000/api/auth/callback/google`
- Authorized JavaScript origins:
  - `http://localhost:3000`
  - `http://192.168.220.1:3000`

## 4) Verify persistence
1. Run in DB mode (`npm run db:up`, `npm run db:migrate`, app running).
2. Add widgets and watchlist teams.
3. Refresh browser.
4. Expected: layout/widgets/watchlist remain.

## Local Network Access
1. Start dev server on all interfaces:
```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```
2. Open from another device:
```text
http://192.168.220.1:3000
```
3. If using LAN host, set `NEXTAUTH_URL` to that exact LAN URL.
4. Keep hostname consistent:
   - if UI is on LAN host, test `/api/*` on LAN host too
   - if UI is on localhost, test `/api/*` on localhost too
5. Use `/api/health/origin` to debug host/origin/cookie mismatches.

## Notes
- Data mode resolution: query `dataMode` -> dev override (non-production only) -> persisted preference (`/api/preferences/data-mode`) -> `live`.
- Cookies are hostname-scoped: `localhost` cookies are not sent to `192.168.x.x`, and vice versa.
- `next.config.ts` uses `allowedDevOrigins` for localhost, loopback, and `NASHBOARD_DEV_HOST`.
