# Dekorama Hub — Backend

NestJS API + PostgreSQL for Dekorama Hub: construction/decoration marketplace across **Venezuela (VE)** and **Spain (ES)**.

## Stack

- **NestJS** 11 + Express
- **TypeORM** + **PostgreSQL** 16
- **bcryptjs** password hashing
- Cookie session (`dekorama_session`, HTTP-only) — no JWT for app auth
- **PDFKit** / **ExcelJS** / **Sharp** for PDFs, Excel exports, images
- Optional email via **Brevo** (`BREVO_API_KEY`)

## Roles & markets

| Role | Purpose |
|------|---------|
| `admin` | Catalog, users, proposals, orders, invoices, suppliers, reports |
| `professional` | Projects, proposals, portfolio (needs verification) |
| `client` | Projects, cart, solicitudes, invoices; account types: `individual`, `community`, `member` |

Markets: `VE` (USD, IVA 16%) and `ES` (EUR, IVA 21%). Admin endpoints accept a market filter.

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (or Docker)

## Quick start

```bash
# DB (from this folder)
docker compose up -d

# App
cp .env.example .env   # or create .env manually — see below
npm install
npm run seed           # admin + catalog + sample users/projects
npm run start:dev      # http://localhost:3001
```

Production-style:

```bash
npm run build
npm start
```

## Environment

| Variable | Default | Notes |
|----------|---------|--------|
| `PORT` | `3001` | API port |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS origin (credentials) |
| `FRONTEND_URL` | `http://localhost:3000` | Links in emails / invitations |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | |
| `DB_USER` | `postgres` | |
| `DB_PASSWORD` | `postgres` | |
| `DB_NAME` | `dekorama` | Matches `docker-compose.yml` |
| `BREVO_API_KEY` | _(empty)_ | Transactional email; skipped if unset |
| `INVITATION_TOKEN_SECRET` | fallback string | Community / project invite tokens |
| `JWT_SECRET` | fallback string | Admin invite tokens |

Example `.env`:

```bash
PORT=3001
FRONTEND_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=dekorama
BREVO_API_KEY=
INVITATION_TOKEN_SECRET=change-me
```

TypeORM runs with `synchronize: true` (schema auto-updates). Fine for local/MVP; use migrations before production.

## Seed accounts

`npm run seed` is idempotent. Creates:

| Email | Password | Role |
|-------|----------|------|
| `admin@dekorama.com` | `admin123!` | admin |
| `cliente@ejemplo.com` | `cliente123` | client (individual) |
| `comunidad@ejemplo.com` | `comunidad123` | client (community) |
| `vecino@ejemplo.com` | `vecino123` | client (member) |

Also seeds product families/subfamilies and sample projects.

## Modules / API surface

Session cookie: `dekorama_session` = user UUID. Send `credentials: "include"` from the frontend.

| Prefix | Domain |
|--------|--------|
| `/auth` | register, login, logout, me, profile, password; member/admin invite registration |
| `/projects` | CRUD, departments, progress, notes, products, members, invites |
| `/proposals` | project/manual/direct-sale proposals, materials, sections, comments, proforma PDF, sign |
| `/products` | catalog + families/subfamilies (admin write) |
| `/cart` | cart CRUD, import from proposal/project, submit solicitud |
| `/orders` | client orders; admin create from proposal / status |
| `/supplier-orders` | admin supplier POs, PDFs, invoices |
| `/suppliers` | admin suppliers + factory codes |
| `/invoices` | list/create/PDF/status |
| `/communities` | invites, members, resident profiles |
| `/professional-documents` | verification docs + portfolio |
| `/admin` | users, verify, markets settings, clients, admin invites |
| `/admin/reports` | dashboard, sales, top products, suppliers, conversion |
| `/admin/exports` | Excel: invoices, orders, products, sales ledger, etc. |
| `/proposals/:id/materials` | material lists on a proposal |

Auth highlights:

- `POST /auth/register` — client or professional
- `POST /auth/login` / `POST /auth/logout` / `GET /auth/me`
- `POST /auth/register-member` — community invite token
- `POST /auth/register-admin` — admin invite token

## Scripts

| Script | Command |
|--------|---------|
| Dev | `npm run start:dev` |
| Build | `npm run build` |
| Prod | `npm start` |
| Seed | `npm run seed` |

## Repo layout

```
src/
  auth/                 session cookie auth + guards
  users/                User entity (roles, markets, account types)
  projects/ proposals/ products/ cart/ orders/
  invoices/ suppliers/ supplier-orders/
  communities/ professional-documents/ admin/
  reports/ exports/ email/ pdf/ common/
  seed.ts
docker-compose.yml      Postgres 16 → DB `dekorama`
```

Pair with [`dekorama-fe`](../dekorama-fe) (`NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`).
