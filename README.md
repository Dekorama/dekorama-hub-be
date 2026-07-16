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
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | local postgres | **Required in production** |
| `DB_SSL` | `false` | `true` on Render |
| `DB_SYNCHRONIZE` | off in prod | Set `true` on Render until migrations |
| `JWT_SECRET` | — | **Required in production** (admin invite HMAC) |
| `SESSION_SECRET` | falls back to JWT | Session cookie HMAC |
| `INVITATION_TOKEN_SECRET` | — | **Required in production** |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | Required for `npm run seed` |
| `BREVO_API_KEY` | _(empty)_ | Transactional email |
| `SESSION_TTL_MS` | 7 days | Session cookie lifetime |
| `AUTH_RATE_LIMIT_MAX` | `20` | Login/register attempts per window |
| `SEED_DEMO_USERS` | `false` | If `true`, also require `SEED_*_PASSWORD` vars |

Example `.env`: see `.env.example`.

TypeORM: `synchronize` only in non-prod unless `DB_SYNCHRONIZE=true`. Prefer migrations for production long-term.

## Seed

```bash
# Admin only (from ADMIN_EMAIL / ADMIN_PASSWORD) + catalog families
npm run seed

# Optional demo users/projects (local):
SEED_DEMO_USERS=true \
SEED_CLIENT_PASSWORD='...' \
SEED_COMMUNITY_PASSWORD='...' \
SEED_MEMBER_PASSWORD='...' \
npm run seed
```

Session cookie: signed `dekorama_session` (HMAC + expiry). Send `credentials: "include"`.

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
