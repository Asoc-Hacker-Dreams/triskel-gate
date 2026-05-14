# TriskelGate — Setup Guide

## Prerequisites

- Node.js ≥ 18
- Docker & Docker Compose
- Stripe CLI (for webhook forwarding)
- Git

---

## 1. Docker (Recommended)

TriskelGate runs as part of the HSM monorepo Docker stack.

### Start everything

From the **HSM root** (`/Users/specter/Repos/HSM`):

```bash
docker compose --profile triskelgate up -d
```

This starts:
- **PostgreSQL** (`holos-postgres`) on port 5432 with `triskell_gate` database
- **TriskelGate API** on port 3001
- **Organizer Dashboard** (frontend) on port 3005

### Verify

```bash
curl http://localhost:3001/health
# → { "status": "healthy", ... }
```

### Stop

```bash
docker compose --profile triskelgate down
```

---

## 2. Local Development (Without Docker)

### Install dependencies

```bash
cd triskell-gate
npm install
```

### Configure environment

```bash
cp .env.example .env
```

Edit `.env` — the critical variables:

```bash
# Database (use localhost if Postgres runs on host)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/triskell_gate

# Server
PORT=3001

# Auth
JWT_SECRET=your-secret-key-here

# Stripe (get from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# QR code signing
QR_SECRET=your-qr-secret

# Test mode (set true to skip Stripe)
PAYMENT_TEST_MODE=true
SKIP_SALE_WINDOW_CHECK=true
```

### Create the database

```bash
# If using the Docker Postgres from HSM stack:
docker exec holos-postgres psql -U postgres -c "CREATE DATABASE triskell_gate;"

# Or with local Postgres:
createdb triskell_gate
```

### Run migrations

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/triskell_gate npm run db:migrate
```

This uses `drizzle-kit push:pg` to synchronize the schema.

### Seed the database

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/triskell_gate npm run db:seed:pg
```

Seed data includes:
- **Organizer:** X-Ops Conference (`info@xopsconference.com`)
- **Event:** X-Ops Dubai 2026
- **Ticket types:** Early Bird, General Admission, VIP
- **Admin user:** created automatically on startup (see below)

### Start the server

```bash
npm run dev
```

Server runs on `http://localhost:3001` with nodemon for hot reload.

### Start the frontend (organizer dashboard)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3005`.

---

## 3. Database Management

### Available scripts

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Push schema to database (`drizzle-kit push:pg`) |
| `npm run db:generate` | Generate migration files (`drizzle-kit generate:pg`) |
| `npm run db:studio` | Open Drizzle Studio (visual DB browser) |
| `npm run db:seed` | Run seed script (legacy SQLite) |
| `npm run db:seed:pg` | Run PostgreSQL seed script |
| `npm run test:tickets` | Create test tickets |

### Direct database access

```bash
# Via Docker
docker exec -it holos-postgres psql -U postgres -d triskell_gate

# Common queries
\dt                          -- List tables
\d tickets                   -- Describe tickets table
SELECT count(*) FROM tickets;
SELECT * FROM events;
```

---

## 4. Stripe Setup

### Test mode

Set `PAYMENT_TEST_MODE=true` in `.env` to use mock payment sessions (no real Stripe calls).

### Live/Test Stripe keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy **Secret key** (`sk_test_...`) → `STRIPE_SECRET_KEY`
3. Copy **Publishable key** (`pk_test_...`) → `STRIPE_PUBLISHABLE_KEY`

### Webhook forwarding (local development)

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and forward webhooks:

```bash
stripe listen --forward-to localhost:3001/api/payment/webhook
```

Copy the webhook signing secret (`whsec_...`) from the CLI output → `STRIPE_WEBHOOK_SECRET` in `.env`.

### Test a payment flow

```bash
# 1. Create a checkout session
curl -X POST http://localhost:3001/api/payment/create-session \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": 1,
    "ticketTypeId": 1,
    "quantity": 1,
    "customerEmail": "test@example.com",
    "customerName": "Test Buyer",
    "successUrl": "http://localhost:3005/success",
    "cancelUrl": "http://localhost:3005/cancel"
  }'

# 2. In test mode: follow the returned sessionUrl
# 3. Use Stripe test card: 4242 4242 4242 4242, any future date, any CVC
```

---

## 5. Test Users & Credentials

### Admin user (auto-created on startup)

| Field | Value |
|-------|-------|
| Email | `admin@triskelgate.com` |
| Password | `TriskelGate2025!Admin` |
| Role | `admin` |

Override via `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars.

### Test staff user (from seed)

| Field | Value |
|-------|-------|
| Email | `teststaff@hsm.dev` |
| Password | `HsmStaff2026!` |
| Role | `admin` |

### Existing organizer (from seed)

| Field | Value |
|-------|-------|
| Email | `info@xopsconference.com` |
| Name | X-Ops Conference |

### Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teststaff@hsm.dev","password":"HsmStaff2026!"}'

# Response includes JWT token
# Use: Authorization: Bearer <token>
```

---

## 6. Supabase Auth (Federated Login)

The organizer dashboard uses Supabase Auth for login. Configure:

```bash
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

New users logging in via Supabase are auto-provisioned in the `staff` table with `auth_provider = 'supabase'` and `role = 'staff'`.

---

## 7. Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# CI mode (no watch, pass with no tests)
npm run test:ci
```

---

## 8. Linting & Formatting

```bash
npm run lint        # ESLint
npm run lint:fix    # Auto-fix
npm run format      # Prettier
npm run validate    # Lint + test
```

---

## 9. Project Structure

```
triskell-gate/
├── src/
│   ├── index.js          # App entry point
│   ├── routes/           # Express route handlers
│   ├── services/         # Business logic
│   ├── middleware/        # Auth middleware
│   ├── db/               # Schema & connection
│   ├── config/           # Swagger config
│   └── migrations-pg/    # DB migrations
├── frontend/             # React/Vite dashboard
├── public/               # PWA static files
├── scripts/              # Seed & utility scripts
├── docs/                 # This documentation
├── .env.example          # Environment template
├── package.json
└── drizzle.config.ts
```

---

## 10. Ports Reference

| Service | Port | Description |
|---------|------|-------------|
| TriskelGate API | 3001 | Express backend |
| Organizer Dashboard | 3005 | React/Vite frontend |
| PostgreSQL | 5432 | Database |
| Stripe CLI | 4242 (default) | Webhook forwarding |

---

## Troubleshooting

### Database connection refused
Ensure PostgreSQL is running: `docker ps | grep postgres`

### Stripe webhook errors
1. Verify `stripe listen` is running
2. Check `STRIPE_WEBHOOK_SECRET` matches the CLI output
3. Ensure `PAYMENT_TEST_MODE=false` for real Stripe calls

### CORS errors from frontend
Check `ALLOWED_ORIGINS` in `.env` includes your frontend URL (e.g., `http://localhost:3005`).

### Migration errors
```bash
# Reset and re-push schema
docker exec holos-postgres psql -U postgres -c "DROP DATABASE triskell_gate;"
docker exec holos-postgres psql -U postgres -c "CREATE DATABASE triskell_gate;"
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/triskell_gate npm run db:migrate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/triskell_gate npm run db:seed:pg
```
