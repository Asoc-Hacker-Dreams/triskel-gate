# TriskelGate — AI Agent Working Instructions

## Project Identity

- **Name:** TriskelGate Payment Platform
- **Type:** Node.js / Express API + React/Vite frontend
- **Purpose:** Event ticketing, Stripe payments, QR ticket validation
- **Location:** `/Users/specter/Repos/HSM/triskell-gate` (inside HSM monorepo)

## Tech Stack Quick Reference

| Layer | Tech |
|-------|------|
| Backend | Node.js ≥ 18, Express 4, ES Modules (`"type": "module"`) |
| ORM | Drizzle ORM 0.29 with `node-postgres` |
| Database | PostgreSQL (`triskell_gate` on `holos-postgres` container) |
| Auth | Dual JWT: Supabase (primary) + Legacy bcrypt (backward-compat) |
| Payments | Stripe SDK 14 (checkout sessions, webhooks, refunds) |
| Frontend | React 18 + Vite + TypeScript (port 3005) |
| PWA | Vanilla HTML/JS with Service Worker |

## Key Files

```
src/index.js               → App bootstrap, route mounting
src/routes/api.js           → Public API (events, validation, payments)
src/routes/auth.js          → Authentication endpoints
src/routes/admin.js         → Admin panel API
src/routes/demo.js          → Demo/simulation endpoints
src/routes/pwa.js           → PWA static serving
src/services/payment.js     → Stripe integration, ticket generation
src/services/ticketValidation.js → QR validation, search, stats
src/middleware/auth.js       → JWT verification, role/permission guards
src/db/schema.js            → All 12 Drizzle table definitions
src/db/connection.js        → pg Pool, Drizzle instance, migrations
frontend/src/App.tsx        → Frontend router and pages
```

## How to Run

```bash
# Full stack via Docker (from HSM root)
docker compose --profile triskelgate up -d

# Backend only (local)
cd triskell-gate
npm install
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/triskell_gate npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Database
npm run db:migrate          # Push schema
npm run db:seed:pg          # Seed data
```

## Test Credentials

| User | Email | Password | Role |
|------|-------|----------|------|
| Test admin | `teststaff@hsm.dev` | `HsmStaff2026!` | admin |
| Default admin | `admin@triskelgate.com` | `TriskelGate2025!Admin` | admin |

```bash
# Get a token
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teststaff@hsm.dev","password":"HsmStaff2026!"}' | jq .token
```

## Database Access

```bash
docker exec -it holos-postgres psql -U postgres -d triskell_gate
```

The database has 12 tables: `organizers`, `events`, `ticket_types`, `orders`, `tickets`, `staff`, `validation_logs`, `settings`, `sales_stats`, `platform_fees`, `invoices`, `subscriptions`.

## Architecture Patterns

### Route Structure
```
/api/*     → Public + auth-required (api.js)
/auth/*    → Authentication (auth.js)
/admin/*   → All routes require auth + role check (admin.js)
/pwa/*     → Static PWA files (pwa.js)
/demo/*    → Demo mode (demo.js)
```

### Auth Flow
1. Supabase JWT is tried first (from `SUPABASE_JWT_SECRET`)
2. Falls back to legacy JWT (from `JWT_SECRET`)
3. Staff users auto-provisioned on first Supabase login
4. Role-based access: `AuthService.requireRole(['admin', 'staff'])`
5. Permission-based access: `AuthService.requirePermission('manage_events')`

### Payment Flow
1. `POST /api/payment/create-session` → creates Stripe Checkout + pending order
2. Stripe redirects → `POST /api/payment/webhook` (checkout.session.completed)
3. Webhook handler generates tickets with QR codes + updates order status
4. `GET /api/checkout/sessions/:id/status` → frontend polls for completion

### Response Conventions
All responses: `{ success: boolean, error?: string, message?: string, ...data }`

## Coding Conventions

- **ES Modules** — use `import/export`, not `require/module.exports`
- **Async/await** everywhere — Express handlers wrapped in try/catch
- **Drizzle ORM** — queries use builder pattern: `db.select().from(table).where(...)`
- **Validation** — `express-validator` with `body()`, `query()` validators
- **Error codes** — uppercase SNAKE_CASE strings (e.g., `TICKET_NOT_FOUND`)
- **Timestamps** — all tables use `timestamptz` with `defaultNow()`
- **IDs** — serial integers (not UUIDs) for PKs; tickets have a separate `uuid` column

## Common Tasks

### Add a new API endpoint

1. Choose the route file (`api.js`, `admin.js`, etc.)
2. Add validation with `express-validator`
3. Implement handler with try/catch
4. Return `{ success: true/false, ... }`
5. Add auth middleware if needed

### Add a new database table

1. Define in `src/db/schema.js` using `pgTable()`
2. Export from schema.js
3. Run `npm run db:migrate` to push
4. Import in route/service files

### Add a new admin route

1. Add to `src/routes/admin.js`
2. It automatically gets `authMiddleware` (applied to entire router)
3. Add `AuthService.requireRole([...])` for role restriction
4. Update `GET /admin/info` endpoint listing

### Test Stripe webhooks locally

```bash
stripe listen --forward-to localhost:3001/api/payment/webhook
```

## Environment Variables (Critical)

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `JWT_SECRET` | Legacy JWT signing | Yes |
| `SUPABASE_JWT_SECRET` | Supabase token verify | For Supabase auth |
| `STRIPE_SECRET_KEY` | Stripe API | For payments |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature | For webhooks |
| `QR_SECRET` | QR code HMAC | Yes |
| `PAYMENT_TEST_MODE` | Skip real Stripe | Dev only |
| `SKIP_SALE_WINDOW_CHECK` | Bypass date checks | Dev only |
| `PORT` | Server port | Default: 3001 |
| `ALLOWED_ORIGINS` | CORS origins | Yes |

## Seed Data

After seeding (`npm run db:seed:pg`):

- **Organizer:** X-Ops Conference (`info@xopsconference.com`)
- **Event:** X-Ops Dubai 2026
- **Ticket types:** Early Bird ($99), General Admission ($149), VIP ($299)

## Documentation

- `docs/ARCHITECTURE.md` — System design, auth model, ticket lifecycle
- `docs/API.md` — Complete endpoint reference
- `docs/DATA_MODEL.md` — All 12 tables, ER diagram, indexes
- `docs/SETUP.md` — Docker, local dev, Stripe, testing
- `docs/AGENTS.md` — This file
