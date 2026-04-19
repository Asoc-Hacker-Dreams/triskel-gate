# TriskelGate Payment Platform — Technical Documentation

> Version: 1.1.0 | Last updated: 2026-04-01  
> Repository: `triskell-gate` (GitHub controlled)  
> Stack: Node.js 18 · Express 4 · SQLite (Drizzle ORM) · Stripe · Docker

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [External Integrations](#7-external-integrations)
8. [Security Model](#8-security-model)
9. [Configuration Reference](#9-configuration-reference)
10. [Deployment](#10-deployment)
11. [Use Cases](#11-use-cases)
12. [Testing](#12-testing)
13. [Known Issues & Notes](#13-known-issues--notes)

---

## 1. System Overview

TriskelGate is a **standalone event ticketing and payment platform** designed to replace commercial solutions like Eventbrite. It provides:

- Ticket sales via **Stripe Checkout**
- **QR-code signed tickets** (HMAC-SHA256) with PDF generation
- **Real-time QR validation** at event entry points
- **Admin panel** for event management, revenue tracking, refunds
- **Staff access control** with role-based permissions
- **Progressive Web App** support for offline-capable validator

It operates as a **backend API server** on port `3001`, serving a separate frontend (e.g., AgoraPass monorepo frontend or a standalone Vite SPA).

### Relationship with AgoraPass

TriskelGate is listed as a supported **ticket platform** in the AgoraPass check-in system (`handlers/checkin.go`). AgoraPass community staff can scan TriskelGate QR codes through AgoraPass's universal QR bridge.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────┐
│              Frontend / Client                    │
│   (React SPA, PWA validator, AgoraPass app)       │
└──────────────┬───────────────────────────────────┘
               │ HTTP/HTTPS (REST)
               ▼
┌──────────────────────────────────────────────────┐
│          TriskelGate API (Express.js)             │
│                   Port: 3001                      │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Security Middleware Stack                  │ │
│  │  Helmet → Rate Limiter → CORS → Logger      │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐ │
│  │ /api     │ │ /auth    │ │ /admin            │ │
│  │ Tickets  │ │ Login    │ │ Dashboard/Events  │ │
│  │ Payment  │ │ JWT      │ │ Orders/Analytics  │ │
│  │ Validate │ └──────────┘ │ Staff Mgmt        │ │
│  │ Search   │              └───────────────────┘ │
│  └──────────┘ ┌──────────┐ ┌───────────────────┐ │
│               │ /pwa     │ │ /demo             │ │
│               │ Manifest │ │ Simulate/Debug    │ │
│               │ SW Cache │ └───────────────────┘ │
│               └──────────┘                        │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Services Layer                             │ │
│  │  PaymentService · TicketValidationService   │ │
│  └──────────────────────┬──────────────────────┘ │
│                         │                         │
│  ┌──────────────────────▼──────────────────────┐ │
│  │  Drizzle ORM                                │ │
│  └──────────────────────┬──────────────────────┘ │
│                         │                         │
└─────────────────────────┼────────────────────────┘
                          │
          ┌───────────────▼───────────────┐
          │   SQLite Database             │
          │   ./data/platform.db          │
          └───────────────────────────────┘
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
        ▼                 ▼                  ▼
  ┌──────────┐    ┌──────────────┐  ┌──────────────┐
  │  Stripe  │    │  NodeMailer  │  │  HubSpot     │
  │  (Checkout│   │  (SMTP/Gmail)│  │  (Webhook    │
  │  Webhooks)│   │  Ticket PDFs │  │   Sync)      │
  └──────────┘    └──────────────┘  └──────────────┘
```

---

## 3. Technology Stack

| Layer          | Technology          | Version   | Purpose                             |
|----------------|---------------------|-----------|-------------------------------------|
| Runtime        | Node.js             | >=18.0.0  | Server runtime                      |
| Framework      | Express.js          | ^4.18.2   | HTTP server & routing               |
| Database       | SQLite via better-sqlite3 | ^9.2.2 | Embedded database                |
| ORM            | Drizzle ORM         | ^0.29.3   | Type-safe SQL builder               |
| Payments       | Stripe              | ^14.12.0  | Payment processing (Checkout + Webhooks) |
| Auth           | jsonwebtoken        | ^9.0.2    | JWT access tokens                   |
| Passwords      | bcryptjs            | ^2.4.3    | Bcrypt password hashing             |
| QR Codes       | qrcode              | ^1.5.3    | QR code buffer generation           |
| PDF            | PDFKit              | ^0.14.0   | A4 ticket PDF generation            |
| Email          | nodemailer          | ^6.9.8    | SMTP email delivery                 |
| Image processing | sharp             | ^0.33.1   | Image optimization                  |
| Validation     | express-validator / joi | ^7.0.1 / ^17.11.0 | Request validation      |
| Rate Limiting  | express-rate-limit  | ^7.1.5    | DDoS/abuse protection               |
| Security       | helmet              | ^7.1.0    | HTTP security headers               |
| CORS           | cors                | ^2.8.5    | Cross-origin resource sharing       |
| Logging        | winston             | ^3.11.0   | Structured JSON logging             |
| API Docs       | swagger-jsdoc + swagger-ui-express | ^6.2.8 | OpenAPI docs      |
| Testing        | Jest + Supertest    | ^29.7.0   | Unit & integration tests            |
| Container      | Docker              | —         | Containerized deployment            |

---

## 4. Database Schema

**Engine:** SQLite (`better-sqlite3`) · **ORM:** Drizzle ORM · **File:** `./data/platform.db`

### Entity Relationship Diagram

```
organizers ──────────────────────────── invoices
    │                                       │
    │ 1:N                                   │
    ▼                                       │
events ←──────── ticketTypes               │
    │                  │                    │
    │ 1:N              │ 1:N               │ N:1
    ▼                  ▼                    │
orders ──────────── tickets           platform_fees
    │                  │                    │
    │ 1:N              │ 1:N               │ 1:1
    ▼                  ▼                    │
platform_fees    validation_logs          orders
                       │
                       │ N:1
                       ▼
                     staff


settings   (key-value config store, standalone)
sales_stats (daily aggregates per event)
```

### Tables

#### `organizers`
| Column           | Type    | Constraints   | Description                     |
|------------------|---------|---------------|---------------------------------|
| id               | INTEGER | PK, AutoIncr  | Organizer ID                    |
| name             | TEXT    | NOT NULL      | Legal name                      |
| email            | TEXT    | NOT NULL, UNIQUE | Contact email               |
| phone            | TEXT    | —             | Phone number                    |
| tax_id           | TEXT    | —             | VAT/Tax identification          |
| billing_address  | TEXT    | —             | Full billing address            |
| country          | TEXT    | DEFAULT 'ES'  | ISO country code                |
| currency         | TEXT    | DEFAULT 'EUR' | Preferred settlement currency   |
| payout_method    | TEXT    | —             | 'bank_transfer', 'stripe', etc  |
| payout_details   | TEXT    | —             | JSON with payout account details|
| created_at       | TEXT    | DEFAULT NOW   | ISO timestamp                   |
| updated_at       | TEXT    | DEFAULT NOW   | ISO timestamp                   |

#### `events`
| Column              | Type    | Constraints        | Description              |
|---------------------|---------|--------------------|--------------------------|
| id                  | INTEGER | PK, AutoIncr       | Event ID                 |
| name                | TEXT    | NOT NULL           | Event display name       |
| slug                | TEXT    | NOT NULL, UNIQUE   | URL-friendly identifier  |
| description         | TEXT    | —                  | Event description        |
| location            | TEXT    | NOT NULL           | Venue / location string  |
| start_date          | TEXT    | NOT NULL           | ISO 8601 datetime        |
| end_date            | TEXT    | NOT NULL           | ISO 8601 datetime        |
| max_tickets         | INTEGER | DEFAULT 1000       | Capacity limit           |
| status              | TEXT    | DEFAULT 'active'   | 'active', 'cancelled', 'ended' |
| platform_fee_percent| REAL    | DEFAULT 3.0        | TriskelGate fee %        |
| organizer_id        | INTEGER | FK → organizers.id | Event organizer          |
| created_at          | TEXT    | DEFAULT NOW        | ISO timestamp            |
| updated_at          | TEXT    | DEFAULT NOW        | ISO timestamp            |

#### `ticket_types`
| Column          | Type    | Constraints      | Description                 |
|-----------------|---------|------------------|-----------------------------|
| id              | INTEGER | PK, AutoIncr     | Ticket type ID              |
| event_id        | INTEGER | NOT NULL, FK     | Parent event                |
| name            | TEXT    | NOT NULL         | e.g. "General Admission"    |
| description     | TEXT    | —                | What's included             |
| price           | REAL    | NOT NULL         | Price in EUR                |
| stripe_product_id | TEXT  | —                | Stripe Product ID (optional)|
| stripe_price_id | TEXT    | —                | Stripe Price ID (optional)  |
| max_quantity    | INTEGER | DEFAULT 100      | Max per order               |
| sale_start_date | TEXT    | NOT NULL         | When sales open             |
| sale_end_date   | TEXT    | NOT NULL         | When sales close            |
| is_active       | BOOLEAN | DEFAULT true     | Can be sold                 |
| created_at      | TEXT    | DEFAULT NOW      | ISO timestamp               |

#### `orders`
| Column                | Type    | Constraints      | Description                            |
|-----------------------|---------|------------------|----------------------------------------|
| id                    | INTEGER | PK, AutoIncr     | Order ID                               |
| order_number          | TEXT    | NOT NULL, UNIQUE | Human-readable (e.g. `TGT-ABC123`)     |
| event_id              | INTEGER | NOT NULL, FK     | Associated event                       |
| customer_email        | TEXT    | NOT NULL         | Purchaser email                        |
| customer_name         | TEXT    | NOT NULL         | Purchaser full name                    |
| customer_phone        | TEXT    | —                | Optional phone                         |
| subtotal              | REAL    | NOT NULL         | ticket price × quantity                |
| platform_fee          | REAL    | DEFAULT 0        | TriskelGate commission (% of subtotal) |
| stripe_fee            | REAL    | DEFAULT 0        | Processing fee (2.9% + €0.25/ticket)   |
| total_amount          | REAL    | NOT NULL         | subtotal + platform_fee + stripe_fee   |
| currency              | TEXT    | DEFAULT 'EUR'    | ISO currency code                      |
| status                | TEXT    | DEFAULT 'pending'| 'pending','completed','cancelled','refunded' |
| stripe_session_id     | TEXT    | —                | Stripe Checkout Session ID             |
| stripe_payment_intent_id | TEXT | —               | Stripe PaymentIntent ID               |
| notes                 | TEXT    | —                | Admin/refund notes                     |
| created_at            | TEXT    | DEFAULT NOW      | ISO timestamp                          |
| updated_at            | TEXT    | DEFAULT NOW      | ISO timestamp                          |

**Indexes:** `orders_email_idx`, `orders_status_idx`, `orders_order_number_idx`

#### `tickets`
| Column           | Type    | Constraints      | Description                        |
|------------------|---------|------------------|------------------------------------|
| id               | INTEGER | PK, AutoIncr     | Ticket ID                          |
| uuid             | TEXT    | NOT NULL, UNIQUE | UUID v4 for global uniqueness      |
| order_id         | INTEGER | NOT NULL, FK     | Parent order                       |
| ticket_type_id   | INTEGER | NOT NULL, FK     | Ticket type                        |
| event_id         | INTEGER | NOT NULL, FK     | Event shortcut                     |
| qr_code          | TEXT    | NOT NULL, UNIQUE | Base64 JSON payload (signed)       |
| ticket_number    | TEXT    | NOT NULL, UNIQUE | Human-readable (e.g. `T-XYZ123`)  |
| holder_name      | TEXT    | —                | Holder full name                   |
| holder_email     | TEXT    | —                | Holder email                       |
| price            | REAL    | NOT NULL         | Price at time of purchase          |
| is_used          | BOOLEAN | DEFAULT false    | Whether ticket has been validated  |
| used_at          | TEXT    | —                | ISO timestamp of validation        |
| used_by          | TEXT    | —                | Staff ID who validated             |
| checkin_location | TEXT    | —                | Location note at validation        |
| notes            | TEXT    | —                | Admin notes                        |
| created_at       | TEXT    | DEFAULT NOW      | ISO timestamp                      |
| updated_at       | TEXT    | DEFAULT NOW      | ISO timestamp                      |

**Indexes:** `tickets_uuid_idx`, `tickets_qr_code_idx`, `tickets_ticket_number_idx`, `tickets_order_idx`, `tickets_used_idx`, `tickets_event_idx`

#### `staff`
| Column        | Type    | Constraints      | Description                    |
|---------------|---------|------------------|--------------------------------|
| id            | INTEGER | PK, AutoIncr     | Staff member ID                |
| email         | TEXT    | NOT NULL, UNIQUE | Login email                    |
| name          | TEXT    | NOT NULL         | Display name                   |
| password_hash | TEXT    | NOT NULL         | bcrypt hash (12 rounds)        |
| role          | TEXT    | DEFAULT 'staff'  | 'admin' or 'staff'             |
| permissions   | TEXT    | —                | JSON array of permission strings |
| is_active     | BOOLEAN | DEFAULT true     | Can log in                     |
| last_login_at | TEXT    | —                | ISO timestamp                  |
| created_at    | TEXT    | DEFAULT NOW      | ISO timestamp                  |
| updated_at    | TEXT    | DEFAULT NOW      | ISO timestamp                  |

**Available permissions:** `validate_tickets`, `search_tickets`, `manage_events`, `process_refunds`, `view_analytics`, `manage_users`, `system_admin`

#### `validation_logs`
| Column       | Type    | Constraints | Description                   |
|--------------|---------|-------------|-------------------------------|
| id           | INTEGER | PK          | Log entry ID                  |
| ticket_id    | INTEGER | NOT NULL, FK| Ticket that was scanned       |
| staff_id     | INTEGER | FK          | Staff who scanned (nullable)  |
| action       | TEXT    | NOT NULL    | e.g. 'validate', 'search'     |
| location     | TEXT    | —           | Scan location note            |
| device_info  | TEXT    | —           | User agent / device string    |
| ip_address   | TEXT    | —           | Scanner IP                    |
| success      | BOOLEAN | NOT NULL    | Whether validation succeeded  |
| error_message| TEXT    | —           | Failure reason                |
| created_at   | TEXT    | DEFAULT NOW | ISO timestamp                 |

#### `sales_stats`
Daily aggregated revenue per event.

| Column        | Type    | Description                   |
|---------------|---------|-------------------------------|
| event_id      | INTEGER | FK to events                  |
| date          | TEXT    | ISO date (YYYY-MM-DD)         |
| tickets_sold  | INTEGER | Count for this day            |
| gross_revenue | REAL    | Sum of order subtotals        |
| platform_fees | REAL    | Sum of platform fees          |
| stripe_fees   | REAL    | Sum of Stripe processing fees |
| net_revenue   | REAL    | Organizer net payout          |
| refunds       | REAL    | Refund amount                 |

**Index:** `sales_stats_event_date_idx` (eventId, date)

#### `platform_fees`
Itemized fee ledger for settlement/accounting.

| Column      | Type  | Description                           |
|-------------|-------|---------------------------------------|
| event_id    | INTEGER | FK to events                        |
| order_id    | INTEGER | FK to orders (nullable)             |
| fee_type    | TEXT  | 'platform' or 'stripe'              |
| fee_percent | REAL  | Applied rate                        |
| base_amount | REAL  | Amount the fee was calculated on    |
| fee_amount  | REAL  | Actual fee EUR amount               |
| currency    | TEXT  | DEFAULT 'EUR'                       |
| status      | TEXT  | 'pending', 'settled', 'refunded'    |

#### `invoices`
Monthly settlement invoices per organizer.

| Column        | Type    | Description                          |
|---------------|---------|--------------------------------------|
| invoice_number| TEXT    | UNIQUE, e.g. `INV-2026-03-001`       |
| organizer_id  | INTEGER | FK to organizers                     |
| event_id      | INTEGER | FK to events (nullable, per-event)   |
| period_start  | TEXT    | Invoice period start date            |
| period_end    | TEXT    | Invoice period end date              |
| subtotal      | REAL    | Gross ticket sales                   |
| platform_fees | REAL    | TriskelGate fees to deduct           |
| stripe_fees   | REAL    | Stripe fees to deduct                |
| tax_amount    | REAL    | VAT/tax (default 0)                  |
| total_to_pay  | REAL    | Net amount to pay organizer          |
| currency      | TEXT    | DEFAULT 'EUR'                        |
| status        | TEXT    | 'draft','sent','paid','void'         |
| paid_at       | TEXT    | ISO timestamp of payment             |
| payment_method| TEXT    | 'bank_transfer', 'stripe', etc       |
| pdf_url       | TEXT    | URL to invoice PDF                   |

#### `settings`
Key-value configuration store.

| Column      | Type    | Description              |
|-------------|---------|--------------------------|
| key         | TEXT    | UNIQUE config key        |
| value       | TEXT    | Config value (string)    |
| category    | TEXT    | Grouping label           |
| description | TEXT    | Human description        |
| is_public   | BOOLEAN | Whether exposed via API  |

---

## 5. API Reference

**Base URL:** `http://localhost:3001`  
**Auth:** JWT Bearer token (except public routes)  
**Format:** JSON  
**API Docs:** `GET /api/info` or Swagger UI at `/api-docs`

### Public Endpoints

| Method | Path              | Auth | Description                   |
|--------|-------------------|------|-------------------------------|
| GET    | `/`               | —    | Welcome + feature list        |
| GET    | `/health`         | —    | Health check (Docker/k8s)     |
| GET    | `/ready`          | —    | Readiness probe (k8s)         |
| POST   | `/auth/login`     | —    | Staff login → returns JWT     |
| GET    | `/api/info`       | —    | API feature list              |
| POST   | `/api/payment/create-session` | — | Create Stripe Checkout session |
| POST   | `/api/payment/webhook` | Stripe Sig | Stripe webhook handler |
| GET    | `/api/events`     | —    | List active events            |
| GET    | `/api/events/:slug` | —  | Event details + ticket types  |
| GET    | `/api/search`     | —    | Search tickets by identifier  |
| GET    | `/pwa/manifest.json` | — | PWA manifest                 |
| GET    | `/demo/status`    | —    | Demo fee stats                |
| POST   | `/demo/simulate-order` | — | Simulate fee breakdown      |

### Protected Staff Endpoints (JWT required)

| Method | Path                    | Role         | Description               |
|--------|-------------------------|--------------|---------------------------|
| POST   | `/api/validate`         | staff/admin  | Validate QR ticket        |
| GET    | `/admin/dashboard`      | staff/admin  | Aggregate stats           |
| GET    | `/admin/events`         | staff/admin  | List events               |
| POST   | `/admin/events`         | admin        | Create event              |
| GET    | `/admin/ticket-types`   | staff/admin  | List ticket types         |
| POST   | `/admin/ticket-types`   | admin        | Create ticket type        |
| GET    | `/admin/orders`         | staff/admin  | List orders + filter      |
| GET    | `/admin/orders/:id`     | staff/admin  | Order details + tickets   |
| GET    | `/admin/analytics/sales` | staff/admin | Sales analytics          |
| GET    | `/admin/analytics/validation-logs` | staff/admin | Validation audit trail |
| GET    | `/admin/staff`          | admin        | List staff members        |

---

## 6. Data Flow Diagrams

### 6.1 — Ticket Purchase Flow (Happy Path)

```
Customer Browser                TriskelGate API          Stripe           Database
      │                               │                     │                │
      │  POST /api/payment/create-session                   │                │
      │  { eventId, ticketTypeId, qty,│                     │                │
      │    customerEmail, name, phone }│                    │                │
      │──────────────────────────────▶│                     │                │
      │                               │ 1. Validate event & │                │
      │                               │    ticket type      │                │
      │                               │────────────────────────────────────▶│
      │                               │    ◀ ticketType + event data         │
      │                               │                     │                │
      │                               │ 2. Check sale window│                │
      │                               │    (if not skipped) │                │
      │                               │                     │                │
      │                               │ 3. Calculate fees   │                │
      │                               │    subtotal = price×qty              │
      │                               │    platformFee = subtotal × 3%       │
      │                               │    stripeFee = sub×2.9% + qty×€0.25 │
      │                               │    totalAmount = sum of above        │
      │                               │                     │                │
      │                               │ 4. INSERT order (pending)            │
      │                               │────────────────────────────────────▶│
      │                               │    ◀ order record        │           │
      │                               │                     │                │
      │                               │ 5. Create Checkout  │                │
      │                               │    Session          │                │
      │                               │────────────────────▶│                │
      │                               │    ◀ session { id, url }             │
      │                               │                     │                │
      │                               │ 6. UPDATE order with sessionId       │
      │                               │────────────────────────────────────▶│
      │                               │                     │                │
      │  ◀ { sessionId, sessionUrl, orderId, orderNumber, totalAmount }       │
      │                               │                     │                │
      │  Redirect to sessionUrl       │                     │                │
      │─────────────────────────────────────────────────────▶               │
      │                               │                     │                │
      │  [Customer completes payment on Stripe hosted page ]│                │
      │                               │                     │                │
      │                               │  POST /api/payment/webhook           │
      │                               │◀────────────────────│                │
      │                               │  (checkout.session.completed)        │
      │                               │                     │                │
      │                               │ 7. Verify Stripe sig│                │
      │                               │ 8. UPDATE order → completed          │
      │                               │────────────────────────────────────▶│
      │                               │ 9. Generate N tickets (UUID+QR)      │
      │                               │    INSERT tickets    │                │
      │                               │────────────────────────────────────▶│
      │                               │10. Update salesStats│                │
      │                               │────────────────────────────────────▶│
      │                               │                     │                │
      │  GET /checkout/success        │                     │                │
      │  (success_url redirect)       │                     │                │
      │──────────────────────────────▶│                     │                │
      │  ◀ Order confirmation + ticket PDF                  │                │
```

### 6.2 — QR Ticket Validation Flow

```
Staff App (PWA/Mobile)          TriskelGate API             Database
      │                               │                         │
      │  POST /api/validate           │                         │
      │  { qrCode, location }         │                         │
      │  Bearer: <staff_jwt>          │                         │
      │──────────────────────────────▶│                         │
      │                               │ 1. Authenticate JWT     │
      │                               │    Extract staffId      │
      │                               │                         │
      │                               │ 2. Decode QR base64     │
      │                               │    Parse: { uuid,       │
      │                               │    ticketNumber,        │
      │                               │    timestamp, sig }     │
      │                               │                         │
      │                               │ 3. Verify HMAC-SHA256   │
      │                               │    sig == sha256(       │
      │                               │    uuid+ticket+secret)  │
      │                               │                         │
      │                               │ 4. SELECT ticket WHERE  │
      │                               │    qr_code = ?          │
      │                               │────────────────────────▶│
      │                               │    ◀ ticket record      │
      │                               │                         │
      │                               │ 5. Check is_used        │
      │                               │    If true → REJECTED   │
      │                               │                         │
      │                               │ 6. Check event dates    │
      │                               │    (event must be active│
      │                               │     and within window)  │
      │                               │                         │
      │                               │ 7. UPDATE ticket        │
      │                               │    is_used=true         │
      │                               │    used_at=NOW          │
      │                               │    used_by=staffId      │
      │                               │────────────────────────▶│
      │                               │                         │
      │                               │ 8. INSERT validation_log│
      │                               │    success=true         │
      │                               │────────────────────────▶│
      │                               │                         │
      │  ◀ { success: true,           │                         │
      │      holderName, event,       │                         │
      │      ticketType }             │                         │
```

### 6.3 — QR Code Structure

```
QR Code = Base64( JSON.stringify({
  uuid:        "550e8400-e29b-41d4-...",    ← UUID v4 (DB unique key)
  ticketNumber: "T-LC8DF1-AB3",            ← Human-readable ID
  timestamp:   1741027200000,               ← Generation timestamp (ms)
  signature:   "a9f3c8d1"                   ← HMAC-SHA256[:8] of uuid+ticket+QR_SECRET
}) )
```

### 6.4 — Fee Calculation

```
Input:
  ticketPrice   = 50.00 EUR
  quantity      = 2
  platformRate  = 3.0% (from event.platformFeePercent)
  stripeRate    = 2.9% per transaction
  stripeFixed   = €0.25 per ticket

   subtotal     = 50.00 × 2           = €100.00
   platformFee  = 100.00 × 0.03       =   €3.00
   stripeFee    = (100.00 × 0.029)    =   €2.90
               + (2 × 0.25)           +  €0.50
               = €3.40

   totalAmount  = 100.00 + 3.00 + 3.40 = €106.40

   Organizer receives: 100.00 - 3.00 - 3.40 = €93.60
   TriskelGate:  €3.00
   Stripe:       €3.40
```

---

## 7. External Integrations

### 7.1 Stripe

- **Mode:** Stripe Checkout (hosted payment page)
- **API version:** `2020-08-27`
- **Events consumed:**
  - `checkout.session.completed` → triggers ticket generation
- **Webhook endpoint:** `POST /api/payment/webhook`
- **Signature verification:** `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`
- **Test mode:** Set `PAYMENT_TEST_MODE=true` to mock all Stripe calls without real key

### 7.2 NodeMailer / SMTP

- **Purpose:** Send ticket PDFs via email after payment completes
- **Config:** `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASSWORD`
- **From address:** `EMAIL_FROM` env var (e.g. `TriskelGate <noreply@triskelgate.com>`)
- **Trigger:** Called in the webhook handler after tickets are generated

### 7.3 HubSpot CRM Sync

- **Status:** Optional (behind `HUBSPOT_SYNC_ENABLED=true`)
- **File:** `src/utils/hubspot-webhook.js`
- **Mechanism:** Fire-and-forget POST to `HUBSPOT_SYNC_URL/webhooks/{event}`
- **Events fired:** (determined by calling code, utility is generic)
- **Error handling:** Swallowed silently — does not affect payment flow

### 7.4 AgoraPass Platform

- **Type:** Consumer of TriskelGate
- **How:** AgoraPass `checkin.go` lists `triskell-gate` as a supported ticket platform
- **Auth:** `api_key` (future — currently in demo mode on AgoraPass side)
- **Flow:** AgoraPass QR scanner → `POST /api/v1/checkin/scan` → resolves platform → calls TriskelGate validate endpoint (planned)

---

## 8. Security Model

### Authentication

- **Staff login:** `POST /auth/login` with email + password → returns **JWT** (HS256, expires in `JWT_EXPIRES_IN`)
- **JWT payload:** `{ staffId, email, role, permissions, iat, exp }`
- **Protected routes:** All `/admin/*` and `/api/validate` require `Authorization: Bearer <token>`

### Authorization

```
Role: admin
  → All admin routes + staff management + event creation

Role: staff
  → validate_tickets, search_tickets, view_analytics, view orders/dashboard

Granular permissions (stored as JSON array in staff table):
  validate_tickets | search_tickets | manage_events | process_refunds |
  view_analytics | manage_users | system_admin
```

### Security Headers (Helmet)

```
Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options, X-XSS-Protection, X-Content-Type-Options: set by Helmet defaults
```

### Rate Limiting

| Scope              | Window    | Max Requests |
|--------------------|-----------|--------------|
| Global             | 15 min    | 1000         |
| Validation         | Configurable | `VALIDATION_RATE_LIMIT_MAX` (default 20) |
| Search             | Configurable | `SEARCH_RATE_LIMIT_MAX` (default 50) |

### QR Code Anti-Tamper

1. **HMAC-SHA256 signature** over `uuid + ticketNumber + QR_SECRET` (first 8 hex chars)
2. Server re-computes signature on validation and compares
3. `is_used` flag is set atomically on first validation → prevents replay attacks
4. All validation attempts logged to `validation_logs` (success or failure)

---

## 9. Configuration Reference

All configuration via environment variables (see `.env.example`).

| Variable                | Required | Default       | Description                          |
|-------------------------|----------|---------------|--------------------------------------|
| `NODE_ENV`              | —        | `development` | Environment mode                     |
| `PORT`                  | —        | `3001`        | HTTP server port                     |
| `LOG_LEVEL`             | —        | `info`        | Winston log level                    |
| `ALLOWED_ORIGINS`       | —        | localhost     | Comma-separated CORS origins         |
| `DATABASE_PATH`         | —        | `./data/platform.db` | SQLite file path             |
| `DATABASE_KEY`          | —        | —             | (Reserved for future encryption)     |
| `STRIPE_SECRET_KEY`     | ✓ (prod) | —             | `sk_test_...` or `sk_live_...`       |
| `STRIPE_PUBLISHABLE_KEY`| —        | —             | Frontend publishable key             |
| `STRIPE_WEBHOOK_SECRET` | ✓ (prod) | —             | `whsec_...` from Stripe dashboard    |
| `JWT_SECRET`            | ✓        | —             | Random 32+ char string               |
| `JWT_EXPIRES_IN`        | —        | `24h`         | Token validity duration              |
| `JWT_ALGORITHM`         | —        | `HS256`       | JWT signing algorithm                |
| `ADMIN_EMAIL`           | —        | `admin@triskelgate.com` | Default admin email       |
| `ADMIN_PASSWORD`        | ✓ (prod) | —             | Default admin password               |
| `EMAIL_SERVICE`         | —        | `gmail`       | NodeMailer service                   |
| `EMAIL_USER`            | —        | —             | SMTP username                        |
| `EMAIL_PASSWORD`        | —        | —             | SMTP app password                    |
| `EMAIL_FROM`            | —        | —             | From header for emails               |
| `QR_SECRET`             | ✓        | —             | HMAC secret for QR signing           |
| `RATE_LIMIT_WINDOW_MS`  | —        | `900000`      | 15 minutes in ms                     |
| `RATE_LIMIT_MAX_REQUESTS`| —       | `100`         | Default rate limit                   |
| `PAYMENT_TEST_MODE`     | —        | `false`       | Mock Stripe (no real charges)        |
| `SKIP_SALE_WINDOW_CHECK`| —        | `false`       | Bypass ticket sale date check        |
| `MAIN_APP_URL`          | —        | localhost:5173| Success/cancel URL base              |
| `BCRYPT_ROUNDS`         | —        | `12`          | Bcrypt iterations                    |
| `LOG_FILE_PATH`         | —        | `./logs`      | Log file directory                   |
| `REDIS_URL`             | —        | —             | Optional Redis for future sessions   |
| `HUBSPOT_SYNC_URL`      | —        | localhost:3002| HubSpot sync service URL             |
| `HUBSPOT_SYNC_ENABLED`  | —        | `false`       | Enable HubSpot webhooks              |
| `PRODUCTION_DOMAIN`     | —        | —             | e.g. `api.triskelgate.com`           |
| `SENTRY_DSN`            | —        | —             | Error monitoring                     |
| `BACKUP_ENABLED`        | —        | `true`        | Enable automated SQLite backups      |
| `BACKUP_INTERVAL_HOURS` | —        | `6`           | Backup frequency                     |
| `BACKUP_RETENTION_DAYS` | —        | `30`          | How long to keep backups             |

---

## 10. Deployment

### Local Development

```bash
# Install dependencies
npm install

# Copy and configure env
cp .env.example .env
# Edit .env with your values

# Run migrations
npm run db:migrate

# Seed test data (optional)
npm run db:seed

# Start dev server (hot reload)
npm run dev
# → Server running at http://localhost:3001
```

### Docker (Recommended for Production)

```bash
# Single container
docker build -t triskell-gate .
docker run -p 3001:3001 --env-file .env triskell-gate

# Docker Compose (includes SQLite web browser)
docker compose up -d

# SQLite web browser available at http://localhost:8080
```

**Volumes:**
- `./data:/app/data` — SQLite database persistence
- `./logs:/app/logs` — Log file persistence

### Directory Structure

```
triskell-gate/
├── src/
│   ├── index.js          # App entry point, Express config, startup
│   ├── config/
│   │   └── swagger.js    # Swagger/OpenAPI setup
│   ├── db/
│   │   ├── connection.js # Drizzle + better-sqlite3 init & migrations runner
│   │   └── schema.js     # All table definitions (Drizzle schema)
│   ├── middleware/
│   │   └── auth.js       # JWT verification, AuthService (login, createStaff, requireRole)
│   ├── routes/
│   │   ├── api.js        # Public & staff API: tickets, payment, validate, search
│   │   ├── admin.js      # Admin endpoints: dashboard, events, orders, analytics
│   │   ├── auth.js       # POST /auth/login
│   │   ├── demo.js       # Demo/debug endpoints (no auth)
│   │   └── pwa.js        # PWA manifest & service worker registration
│   ├── services/
│   │   ├── payment.js    # PaymentService: Stripe sessions, webhooks, PDF, fees
│   │   └── ticketValidation.js # TicketValidationService: QR decode, validate, search
│   ├── migrations/       # SQL migration files (Drizzle Kit generated)
│   └── utils/
│       └── hubspot-webhook.js # HubSpot CRM sync utility
├── scripts/
│   ├── seed.js           # Database seeding
│   └── create-test-tickets.js # Test ticket generator
├── public/               # Static files (PWA assets, images)
├── data/                 # SQLite database files (gitignored)
├── logs/                 # Winston log files (gitignored)
├── tests/                # Jest integration & unit tests
├── coverage/             # Test coverage reports
├── Dockerfile
├── Dockerfile.sqlite-web
├── docker-compose.yml
├── drizzle.config.js     # Drizzle Kit config
├── jest.config.json      # Jest configuration
├── .env.example          # Environment template
├── CHANGELOG.md          # Version history
└── docs/                 # Documentation (this file)
```

---

## 11. Use Cases

### UC-01: Customer Purchases Tickets

**Actor:** End customer  
**Preconditions:** Event exists with active ticket type within sale window  
**Steps:**
1. Customer browses event on frontend SPA
2. Selects ticket quantity → `POST /api/payment/create-session`
3. Redirected to Stripe Checkout hosted page
4. Enters card details, completes payment
5. Stripe fires `checkout.session.completed` webhook
6. System generates ticket(s) with signed QR code
7. System sends PDF via email (NodeMailer)
8. Customer is redirected to success URL with order number

**Alternative — Test Mode:**  
Steps 3-4 skipped; mock session redirects directly to success URL with `testMode=true&orderId=X`

---

### UC-02: Staff Validates Ticket at Entry

**Actor:** Event staff member  
**Preconditions:** Staff logged in to PWA validator, ticket QR visible  
**Steps:**
1. Staff opens PWA on mobile device
2. Logs in via `POST /auth/login` → receives JWT
3. Scans QR code with device camera
4. App sends `POST /api/validate` with QR payload + JWT
5. Server:
   - Decodes Base64 JSON from QR
   - Verifies HMAC signature
   - Looks up ticket in DB
   - Checks not yet used (`is_used = false`)
   - Marks ticket as used, logs validation
6. App displays green ✅ "VÁLIDO — [Holder Name]" or red ❌ "INVÁLIDO"

**Error cases:**
- `TICKET_NOT_FOUND` — QR not in system (counterfeit/wrong event)
- `TICKET_ALREADY_USED` — Attempted re-entry
- `INVALID_SIGNATURE` — QR tampered or from wrong secret
- `EVENT_NOT_ACTIVE` — Event not running

---

### UC-03: Admin Reviews Revenue

**Actor:** Event admin  
**Steps:**
1. Logs in → obtains JWT with role='admin'
2. `GET /admin/dashboard` → total tickets, revenue, validation rate, recent orders, top events
3. `GET /admin/analytics/sales?eventId=1&startDate=2026-03-01` → daily revenue breakdown
4. Exports or displays data

---

### UC-04: Admin Processes Refund

**Actor:** Admin  
**Steps:**
1. `GET /admin/orders?email=customer@email.com` → find order
2. `GET /admin/orders/:id` → review order details and tickets
3. `POST /api/payment/refund` with `{ orderId, reason }` (admin JWT)
4. System calls `stripe.refunds.create()` with PaymentIntent ID
5. Order status → `refunded`, all tickets set `is_used=true` (invalidated)

**Notes:**
- Only `completed` orders can be refunded
- Uses `stripePaymentIntentId` stored on the order

---

### UC-05: Event Organizer Onboarding

**Actor:** Admin  
**Steps:**
1. `POST /admin/events` → create event with `platformFeePercent`, `organizerId`
2. `POST /admin/ticket-types` → create ticket types with price windows
3. Optionally seed via `npm run db:seed`
4. Share event slug/URL with customers

---

### UC-06: AgoraPass Check-in with TriskelGate QR

**Actor:** Community staff using AgoraPass  
**Steps:**
1. Staff uses AgoraPass app → `/community/checkin` (QRScanner)
2. Scans attendee's TriskelGate ticket QR
3. AgoraPass: `POST /api/v1/checkin/scan` with QR data
4. AgoraPass bridge identifies platform=`triskell-gate`
5. (Planned) AgoraPass calls TriskelGate `POST /api/validate` with API key
6. AgoraPass issues attendance stamp to attendee's wallet
7. Stamp visible in `/user/wallet` as a Verifiable Credential

---

## 12. Testing

### Test Suites

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage report
npm run test:coverage

# CI mode (no watch, with coverage)
npm run test:ci
```

### Test Coverage Areas

- **PaymentService**: `createPaymentSession()`, fee calculation, test mode mocking
- **TicketValidationService**: QR decode, signature verification, duplicate detection
- **Admin routes**: Dashboard data aggregation, event/order CRUD
- **Auth middleware**: JWT verification, role enforcement
- **Integration**: Full payment flow end-to-end with mock Stripe

### Test Configuration

- **Framework:** Jest 29 + Supertest
- **Environment:** `NODE_ENV=test`
- **Database:** In-memory SQLite for isolation
- **Config:** `jest.config.json`

---

## 13. Known Issues & Notes

1. **Order number prefix (`HBC-`)**: `generateOrderNumber()` still uses `HBC-` prefix (legacy from HackBCN). Rename to `TGT-` in v1.2.0.

2. **Backup system**: `BACKUP_ENABLED` and related env vars are present in `.env.example` but the actual backup execution logic is not yet implemented in code. Planned for v1.2.0.

3. **HubSpot webhook**: The utility is in place but is not yet called anywhere in the payment or validation flow. Integration hooks must be added explicitly.

4. **QR timestamp**: The `timestamp` field in the QR payload is stored but not currently verified on validation (anti-replay by session age). Consider adding max-age check.

5. **`triskel-gate` (without double-l)**: This is a **local copy** of `triskell-gate` kept for development convenience. It is **not the canonical repo**. All changes must be made in `triskell-gate` (GitHub-controlled) and synced manually. Consider removing `triskel-gate` or adding a `.git` redirect.

6. **Sales stats `revenue` field**: In `updateSalesStats()`, the method still uses the old `revenue` column name instead of the new `grossRevenue` column from the updated schema. This is a bug to fix in v1.1.1.

7. **PDF logo path**: `generateTicketsPDF()` references `static/images/hack-bcn.png` — needs to be updated to TriskelGate logo path.
