# TriskelGate — API Reference

**Base URL:** `http://localhost:3001`

All responses follow the shape `{ success: boolean, ... }` unless otherwise noted.

Authentication: `Authorization: Bearer <token>` header where required.

---

## Table of Contents

- [Root & Health](#root--health)
- [Auth — /auth](#auth--auth)
- [Public Events — /api](#public-events--api)
- [Ticket Validation — /api](#ticket-validation--api)
- [Payments — /api/payment](#payments--apipayment)
- [Checkout — /api/checkout](#checkout--apicheckout)
- [Stats — /api](#stats--api)
- [Admin — /admin](#admin--admin)
- [Demo — /demo](#demo--demo)
- [PWA — /pwa](#pwa--pwa)

---

## Root & Health

### `GET /`

Welcome endpoint.

**Auth:** None

**Response:**
```json
{
  "success": true,
  "message": "🎫 TriskelGate Payment Platform API",
  "version": "1.0.0",
  "description": "...",
  "documentation": "/api/info",
  "status": "operational",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "features": ["..."]
}
```

### `GET /health`

Health check with process info.

**Auth:** None

**Response:**
```json
{
  "uptime": 123.45,
  "message": "OK",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "status": "healthy",
  "version": "1.0.0",
  "environment": "development",
  "memory": { "rss": 0, "heapTotal": 0, "heapUsed": 0, "external": 0 },
  "pid": 12345,
  "database": "connected"
}
```

### `GET /ready`

Kubernetes readiness probe.

**Auth:** None

**Response:**
```json
{
  "status": "ready",
  "timestamp": "...",
  "checks": { "database": "ok", "filesystem": "ok", "memory": "ok" }
}
```

### `GET /api/health`

API-level health check.

**Auth:** None

**Response:**
```json
{
  "success": true,
  "message": "TriskelGate Payment Platform API is running",
  "timestamp": "...",
  "version": "1.0.0"
}
```

### `GET /api/info`

API feature and endpoint listing.

**Auth:** None

**Response:**
```json
{
  "name": "TriskelGate Payment Platform",
  "version": "1.0.0",
  "description": "...",
  "features": ["..."],
  "endpoints": {
    "validation": ["POST /api/validate", "GET /api/search", "GET /api/stats", "POST /api/invalidate"],
    "payment": ["POST /api/payment/create-session", "POST /api/payment/webhook", "POST /api/payment/refund", "GET /api/checkout/sessions/:sessionId/status"],
    "system": ["GET /api/health", "GET /api/info"]
  }
}
```

---

## Auth — /auth

### `POST /auth/login`

Authenticate with email and password (legacy JWT).

**Auth:** None  
**Rate limit:** 5 req / 15 min per IP

**Request body:**
```json
{
  "email": "teststaff@hsm.dev",
  "password": "HsmStaff2026!"
}
```

**Validation:**
- `email` — valid email, normalized
- `password` — min 6 characters

**Success response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "teststaff@hsm.dev",
    "name": "Admin",
    "role": "admin",
    "permissions": ["validate_tickets", "manage_events", "..."]
  }
}
```

**Error response (401):**
```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "Credenciales inválidas"
}
```

### `GET /auth/me`

Get current authenticated user details.

**Auth:** Bearer token

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "teststaff@hsm.dev",
    "name": "Admin",
    "role": "admin",
    "permissions": ["validate_tickets", "..."],
    "lastLoginAt": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### `PUT /auth/change-password`

Change the current user's password.

**Auth:** Bearer token

**Request body:**
```json
{
  "currentPassword": "OldPassword1!",
  "newPassword": "NewPassword1!",
  "confirmPassword": "NewPassword1!"
}
```

**Validation:**
- `newPassword` — min 8 chars, must include uppercase, lowercase, digit, and symbol
- `confirmPassword` — must match `newPassword`

**Success response (200):**
```json
{
  "success": true,
  "message": "Contraseña actualizada correctamente"
}
```

### `POST /auth/create-staff`

Create a new staff user. Admin only.

**Auth:** Bearer token (role: `admin`)

**Request body:**
```json
{
  "email": "new@example.com",
  "name": "New Staff",
  "password": "SecurePass1!",
  "role": "staff",
  "permissions": ["validate_tickets", "search_tickets"]
}
```

**Validation:**
- `role` — one of `admin`, `staff`, `validator`
- `permissions` — optional array

**Success response (201):**
```json
{
  "success": true,
  "user": {
    "id": 2,
    "email": "new@example.com",
    "name": "New Staff",
    "role": "staff",
    "permissions": ["validate_tickets", "search_tickets"]
  }
}
```

### `POST /auth/logout`

Logout (stateless — token invalidation is client-side).

**Auth:** Bearer token

**Response (200):**
```json
{
  "success": true,
  "message": "Logout exitoso. Token invalidado en el cliente."
}
```

### `GET /auth/verify`

Verify that a token is valid and return user info.

**Auth:** Bearer token

**Response (200):**
```json
{
  "success": true,
  "message": "Token válido",
  "user": {
    "id": 1,
    "email": "teststaff@hsm.dev",
    "name": "Admin",
    "role": "admin",
    "permissions": ["..."]
  }
}
```

### `GET /auth/info`

Auth service metadata (no auth required).

**Auth:** None

**Response (200):**
```json
{
  "name": "TriskelGate Authentication Service",
  "version": "1.0.0",
  "endpoints": { "POST /auth/login": "...", "..." : "..." },
  "roles": { "admin": "...", "staff": "...", "validator": "..." },
  "permissions": ["validate_tickets", "search_tickets", "manage_events", "process_refunds", "view_analytics", "manage_users", "system_admin"],
  "security": {
    "Rate Limiting": "5 intentos de login por 15 minutos",
    "Password Requirements": "Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo",
    "JWT Expiration": "24 horas",
    "Token Type": "Bearer JWT"
  }
}
```

---

## Public Events — /api

### `GET /api/events`

List all active events.

**Auth:** None

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "X-Ops Dubai 2026",
      "slug": "x-ops-dubai-2026",
      "description": "...",
      "location": "Dubai",
      "startDate": "2026-03-15T09:00:00.000Z",
      "endDate": "2026-03-17T18:00:00.000Z",
      "maxTickets": 1000,
      "status": "active",
      "isAgorapassIntegrated": false,
      "platformFeePercent": 3.0,
      "organizerId": 1,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "count": 1
}
```

### `GET /api/events/:eventId`

Get a single event by ID.

**Auth:** None

**Response (200):**
```json
{
  "success": true,
  "data": { "id": 1, "name": "X-Ops Dubai 2026", "..." : "..." }
}
```

**Error (404):** `{ "success": false, "error": "EVENT_NOT_FOUND" }`

### `GET /api/events/:eventId/ticket-types`

Get active ticket types for an event.

**Auth:** None

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "eventId": 1,
      "name": "Early Bird",
      "description": "...",
      "price": 99.0,
      "maxQuantity": 100,
      "saleStartDate": "...",
      "saleEndDate": "...",
      "isActive": true,
      "createdAt": "..."
    }
  ],
  "event": { "id": 1, "name": "X-Ops Dubai 2026", "..." : "..." },
  "count": 3
}
```

---

## Ticket Validation — /api

### `POST /api/validate`

Validate a ticket by QR code.

**Auth:** None (rate-limited)  
**Rate limit:** 100 req / 15 min per IP

**Request body:**
```json
{
  "qrCode": "eyJhbGci...",
  "staffId": 1,
  "location": "Main Entrance",
  "deviceInfo": "iPhone 15 / Safari"
}
```

**Validation:**
- `qrCode` — required, non-empty
- `staffId` — optional integer
- `location` — optional string
- `deviceInfo` — optional string

**Success response (200):**
```json
{
  "success": true,
  "message": "Ticket validado correctamente",
  "ticket": {
    "id": 1,
    "ticketNumber": "T-ABC123-XYZ",
    "holderName": "John Doe",
    "holderEmail": "john@example.com",
    "price": 99.0,
    "validatedAt": "2025-01-01T10:00:00.000Z"
  },
  "event": {
    "name": "X-Ops Dubai 2026",
    "location": "Dubai",
    "date": "2026-03-15T09:00:00.000Z"
  },
  "ticketType": {
    "name": "Early Bird",
    "description": "..."
  }
}
```

**Error responses (400):**
- `TICKET_NOT_FOUND` — QR code doesn't match any ticket
- `TICKET_ALREADY_USED` — includes `usedAt` and `usedBy`
- `EVENT_NOT_STARTED` — includes `eventStartDate`
- `EVENT_ENDED` — includes `eventEndDate`

### `GET /api/search`

Search tickets by multiple criteria.

**Auth:** Bearer token  
**Rate limit:** 50 req / 15 min per IP

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `email` | string | Holder email (exact match) |
| `ticketNumber` | string | Ticket number (exact match) |
| `uuid` | string | Ticket UUID (exact match) |
| `qrCode` | string | QR code (exact match) |
| `eventId` | integer | Filter by event |
| `isUsed` | boolean | `true` or `false` |
| `startDate` | ISO 8601 | Not yet implemented in query builder |
| `endDate` | ISO 8601 | Not yet implemented in query builder |
| `limit` | integer | Default 50 |
| `offset` | integer | Default 0 |

**Response (200):**
```json
{
  "success": true,
  "tickets": [
    {
      "id": 1,
      "uuid": "abc-def-123",
      "ticketNumber": "T-ABC-XYZ",
      "qrCode": "...",
      "holderName": "John Doe",
      "holderEmail": "john@example.com",
      "price": 99.0,
      "isUsed": false,
      "usedAt": null,
      "usedBy": null,
      "checkInLocation": null,
      "createdAt": "...",
      "event": { "id": 1, "name": "...", "location": "...", "startDate": "...", "endDate": "..." },
      "ticketType": { "id": 1, "name": "Early Bird", "description": "...", "price": 99.0 }
    }
  ],
  "total": 1
}
```

### `POST /api/invalidate`

Reset a ticket's used status (undo validation).

**Auth:** Bearer token

**Request body:**
```json
{
  "ticketId": 1,
  "reason": "Scanned in error"
}
```

**Success response (200):**
```json
{
  "success": true,
  "message": "Ticket invalidado correctamente"
}
```

**Error (400):** `TICKET_NOT_FOUND`

---

## Payments — /api/payment

### `POST /api/payment/create-session`

Create a Stripe Checkout session and a pending order.

**Auth:** None

**Request body:**
```json
{
  "eventId": 1,
  "ticketTypeId": 1,
  "quantity": 2,
  "customerEmail": "buyer@example.com",
  "customerName": "Jane Doe",
  "customerPhone": "+34600000000",
  "successUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel"
}
```

**Validation:**
- `quantity` — integer, 1–10
- `customerEmail` — valid email
- `successUrl`, `cancelUrl` — valid URLs
- `customerPhone` — optional, valid mobile

**Success response (200):**
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "sessionUrl": "https://checkout.stripe.com/...",
  "orderId": 1,
  "orderNumber": "HBC-ABC123-XYZ",
  "totalAmount": 210.50,
  "subtotal": 198.0,
  "platformFee": 5.94,
  "stripeFee": 6.24,
  "mode": "live"
}
```

**Error responses:**
- `INVALID_TICKET_TYPE` — ticket type or event not found/inactive
- `SALE_NOT_STARTED` — sale window hasn't opened
- `SALE_ENDED` — sale window closed
- `QUANTITY_EXCEEDED` — exceeds `maxQuantity`

### `POST /api/payment/webhook`

Stripe webhook handler. Consumes raw body with `stripe-signature` header.

**Auth:** Stripe signature verification

**Handled events:**
- `checkout.session.completed` — marks order completed, generates tickets, updates sales stats
- `payment_intent.payment_failed` — logged

**Response:**
```json
{ "received": true }
```

### `POST /api/payment/refund`

Process a full refund for an order.

**Auth:** Bearer token

**Request body:**
```json
{
  "orderId": 1,
  "reason": "Customer requested refund"
}
```

**Success response (200):**
```json
{
  "success": true,
  "refundId": "re_...",
  "amount": 210.50
}
```

**Errors:**
- `ORDER_NOT_FOUND`
- `INVALID_ORDER_STATUS` — only `completed` orders can be refunded

---

## Checkout — /api/checkout

### `GET /api/checkout/sessions/:sessionId/status`

Poll checkout session status after Stripe redirect.

**Auth:** None

**Fast path:** If the order exists in DB as `completed`, returns immediately:
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "status": "paid",
  "orderId": 1
}
```

**Stripe lookup response:**
```json
{
  "success": true,
  "data": {
    "id": "cs_test_...",
    "status": "complete",
    "payment_status": "paid",
    "customer_email": "buyer@example.com",
    "amount_total": 21050
  }
}
```

**Errors:**
- `MISSING_SESSION_ID` (400)
- `SESSION_NOT_FOUND` (404)
- `STRIPE_NOT_CONFIGURED` (503) — when in test mode
- `STRIPE_ERROR` (502)

---

## Stats — /api

### `GET /api/stats`

Get ticket validation statistics.

**Auth:** Bearer token

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventId` | integer | Filter by event (optional) |

**Response (200):**
```json
{
  "success": true,
  "stats": {
    "total": 150,
    "validated": 45,
    "pending": 105,
    "validationRate": "30.00"
  }
}
```

---

## Admin — /admin

All admin routes require `Authorization: Bearer <token>`. The entire router uses `authMiddleware`.

### `GET /admin/dashboard`

Aggregate dashboard stats.

**Auth:** Bearer token (role: `admin` or `staff`)

**Response (200):**
```json
{
  "success": true,
  "dashboard": {
    "overview": {
      "totalEvents": 1,
      "totalTickets": 150,
      "totalRevenue": 14850.00,
      "totalValidated": 45,
      "validationRate": "30.00"
    },
    "recentActivity": {
      "orders": [
        {
          "id": 1,
          "orderNumber": "HBC-ABC-XYZ",
          "eventName": "X-Ops Dubai 2026",
          "customerName": "Jane Doe",
          "customerEmail": "jane@example.com",
          "totalAmount": 210.50,
          "status": "completed",
          "createdAt": "..."
        }
      ]
    },
    "topEvents": [
      {
        "eventId": 1,
        "eventName": "X-Ops Dubai 2026",
        "ticketCount": 150,
        "revenue": 14850.00
      }
    ]
  }
}
```

### `GET /admin/events`

List all events (optionally filtered).

**Auth:** Bearer token (role: `admin` or `staff`)

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter: `active`, `draft`, etc. |
| `limit` | integer | Default 50 |
| `offset` | integer | Default 0 |

**Response (200):**
```json
{
  "success": true,
  "events": [ { "id": 1, "name": "...", "status": "active", "..." : "..." } ]
}
```

### `POST /admin/events`

Create a new event.

**Auth:** Bearer token (role: `admin`)

**Request body:**
```json
{
  "name": "New Conference",
  "slug": "new-conference",
  "location": "Barcelona",
  "startDate": "2026-06-01T09:00:00Z",
  "endDate": "2026-06-03T18:00:00Z",
  "maxTickets": 500,
  "description": "A great event"
}
```

**Validation:**
- `name`, `slug`, `location` — required non-empty
- `startDate`, `endDate` — required ISO 8601
- `maxTickets` — optional, positive integer

**Success response (201):**
```json
{
  "success": true,
  "event": { "id": 2, "name": "New Conference", "status": "active", "..." : "..." }
}
```

### `GET /admin/ticket-types`

List ticket types (with event names).

**Auth:** Bearer token (role: `admin` or `staff`)

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventId` | integer | Filter by event |

**Response (200):**
```json
{
  "success": true,
  "ticketTypes": [
    {
      "id": 1,
      "eventId": 1,
      "name": "Early Bird",
      "price": 99.0,
      "maxQuantity": 100,
      "isActive": true,
      "eventName": "X-Ops Dubai 2026",
      "..."  : "..."
    }
  ]
}
```

### `POST /admin/ticket-types`

Create a new ticket type.

**Auth:** Bearer token (role: `admin`)

**Request body:**
```json
{
  "eventId": 1,
  "name": "VIP",
  "price": 299.0,
  "maxQuantity": 50,
  "saleStartDate": "2025-06-01T00:00:00Z",
  "saleEndDate": "2026-03-14T23:59:59Z"
}
```

**Success response (201):**
```json
{
  "success": true,
  "ticketType": { "id": 4, "name": "VIP", "isActive": true, "..." : "..." }
}
```

### `GET /admin/orders`

List orders with event names.

**Auth:** Bearer token (role: `admin` or `staff`)

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | `pending`, `completed`, `cancelled`, `refunded` |
| `eventId` | integer | Filter by event |
| `email` | string | Partial match on customer email |
| `limit` | integer | Default 50, max 100 |
| `offset` | integer | Default 0 |

**Response (200):**
```json
{
  "success": true,
  "orders": [
    {
      "id": 1,
      "orderNumber": "HBC-ABC-XYZ",
      "eventId": 1,
      "customerEmail": "jane@example.com",
      "customerName": "Jane Doe",
      "totalAmount": 210.50,
      "subtotal": 198.0,
      "platformFee": 5.94,
      "stripeFee": 6.24,
      "status": "completed",
      "eventName": "X-Ops Dubai 2026",
      "createdAt": "..."
    }
  ]
}
```

### `GET /admin/orders/:orderId`

Order details with event and tickets.

**Auth:** Bearer token (role: `admin` or `staff`)

**Response (200):**
```json
{
  "success": true,
  "order": {
    "id": 1,
    "orderNumber": "HBC-ABC-XYZ",
    "customerName": "Jane Doe",
    "totalAmount": 210.50,
    "status": "completed",
    "event": { "id": 1, "name": "X-Ops Dubai 2026", "..." : "..." },
    "tickets": [
      {
        "id": 1,
        "uuid": "...",
        "ticketNumber": "T-ABC-XYZ",
        "holderName": "Jane Doe",
        "price": 99.0,
        "isUsed": false
      }
    ]
  }
}
```

### `GET /admin/analytics/sales`

Sales analytics with date range support.

**Auth:** Bearer token (role: `admin` or `staff`)

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventId` | integer | Filter by event |
| `startDate` | ISO 8601 | Period start |
| `endDate` | ISO 8601 | Period end |

**Response (200):**
```json
{
  "success": true,
  "salesAnalytics": [
    {
      "date": "2025-01-15T00:00:00.000Z",
      "eventId": 1,
      "eventName": "X-Ops Dubai 2026",
      "ticketsSold": 10,
      "revenue": 990.0,
      "refunds": 0
    }
  ]
}
```

### `GET /admin/analytics/validation-logs`

Validation audit logs.

**Auth:** Bearer token (role: `admin` or `staff`)

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `eventId` | integer | Filter by event |
| `staffId` | integer | Filter by staff member |
| `success` | boolean | Filter by outcome |
| `limit` | integer | Default 100, max 500 |
| `offset` | integer | Default 0 |

**Response (200):**
```json
{
  "success": true,
  "validationLogs": [
    {
      "id": 1,
      "ticketId": 1,
      "staffId": 1,
      "action": "validate",
      "location": "Main Entrance",
      "deviceInfo": "...",
      "ipAddress": "192.168.1.1",
      "success": true,
      "errorMessage": null,
      "createdAt": "...",
      "ticket": { "id": 1, "ticketNumber": "T-ABC-XYZ", "holderName": "John" },
      "event": { "id": 1, "name": "X-Ops Dubai 2026" },
      "staff": { "id": 1, "name": "Admin", "email": "teststaff@hsm.dev" }
    }
  ]
}
```

### `GET /admin/staff`

List all staff users.

**Auth:** Bearer token (role: `admin`)

**Response (200):**
```json
{
  "success": true,
  "staff": [
    {
      "id": 1,
      "email": "teststaff@hsm.dev",
      "name": "Admin",
      "role": "admin",
      "permissions": ["validate_tickets", "manage_events", "..."],
      "isActive": true,
      "lastLoginAt": "...",
      "createdAt": "..."
    }
  ]
}
```

### `GET /admin/info`

Admin panel metadata.

**Auth:** Bearer token (any authenticated user — `authMiddleware` applied)

**Response (200):**
```json
{
  "name": "TriskelGate Admin Panel API",
  "version": "1.0.0",
  "endpoints": { "dashboard": "GET /admin/dashboard", "..." : "..." },
  "requiredRoles": ["admin", "staff"],
  "features": ["📊 Dashboard con estadísticas en tiempo real", "..."]
}
```

---

## Demo — /demo

### `GET /demo/status`

Revenue and fee overview in demo mode.

**Auth:** None

**Response (200):**
```json
{
  "demo": true,
  "message": "🧪 Demo Mode Active",
  "revenue": {
    "totalOrders": 5,
    "totalSales": 1500.00,
    "platformFees": 45.00,
    "stripeFees": 44.75,
    "netRevenue": 1410.25
  },
  "recentOrders": [ { "...order rows..." } ],
  "pricing": {
    "platformFeePercent": 3.0,
    "stripeFeePercent": 2.9,
    "stripeFixedFee": 0.25
  }
}
```

### `POST /demo/simulate-order`

Calculate fee breakdown for a hypothetical order.

**Auth:** None

**Request body:**
```json
{
  "ticketPrice": 99.0,
  "quantity": 3
}
```

**Response (200):**
```json
{
  "breakdown": {
    "subtotal": "297.00",
    "platformFee": "8.91",
    "stripeFee": "9.36",
    "totalAmount": "315.27"
  },
  "fees": {
    "triskellGate": "3%",
    "stripe": "2.9% + €0.25/ticket"
  },
  "organizerReceives": "278.73"
}
```

---

## PWA — /pwa

### `GET /pwa/`

Serves the QR ticket validator HTML page (`public/validator.html`).

**Auth:** None  
**Content-Type:** `text/html`

### `GET /pwa/manifest.json`

Serves the PWA manifest file.

**Auth:** None  
**Content-Type:** `application/json`

### `GET /pwa/sw.js`

Serves the Service Worker script.

**Auth:** None  
**Content-Type:** `application/javascript`

### `GET /pwa/info`

PWA capabilities metadata.

**Auth:** None

**Response (200):**
```json
{
  "name": "TriskelGate Ticket Validator",
  "version": "1.0.0",
  "type": "Progressive Web App",
  "features": {
    "offline": true,
    "notifications": true,
    "qrScanner": true,
    "installable": true,
    "responsive": true
  },
  "capabilities": {
    "cameraAccess": "Para escaneo de códigos QR",
    "localStorage": "Para funcionamiento offline",
    "serviceWorker": "Para cache y sincronización",
    "notifications": "Para alertas de validación",
    "wakeLock": "Para mantener pantalla activa"
  },
  "endpoints": {
    "app": "/pwa",
    "manifest": "/pwa/manifest.json",
    "serviceWorker": "/pwa/sw.js"
  }
}
```

---

## Error Envelope

All error responses follow a consistent shape:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

Validation errors include an `errors` array:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "errors": [
    { "type": "field", "msg": "Email válido requerido", "path": "email", "location": "body" }
  ]
}
```

## Error Codes Reference

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Missing or expired token |
| `INVALID_TOKEN` | 401 | Token verification failed |
| `FORBIDDEN` | 403 | Insufficient role/permission |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ACCOUNT_DISABLED` | 401 | Staff account is inactive |
| `EMAIL_EXISTS` | 400 | Email already registered |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `TICKET_NOT_FOUND` | 400 | QR code doesn't match any ticket |
| `TICKET_ALREADY_USED` | 400 | Ticket was already scanned |
| `EVENT_NOT_FOUND` | 404 | Event doesn't exist |
| `EVENT_NOT_STARTED` | 400 | Event hasn't begun yet |
| `EVENT_ENDED` | 400 | Event is over |
| `INVALID_TICKET_TYPE` | 400 | Ticket type or event invalid |
| `SALE_NOT_STARTED` | 400 | Sale window hasn't opened |
| `SALE_ENDED` | 400 | Sale window closed |
| `QUANTITY_EXCEEDED` | 400 | Exceeds max per order |
| `ORDER_NOT_FOUND` | 400 | Order doesn't exist |
| `INVALID_ORDER_STATUS` | 400 | Order not in refundable state |
| `STRIPE_NOT_CONFIGURED` | 503 | Stripe missing in test mode |
| `SESSION_NOT_FOUND` | 404 | Checkout session not found |
| `TOO_MANY_ATTEMPTS` | 429 | Rate limit exceeded |
| `NOT_FOUND` | 404 | Endpoint doesn't exist |
