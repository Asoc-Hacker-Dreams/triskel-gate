# TriskelGate — Data Model

**Database:** PostgreSQL (`triskell_gate`)  
**ORM:** Drizzle ORM 0.29 (node-postgres)  
**Schema source:** `src/db/schema.js`

## ER Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│  organizers  │1─────*│    events     │1─────*│   ticket_types   │
└──────────────┘       └──────┬───────┘       └────────┬─────────┘
                              │1                       │1
                              │                        │
                     ┌────────┼────────┐               │
                     │        │        │               │
                     ▼*       ▼*       ▼*              │
              ┌──────────┐ ┌──────┐ ┌──────────────┐   │
              │  orders   │ │sales_│ │platform_fees │   │
              │          │ │stats │ └──────────────┘   │
              └────┬─────┘ └──────┘                    │
                   │1                                  │
                   │                                   │
                   ▼*                                  │
              ┌──────────┐                             │
              │ tickets   │*───────────────────────────┘
              └────┬─────┘
                   │1
                   ▼*
          ┌──────────────────┐       ┌──────────┐
          │ validation_logs  │*─────1│  staff    │
          └──────────────────┘       └──────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  invoices    │*─────1│  organizers  │1─────*│subscriptions │
└──────────────┘       └──────────────┘       └──────────────┘

┌──────────────┐
│  settings    │  (standalone key-value config)
└──────────────┘
```

---

## Tables (12)

### 1. `organizers`

Event organizer companies/individuals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `name` | text | NOT NULL | Organizer name |
| `email` | text | NOT NULL, UNIQUE | Contact email |
| `phone` | text | | Phone number |
| `tax_id` | text | | Tax identification |
| `billing_address` | text | | Billing address |
| `country` | text | DEFAULT `'ES'` | Country code |
| `currency` | text | DEFAULT `'EUR'` | Preferred currency |
| `payout_method` | text | | How they receive payouts |
| `payout_details` | text | | Payout account details |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

---

### 2. `events`

Events that sell tickets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `name` | text | NOT NULL | Event name |
| `slug` | text | NOT NULL, UNIQUE | URL-friendly slug |
| `description` | text | | Event description |
| `location` | text | NOT NULL | Venue/city |
| `start_date` | timestamptz | NOT NULL | Event start |
| `end_date` | timestamptz | NOT NULL | Event end |
| `max_tickets` | integer | DEFAULT `1000` | Ticket cap |
| `status` | text | DEFAULT `'active'` | `active`, `draft`, `cancelled` |
| `is_agorapass_integrated` | boolean | DEFAULT `false` | AgoraPass stamp integration |
| `agorapass_event_id` | text | | External AgoraPass event ID |
| `platform_fee_percent` | real | DEFAULT `3.0` | Platform fee % |
| `organizer_id` | integer | FK → `organizers.id` | Owning organizer |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

---

### 3. `ticket_types`

Ticket tiers/categories within an event.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `event_id` | integer | NOT NULL, FK → `events.id` | Parent event |
| `name` | text | NOT NULL | E.g. "Early Bird", "VIP" |
| `description` | text | | Tier description |
| `price` | real | NOT NULL | Unit price in EUR |
| `stripe_product_id` | text | | Stripe product ID |
| `stripe_price_id` | text | | Stripe price ID |
| `max_quantity` | integer | DEFAULT `100` | Max tickets available |
| `sale_start_date` | timestamptz | NOT NULL | Sale window open |
| `sale_end_date` | timestamptz | NOT NULL | Sale window close |
| `is_active` | boolean | DEFAULT `true` | Soft delete flag |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |

---

### 4. `orders`

Purchase orders linking a customer to an event.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `order_number` | text | NOT NULL, UNIQUE | Human-readable `HBC-xxx-xxx` |
| `event_id` | integer | NOT NULL, FK → `events.id` | Event purchased for |
| `customer_email` | text | NOT NULL | Buyer email |
| `customer_name` | text | NOT NULL | Buyer name |
| `customer_phone` | text | | Buyer phone |
| `subtotal` | real | NOT NULL | Ticket price × quantity |
| `platform_fee` | real | NOT NULL, DEFAULT `0` | Platform fee amount |
| `stripe_fee` | real | NOT NULL, DEFAULT `0` | Stripe fee amount |
| `total_amount` | real | NOT NULL | Total charged |
| `currency` | text | DEFAULT `'EUR'` | Currency code |
| `status` | text | DEFAULT `'pending'` | `pending`, `completed`, `cancelled`, `refunded` |
| `stripe_session_id` | text | | Stripe Checkout Session ID |
| `stripe_payment_intent_id` | text | | Stripe PaymentIntent ID |
| `notes` | text | | Internal notes |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes:** `orders_email_idx`, `orders_status_idx`, `orders_order_number_idx`

---

### 5. `tickets`

Individual tickets generated after successful payment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `uuid` | text | NOT NULL, UNIQUE | UUID v4 |
| `order_id` | integer | NOT NULL, FK → `orders.id` | Parent order |
| `ticket_type_id` | integer | NOT NULL, FK → `ticket_types.id` | Ticket tier |
| `event_id` | integer | NOT NULL, FK → `events.id` | Event |
| `qr_code` | text | NOT NULL, UNIQUE | Base64-encoded QR data |
| `ticket_number` | text | NOT NULL, UNIQUE | Human-readable `T-xxx-xxx` |
| `holder_name` | text | | Attendee name |
| `holder_email` | text | | Attendee email |
| `price` | real | NOT NULL | Price paid |
| `is_used` | boolean | DEFAULT `false` | Whether scanned/validated |
| `used_at` | timestamptz | | When validated |
| `used_by` | text | | Staff ID who validated |
| `checkin_location` | text | | Where validation occurred |
| `notes` | text | | Internal notes |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes:** `tickets_uuid_idx`, `tickets_qr_code_idx`, `tickets_ticket_number_idx`, `tickets_order_idx`, `tickets_used_idx`, `tickets_event_idx`

---

### 6. `staff`

Platform users (admins, staff, validators).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `email` | text | NOT NULL, UNIQUE | Login email |
| `name` | text | NOT NULL | Display name |
| `password_hash` | text | | bcrypt hash (legacy auth) |
| `auth_provider` | text | DEFAULT `'supabase'` | `supabase` or `legacy` |
| `auth_provider_id` | text | | Supabase user UUID |
| `role` | text | DEFAULT `'staff'` | `admin`, `staff`, `validator` |
| `permissions` | text | | JSON-encoded permission array |
| `is_active` | boolean | DEFAULT `true` | Account active flag |
| `last_login_at` | timestamptz | | Last login timestamp |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

---

### 7. `validation_logs`

Audit trail for every ticket scan attempt.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `ticket_id` | integer | NOT NULL, FK → `tickets.id` | Scanned ticket |
| `staff_id` | integer | FK → `staff.id` | Who scanned |
| `action` | text | NOT NULL | `validate` or `invalidate` |
| `location` | text | | Scan location |
| `device_info` | text | | Device/browser info |
| `ip_address` | text | | Scanner IP |
| `success` | boolean | NOT NULL | Scan outcome |
| `error_message` | text | | Failure reason |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |

---

### 8. `settings`

Key-value configuration store.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `key` | text | NOT NULL, UNIQUE | Setting key |
| `value` | text | NOT NULL | Setting value |
| `category` | text | DEFAULT `'general'` | Grouping category |
| `description` | text | | Human description |
| `is_public` | boolean | DEFAULT `false` | Exposed to clients? |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

---

### 9. `sales_stats`

Daily aggregated sales metrics per event.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `event_id` | integer | NOT NULL, FK → `events.id` | Event |
| `date` | timestamptz | NOT NULL | Day of stats |
| `tickets_sold` | integer | DEFAULT `0` | Tickets sold that day |
| `gross_revenue` | real | DEFAULT `0` | Gross revenue |
| `platform_fees` | real | DEFAULT `0` | Platform fees collected |
| `stripe_fees` | real | DEFAULT `0` | Stripe fees |
| `net_revenue` | real | DEFAULT `0` | Net revenue |
| `refunds` | real | DEFAULT `0` | Refund amount |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes:** `sales_stats_event_date_idx` (composite on `event_id`, `date`)

---

### 10. `platform_fees`

Individual fee records per order.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `event_id` | integer | NOT NULL, FK → `events.id` | Event |
| `order_id` | integer | FK → `orders.id` | Related order |
| `fee_type` | text | NOT NULL | Fee category |
| `fee_percent` | real | NOT NULL | Fee percentage applied |
| `base_amount` | real | NOT NULL | Amount fee is calculated on |
| `fee_amount` | real | NOT NULL | Calculated fee |
| `currency` | text | DEFAULT `'EUR'` | Currency |
| `status` | text | DEFAULT `'pending'` | `pending`, `collected`, etc. |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes:** `platform_fees_event_idx`, `platform_fees_order_idx`, `platform_fees_status_idx`

---

### 11. `invoices`

Billing invoices sent to organizers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `invoice_number` | text | NOT NULL, UNIQUE | Invoice reference |
| `organizer_id` | integer | NOT NULL, FK → `organizers.id` | Billed organizer |
| `event_id` | integer | FK → `events.id` | Related event |
| `period_start` | timestamptz | NOT NULL | Billing period start |
| `period_end` | timestamptz | NOT NULL | Billing period end |
| `subtotal` | real | NOT NULL | Ticket sales total |
| `platform_fees` | real | NOT NULL | Platform fees deducted |
| `stripe_fees` | real | NOT NULL | Stripe fees deducted |
| `tax_amount` | real | DEFAULT `0` | Tax (VAT, etc.) |
| `total_to_pay` | real | NOT NULL | Net amount to pay organizer |
| `currency` | text | DEFAULT `'EUR'` | Currency |
| `status` | text | DEFAULT `'draft'` | `draft`, `sent`, `paid` |
| `paid_at` | timestamptz | | Payment date |
| `payment_method` | text | | How paid |
| `pdf_url` | text | | Invoice PDF link |
| `notes` | text | | Notes |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes:** `invoices_organizer_idx`, `invoices_event_idx`, `invoices_status_idx`, `invoices_period_idx` (composite)

---

### 12. `subscriptions`

Organizer subscription plans (Stripe Billing).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment ID |
| `organizer_id` | integer | NOT NULL, FK → `organizers.id` | Subscriber |
| `stripe_customer_id` | text | | Stripe Customer ID |
| `stripe_subscription_id` | text | | Stripe Subscription ID |
| `plan_id` | text | NOT NULL, DEFAULT `'free'` | Plan identifier |
| `plan_name` | text | DEFAULT `'Free'` | Display name |
| `status` | text | DEFAULT `'active'` | `active`, `cancelled`, `past_due` |
| `current_period_start` | timestamptz | | Current billing period start |
| `current_period_end` | timestamptz | | Current billing period end |
| `cancel_at_period_end` | boolean | DEFAULT `false` | Cancel at renewal |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

**Indexes:** `subscriptions_organizer_idx`, `subscriptions_stripe_sub_idx`

---

## Foreign Key Summary

```
ticket_types.event_id          → events.id
orders.event_id                → events.id
tickets.order_id               → orders.id
tickets.ticket_type_id         → ticket_types.id
tickets.event_id               → events.id
validation_logs.ticket_id      → tickets.id
validation_logs.staff_id       → staff.id
sales_stats.event_id           → events.id
platform_fees.event_id         → events.id
platform_fees.order_id         → orders.id
events.organizer_id            → organizers.id
invoices.organizer_id          → organizers.id
invoices.event_id              → events.id
subscriptions.organizer_id     → organizers.id
```

## Migrations

Drizzle manages schema via `drizzle-kit push:pg` (direct push) or `drizzle-kit generate:pg` (migration files in `src/migrations-pg/`).

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/triskell_gate npm run db:migrate
```
