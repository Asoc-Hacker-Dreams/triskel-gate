import { pgTable, text, real, integer, boolean, timestamp, index, uniqueIndex, serial } from "drizzle-orm/pg-core";

export const organizers = pgTable("organizers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  taxId: text("tax_id"),
  billingAddress: text("billing_address"),
  country: text("country").default("ES"),
  currency: text("currency").default("EUR"),
  payoutMethod: text("payout_method"),
  payoutDetails: text("payout_details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  location: text("location").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  maxTickets: integer("max_tickets").default(1000),
  status: text("status").default("active"),
  isAgorapassIntegrated: boolean("is_agorapass_integrated").default(false),
  agorapassEventId: text("agorapass_event_id"),
  platformFeePercent: real("platform_fee_percent").default(3.0),
  organizerId: integer("organizer_id").references(() => organizers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const ticketTypes = pgTable("ticket_types", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  maxQuantity: integer("max_quantity").default(100),
  saleStartDate: timestamp("sale_start_date", { withTimezone: true }).notNull(),
  saleEndDate: timestamp("sale_end_date", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  eventId: integer("event_id").notNull().references(() => events.id),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  subtotal: real("subtotal").notNull(),
  platformFee: real("platform_fee").notNull().default(0),
  stripeFee: real("stripe_fee").notNull().default(0),
  totalAmount: real("total_amount").notNull(),
  currency: text("currency").default("EUR"),
  status: text("status").default("pending"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  emailIdx: index("orders_email_idx").on(table.customerEmail),
  statusIdx: index("orders_status_idx").on(table.status),
  orderNumberIdx: index("orders_order_number_idx").on(table.orderNumber)
}));

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull().unique(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  ticketTypeId: integer("ticket_type_id").notNull().references(() => ticketTypes.id),
  eventId: integer("event_id").notNull().references(() => events.id),
  qrCode: text("qr_code").notNull().unique(),
  ticketNumber: text("ticket_number").notNull().unique(),
  holderName: text("holder_name"),
  holderEmail: text("holder_email"),
  price: real("price").notNull(),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: text("used_by"),
  checkInLocation: text("checkin_location"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  uuidIdx: index("tickets_uuid_idx").on(table.uuid),
  qrCodeIdx: index("tickets_qr_code_idx").on(table.qrCode),
  ticketNumberIdx: index("tickets_ticket_number_idx").on(table.ticketNumber),
  orderIdx: index("tickets_order_idx").on(table.orderId),
  usedIdx: index("tickets_used_idx").on(table.isUsed),
  eventIdx: index("tickets_event_idx").on(table.eventId)
}));

export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  authProvider: text("auth_provider").default("supabase"),
  authProviderId: text("auth_provider_id"),
  role: text("role").default("staff"),
  permissions: text("permissions"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const validationLogs = pgTable("validation_logs", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id),
  staffId: integer("staff_id").references(() => staff.id),
  action: text("action").notNull(),
  location: text("location"),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category").default("general"),
  description: text("description"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const salesStats = pgTable("sales_stats", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  date: timestamp("date", { withTimezone: true }).notNull(),
  ticketsSold: integer("tickets_sold").default(0),
  grossRevenue: real("gross_revenue").default(0),
  platformFees: real("platform_fees").default(0),
  stripeFees: real("stripe_fees").default(0),
  netRevenue: real("net_revenue").default(0),
  refunds: real("refunds").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  eventDateIdx: index("sales_stats_event_date_idx").on(table.eventId, table.date)
}));

export const platformFees = pgTable("platform_fees", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  orderId: integer("order_id").references(() => orders.id),
  feeType: text("fee_type").notNull(),
  feePercent: real("fee_percent").notNull(),
  baseAmount: real("base_amount").notNull(),
  feeAmount: real("fee_amount").notNull(),
  currency: text("currency").default("EUR"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  eventIdIdx: index("platform_fees_event_idx").on(table.eventId),
  orderIdIdx: index("platform_fees_order_idx").on(table.orderId),
  statusIdx: index("platform_fees_status_idx").on(table.status)
}));

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  organizerId: integer("organizer_id").notNull().references(() => organizers.id),
  eventId: integer("event_id").references(() => events.id),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  subtotal: real("subtotal").notNull(),
  platformFees: real("platform_fees").notNull(),
  stripeFees: real("stripe_fees").notNull(),
  taxAmount: real("tax_amount").default(0),
  totalToPay: real("total_to_pay").notNull(),
  currency: text("currency").default("EUR"),
  status: text("status").default("draft"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paymentMethod: text("payment_method"),
  pdfUrl: text("pdf_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  organizerIdx: index("invoices_organizer_idx").on(table.organizerId),
  eventIdx: index("invoices_event_idx").on(table.eventId),
  statusIdx: index("invoices_status_idx").on(table.status),
  periodIdx: index("invoices_period_idx").on(table.periodStart, table.periodEnd)
}));

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  organizerId: integer("organizer_id").notNull().references(() => organizers.id),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planId: text("plan_id").notNull().default("free"),
  planName: text("plan_name").default("Free"),
  status: text("status").default("active"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  organizerIdx: index("subscriptions_organizer_idx").on(table.organizerId),
  stripeSubIdx: index("subscriptions_stripe_sub_idx").on(table.stripeSubscriptionId)
}));

export const userConsents = pgTable("user_consents", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  email: text("email").notNull(),
  consentType: text("consent_type").notNull(),  // 'essential'|'analytics'|'marketing'|'newsletters'|'product_updates'|'partner_promos'
  granted: boolean("granted").notNull().default(false),
  grantedAt: timestamp("granted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  method: text("method").notNull(),  // 'signup'|'banner'|'profile'|'import'|'api'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("idx_tg_consents_email").on(table.email),
  userTypeIdx: uniqueIndex("idx_tg_consents_user_type").on(table.userId, table.consentType),
}));

export const passkeyCredentials = pgTable("passkey_credentials", {
  id: serial("id").primaryKey(),
  credentialId: text("credential_id").notNull(),
  userId: text("user_id").notNull(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  deviceType: text("device_type"),
  backedUp: boolean("backed_up").default(false),
  transports: text("transports"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  credentialIdIdx: uniqueIndex("passkey_credential_id_uidx").on(table.credentialId),
  userIdIdx: index("passkey_user_id_idx").on(table.userId),
}));
