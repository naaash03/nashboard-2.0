# NashBoard 2.0

NashBoard 2.0 boots with Postgres + NextAuth from day 1.

## Requirements

- Node.js 20+
- Docker Desktop (for local Postgres)

## Environment

Create `.env` in the repo root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nashboard"
NEXTAUTH_SECRET="dev-secret-long"
NEXTAUTH_URL="http://localhost:3000"
DEV_ADMIN_ENABLED="true"

# Optional Google OAuth
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
```

Google OAuth is optional. Auth routes only require `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`.

## Local Setup

1. Start Postgres:

```bash
docker compose up -d
```

2. Install dependencies:

```bash
npm install
```

3. Generate Prisma client:

```bash
npm run db:generate
```

4. Run migrations:

```bash
npm run db:migrate
```

5. Seed admin user:

```bash
npm run db:seed
```

6. Start app:

```bash
npm run dev
```

## Dev Credentials Login

When `DEV_ADMIN_ENABLED="true"`, a credentials provider is enabled with:

- username: `admin`
- password: `admin`

The admin account seeded/used is:

- email: `admin@nashboard.local`
- name: `Admin`
- role: `ADMIN`

## Prisma Scripts

- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:studio`