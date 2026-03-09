# Phase 0 Repo Stabilization Report

Date: 2026-03-09
Branch: `chore/phase-0-repo-stabilization`
Scope: Stabilization only (no feature, widget, or business-logic redesign work)

## 1) Files Restored

No additional restore operation was required in this pass because the required core files were already present and tracked in git history.

Verified present and tracked:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `postcss.config.mjs`
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `prisma/seed.mjs`
- `prisma/seed.ts`
- `vitest.config.ts`
- `README.md`
- `tests/*`
- `scripts/db-bootstrap.mjs`
- `scripts/db-doctor.mjs`

## 2) Files Recreated

- `docs/PHASE_0_REPORT.md` (this report)

## 3) Files Removed From Source Control / Local Artifact Cleanup

Confirmed not tracked by git and ignored:

- `.env`
- `.env.local`
- `.next`
- `node_modules`
- `coverage`
- `.turbo`
- `dist`

Local generated artifacts removed from working tree during this pass:

- `.next/`
- `node_modules/`

## 4) Stabilization Changes Made (Minimal)

- `.gitignore`
  - Ensured ignore coverage for `.env`, `.env.local`, `.next`, `node_modules`, `coverage`, `.turbo`, and `dist`.
- `.env.example`
  - Removed machine-specific LAN IP default.
  - Kept only non-secret placeholder values.
  - Added documented optional aliases used by current provider/env parsing.
- `next.config.ts`
  - Removed hardcoded machine-specific LAN fallback (`192.168.220.1`).
  - Now only includes LAN origin when `NASHBOARD_DEV_HOST` is explicitly set.
- `package.json`
  - Added explicit Prisma aliases:
    - `prisma:generate`
    - `prisma:migrate`
    - `prisma:seed`
  - Added `postinstall: prisma generate` so fresh installs produce Prisma client automatically.
- `app/api/health/data/route.ts`
  - Applied type-only fix for a strict TypeScript compile error (implicit `any` in `reduce` callback).
  - No behavior change intended.

## 5) Verification Results

Executed and passed:

- `npm install`
- `npm run lint` (warnings only, no errors)
- `npm run test` (82 tests passed)
- `npm run build` (success)
- `npm run dev -- --hostname 127.0.0.1 --port 39125` (server reached Ready state in smoke check)

## 6) Unresolved Issues (Non-Blocking)

- ESLint warnings: `@next/next/no-img-element` in existing widget files (no stabilization break; left untouched).
- Repeated `baseline-browser-mapping` staleness warnings during lint/build.
- `npm audit` reports vulnerabilities; not changed in Phase 0 to avoid unscoped dependency churn.

## 7) Exact Local Setup Commands

From a fresh clone:

```powershell
git clone <repo-url>
cd "NashBoard - 1.0/NashBoard"
Copy-Item .env.example .env.local
npm install
```

Database bootstrap (Docker Postgres path):

```powershell
npm run db:doctor
npm run db:bootstrap
```

Database bootstrap (external Postgres path):

```powershell
# 1) Set DATABASE_URL in .env.local
npm run prisma:migrate
npm run prisma:seed
```

Run app and tests:

```powershell
npm run dev
npm run test
```
