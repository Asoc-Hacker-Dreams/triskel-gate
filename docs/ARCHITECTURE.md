# TriskelGate — Architecture

## Overview

TriskelGate is an event ticketing and payment platform. It handles ticket sales via Stripe, generates QR-coded PDF tickets, and provides a real-time validation PWA for door staff. An organizer dashboard (React/Vite) manages events, orders, and analytics.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Clients                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Public buyer  │  │  Validator   │  │  Organizer Dashboard  │  │
│  │ (checkout)    │  │  PWA (/pwa)  │  │  React/Vite (:3005)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘  │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Express API  (:3001)                            │
│  ┌──────┐  ┌──────┐  ┌───────┐  ┌─────┐  ┌──────┐              │
│  │ /api │  │/auth │  │/admin │  │/pwa │  │/demo │              │
│  └──┬───┘  └──┬───┘  └───┬───┘  └──┬──┘  └──┬───┘              │
│     │         │           │         │        │                  │
│  ┌──▼─────────▼───────────▼─────────▼────────▼───────────────┐  │
│  │                    Services                               │  │
│  │  PaymentService · TicketValidationService · AgoraPass     │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │              Drizzle ORM (node-postgres)                   │  │
│  └──────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │  PostgreSQL        │
                    │  triskell_gate DB  │
                    │  (12 tables)       │
                    └────────────────────┘

          ┌──────────────────────────────────┐
          │  Stripe API (external)           │
          │  checkout sessions · webhooks ·  │
          │  refunds                         │
          └──────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥ 18, ES Modules |
| HTTP framework | Express 4 |
| ORM | Drizzle ORM 0.29 (node-postgres) |
| Database | PostgreSQL (via Docker `holos-postgres`) |
| Payments | Stripe SDK 14 (checkout sessions, webhooks, refunds) |
| Auth | Dual-mode JWT — Legacy (bcrypt + self-issued) and Supabase JWT |
| PDF generation | PDFKit + QRCode |
| Security | Helmet, CORS, express-rate-limit |
| Logging | Winston (file + console) |
| Frontend | React 18 + Vite (organizer dashboard, port 3005) |
| PWA | Vanilla HTML + Service Worker (ticket validator) |
| API docs | Swagger (swagger-jsdoc + swagger-ui-express) |

## Route Mounting

Defined in `src/index.js`:

```
app.use('/api',   apiRoutes)      → src/routes/api.js
app.use('/auth',  authRoutes)     → src/routes/auth.js
app.use('/admin', adminRoutes)    → src/routes/admin.js
app.use('/pwa',   pwaRoutes)      → src/routes/pwa.js
```

Demo routes are mounted inside `src/routes/demo.js` at `/demo/status` and `/demo/simulate-order`.

Top-level routes in `index.js`: `GET /`, `GET /health`, `GET /ready`.

## Component Map

```
src/
├── index.js                    # App bootstrap, route mounting, health checks
├── routes/
│   ├── api.js                  # Public events, ticket validation, payments, stats
│   ├── auth.js                 # Login, token verify, staff CRUD
│   ├── admin.js                # Dashboard, event/ticket/order management, analytics
│   ├── demo.js                 # Demo revenue status, fee simulation
│   └── pwa.js                  # PWA static files, manifest, service worker
├── services/
│   ├── payment.js              # Stripe sessions, webhook processing, refunds, PDF gen
│   ├── ticketValidation.js     # QR validation, search, stats, invalidation
│   └── agorapassIntegration.js # External AgoraPass stamp integration
├── middleware/
│   └── auth.js                 # JWT dual-mode auth, role/permission guards
├── db/
│   ├── schema.js               # Drizzle table definitions (12 tables)
│   └── connection.js           # pg Pool + Drizzle instance + migrations
├── config/
│   └── swagger.js              # Swagger setup
└── migrations-pg/              # Drizzle migration files

frontend/                       # Organizer dashboard (React/Vite)
├── src/
│   ├── App.tsx                 # Router: /login, /dashboard, /events, /settings
│   ├── context/AuthContext.tsx  # Supabase auth context
│   ├── components/Layout.tsx   # Shell layout
│   └── pages/
│       ├── Dashboard.tsx
│       ├── Events.tsx
│       ├── CreateEvent.tsx
│       ├── Settings.tsx
│       └── Login.tsx

public/                         # PWA static files
├── validator.html              # QR scanner app
├── manifest.json
└── sw.js                       # Service worker
```

## Authentication Model

TriskelGate supports **two JWT strategies** evaluated in order:

### 1. Supabase JWT (primary, for new users)
- Frontend obtains a Supabase session token via `@supabase/supabase-js`.
- Backend verifies with `SUPABASE_JWT_SECRET`.
- On first login, a `staff` row is auto-provisioned (`authProvider = 'supabase'`).
- Extracts `email` and `sub` (Supabase user UUID) from the token.

### 2. Legacy JWT (backward-compatible)
- `POST /auth/login` accepts `email` + `password`.
- Password compared with bcrypt hash stored in `staff.password_hash`.
- Self-issued JWT signed with `JWT_SECRET`, expires in 24h.
- Payload: `{ id, email, role }`.

### Authorization
- **Role-based:** `AuthService.requireRole(['admin', 'staff'])` — enforced on admin routes.
- **Permission-based:** `AuthService.requirePermission('validate_tickets')` — granular.
- **Roles:** `admin`, `staff`, `validator`.
- **Permissions:** `validate_tickets`, `search_tickets`, `manage_events`, `process_refunds`, `view_analytics`, `manage_users`, `system_admin`.

### Rate Limiting
| Scope | Window | Max |
|-------|--------|-----|
| Global | 15 min | 1000 req/IP |
| Auth login | 15 min | 5 req/IP |
| Ticket validation | 15 min | 100 req/IP |
| Search | 15 min | 50 req/IP |

## Ticket Lifecycle

```
┌──────────┐    Stripe checkout     ┌──────────┐    Webhook:          ┌──────────┐
│  Buyer   │ ──────────────────────▶│  Order   │ ──checkout.session──▶│  Tickets │
│  selects │    create-session      │  pending │    .completed        │  created │
│  tickets │                        └──────────┘                      └────┬─────┘
└──────────┘                                                               │
                                                                           │ QR scan
                                                                           ▼
                                                                    ┌──────────┐
                                                                    │ Validated│
                                                                    │ (isUsed) │
                                                                    └──────────┘
```

1. **Selection** — Buyer calls `POST /api/payment/create-session` with event, ticket type, quantity, email.
2. **Payment** — Stripe Checkout Session created. Order row inserted with `status: pending`.
3. **Completion** — Stripe fires `checkout.session.completed` webhook → `POST /api/payment/webhook`.
4. **Ticket generation** — For each quantity, a ticket is created with UUID, unique QR code (base64-encoded JSON with SHA-256 signature), and ticket number.
5. **PDF delivery** — PDFKit generates A4 tickets with QR code images.
6. **Validation** — Staff scans QR via PWA → `POST /api/validate` → ticket marked `isUsed = true`.
7. **Invalidation** — Admin can reset a ticket via `POST /api/invalidate` (sets `isUsed = false`).
8. **Refund** — `POST /api/payment/refund` refunds via Stripe, marks order `refunded`, invalidates tickets.

### QR Code Structure
The QR code is a base64-encoded JSON object:
```json
{
  "uuid": "<ticket-uuid>",
  "ticketNumber": "<T-xxx-xxx>",
  "timestamp": 1234567890,
  "signature": "<sha256-first-8-chars>"
}
```
Signature = `SHA256(uuid + "-" + ticketNumber + "-" + QR_SECRET)` truncated to 8 hex chars.

## Fee Model

Each order calculates:
- **Subtotal** = `ticketType.price × quantity`
- **Platform fee** = `subtotal × event.platformFeePercent / 100` (default 3%)
- **Stripe fee** = `subtotal × 0.029 + quantity × 0.25` (2.9% + €0.25/ticket)
- **Total** = `subtotal + platformFee + stripeFee`

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Server port (default 3001) |
| `JWT_SECRET` | Legacy JWT signing key |
| `SUPABASE_JWT_SECRET` | Supabase JWT verification key |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature secret |
| `QR_SECRET` | QR code HMAC secret |
| `PAYMENT_TEST_MODE` | `true` to skip Stripe and use mock sessions |
| `SKIP_SALE_WINDOW_CHECK` | `true` to bypass ticket sale date validation |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |

## AgoraPass Integration

When `events.is_agorapass_integrated = true`, successful ticket validation triggers an asynchronous call to the AgoraPass service to issue a digital stamp for the attendee. This runs fire-and-forget to avoid blocking the scanner response.
