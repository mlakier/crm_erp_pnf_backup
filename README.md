# CRM/ERP PNF

Next.js + Prisma CRM/ERP application using PostgreSQL.

## Stack

- Next.js 16
- Prisma 5
- PostgreSQL
- NextAuth

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 14+ running locally (or a reachable PostgreSQL instance)

## Environment

Create/update `.env` with at least:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_erp_pnf?schema=public"
NEXTAUTH_URL="http://localhost:3003"
NEXTAUTH_SECRET="change-this-to-a-secure-random-value"
```

Adjust credentials/host/port for your environment.

## Install

```bash
npm install
```

## Database Setup (PostgreSQL)

Use migration-driven setup for local/dev consistency.

```bash
npx prisma migrate dev
npm run seed
```

If you need a clean local reset:

```bash
npx prisma migrate reset
```

This reapplies migrations and runs seed.

## Run Locally

```bash
npm run dev
```

Default app URL: http://localhost:3003

## Prisma Workflow

### Create a schema change

1. Update `prisma/schema.prisma`
2. Create/apply migration:

```bash
npx prisma migrate dev --name <change_name>
```

3. Commit:

- Updated `prisma/schema.prisma`
- New folder under `prisma/migrations/<timestamp>_<change_name>/migration.sql`

### Deploy migrations (non-dev)

```bash
npx prisma migrate deploy
```

### Regenerate Prisma client manually (if needed)

```bash
npx prisma generate
```

## Notes About SQLite History

- The active database provider is PostgreSQL.
- Legacy SQLite migration files were intentionally archived in `prisma/migrations_sqlite_legacy` for reference.
- Active migrations for current environments are under `prisma/migrations`.

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run seed
```
