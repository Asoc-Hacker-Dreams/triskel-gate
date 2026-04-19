# Changelog — TriskelGate Payment Platform

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- HubSpot CRM integration full pipeline (webhook sync)
- SMS notifications via Twilio for ticket delivery
- Multi-currency support (USD, GBP, MXN)
- White-label mode for organizers
- AgoraPass wallet deep integration (stamp issuance on ticket purchase)
- Redis session store for distributed deployments
- Kubernetes Helm chart

---

## [1.1.0] — 2026-03-01

### Added
- **Demo route** (`/demo/status`, `/demo/simulate-order`): Simulate fee breakdown and view real-time revenue data without auth. Useful for sales demos and internal testing.
- **Platform fee breakdown** in orders: `subtotal`, `platformFee` (configurable per event, default 3%), `stripeFee` (2.9% + €0.25/ticket) now stored separately in `orders` table.
- **Test mode** (`PAYMENT_TEST_MODE=true`): Full order flow without real Stripe calls. Sessions are mocked, useful for local dev and CI.
- **Sale window bypass** (`SKIP_SALE_WINDOW_CHECK=true`): Override date-based ticket sale windows for testing historical events.
- **HubSpot webhook utility** (`src/utils/hubspot-webhook.js`): Fire-and-forget webhook to HubSpot sync service when enabled.
- **New database tables**:
  - `organizers`: Event organizer profiles with payout details
  - `platform_fees`: Per-order fee ledger for accounting/settlement
  - `invoices`: Monthly settlement invoices per organizer
  - `sales_stats` extended: Now tracks `gross_revenue`, `platform_fees`, `stripe_fees`, `net_revenue` separately
- **`platformFeePercent`** column on `events` table: Per-event configurable fee (defaults to 3.0%)
- **`organizerId`** FK on `events` table: Events now linked to organizer entity
- **Extended `.env.example`**: Added `PAYMENT_TEST_MODE`, `SKIP_SALE_WINDOW_CHECK`, `HUBSPOT_SYNC_URL`, `HUBSPOT_SYNC_ENABLED`, `BACKUP_*` variables.
- **Docker Compose** health check improvements and `SKIP_SALE_WINDOW_CHECK` env passthrough.

### Changed
- `PaymentService.createPaymentSession()`: Now calculates composite fee structure (subtotal + platformFee + stripeFee = totalAmount).
- `orders.totalAmount` now reflects full breakdown including fees (was previously just `price × quantity`).
- Database schema refactored: `schema.js` now ~207 lines (was 136), adding 3 new tables and 2 new columns.

### Fixed
- Stripe initialization no longer crashes when `STRIPE_SECRET_KEY` is undefined in test environments.
- Sale window check is now properly guarded with `skipSaleWindowCheck` flag, preventing false 400 errors on test events.

---

## [1.0.1] — 2026-02-24

### Changed
- Renamed all HackBCN references to Triskelgate across the full codebase (routes, logs, admin panel, README).
- Updated `ADMIN_EMAIL` default from `admin@hackbcn.com` to `admin@triskelgate.com`.
- Updated `EMAIL_FROM` header to reference TriskelGate Conference.

### Fixed
- Order number prefix changed from `HBC-` to `TGT-` format (note: code still references `HBC-`, pending full rename in v1.1.x).

---

## [1.0.0] — 2026-02-XX (Initial Release)

### Added
- Full payment platform based on Node.js + Express + SQLite (via Drizzle ORM).
- **Stripe Checkout** integration: Create payment sessions, process webhooks for confirmation.
- **QR ticket generation**: Each ticket gets a unique UUID + HMAC-SHA256 signed QR code.
- **PDF ticket generation** (PDFKit): One A4 page per ticket with event info, QR, price badge, holder info.
- **Ticket validation**: Staff endpoint to validate QR in real time with anti-reuse protection.
- **Advanced ticket search**: Search by email, ticket number, UUID, or name.
- **Refund processing**: Full Stripe refund with automatic ticket invalidation.
- **Role-based access control**: `admin` and `staff` roles with granular permissions (JWT-based).
- **Admin dashboard** (`/admin/dashboard`): Total events, tickets, revenue, validation rate, recent orders, top events.
- **Admin CRUD**: Events, ticket types, orders details.
- **Sales analytics** (`/admin/analytics/sales`): Revenue by event and date range.
- **Validation logs** (`/admin/analytics/validation-logs`): Full audit trail per ticket scan.
- **Staff management** (`/admin/staff`): List all staff members.
- **PWA manifest & service worker** (`/pwa/*`): Progressive Web App support for offline-capable validator tool.
- **Swagger API docs** (swagger-jsdoc + swagger-ui-express).
- **Winston logging**: File-based (error.log + combined.log) + console transport.
- **Dockerized**: Multi-stage Dockerfile, docker-compose with SQLite persistence and sqlite-web browser.
- **CI integration tests**: Jest-based unit and integration test suite.
- **Health check** (`/health`, `/ready`): Docker and Kubernetes probes.
- **Database schema**: `events`, `ticket_types`, `orders`, `tickets`, `staff`, `validation_logs`, `settings`, `sales_stats`.
- **Seed script** (`scripts/seed.js`): Pre-populated test data.
- **Auto-admin creation**: On first boot, creates default admin from env vars.

---

## Version History Summary

| Version | Date       | Summary                                          |
|---------|------------|--------------------------------------------------|
| 1.1.0   | 2026-03-01 | Fee breakdown, test mode, demo route, 3 new tables |
| 1.0.1   | 2026-02-24 | Rebranding from HackBCN to Triskelgate           |
| 1.0.0   | 2026-02-XX | Initial release: Stripe, QR/PDF tickets, admin panel |

[Unreleased]: https://github.com/your-org/triskell-gate/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/your-org/triskell-gate/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/your-org/triskell-gate/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/your-org/triskell-gate/releases/tag/v1.0.0
