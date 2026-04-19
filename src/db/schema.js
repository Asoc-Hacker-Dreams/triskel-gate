import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Tabla de organizadores
export const organizers = sqliteTable("organizers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  taxId: text("tax_id"),
  billingAddress: text("billing_address"),
  country: text("country").default("ES"),
  currency: text("currency").default("EUR"),
  payoutMethod: text("payout_method"),
  payoutDetails: text("payout_details"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`)
});

// Tabla de eventos
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  location: text("location").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  maxTickets: integer("max_tickets").default(1000),
  status: text("status").default("active"),
  isAgorapassIntegrated: integer("is_agorapass_integrated", { mode: "boolean" }).default(false),
  agorapassEventId: text("agorapass_event_id"),
  platformFeePercent: real("platform_fee_percent").default(3.0),
  organizerId: integer("organizer_id").references(() => organizers.id),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`)
});

// Tabla de tipos de tickets
export const ticketTypes = sqliteTable("ticket_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull().references(() => events.id),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  maxQuantity: integer("max_quantity").default(100),
  saleStartDate: text("sale_start_date").notNull(),
  saleEndDate: text("sale_end_date").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`)
});

// Tabla de órdenes
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`)
}, (table) => ({
  emailIdx: index("orders_email_idx").on(table.customerEmail),
  statusIdx: index("orders_status_idx").on(table.status),
  orderNumberIdx: index("orders_order_number_idx").on(table.orderNumber)
}));

// Tabla de tickets
export const tickets = sqliteTable("tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uuid: text("uuid").notNull().unique(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  ticketTypeId: integer("ticket_type_id").notNull().references(() => ticketTypes.id),
  eventId: integer("event_id").notNull().references(() => events.id),
  qrCode: text("qr_code").notNull().unique(),
  ticketNumber: text("ticket_number").notNull().unique(),
  holderName: text("holder_name"),
  holderEmail: text("holder_email"),
  price: real("price").notNull(),
  isUsed: integer("is_used", { mode: "boolean" }).default(false),
  usedAt: text("used_at"),
  usedBy: text("used_by"),
  checkInLocation: text("checkin_location"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`)
}, (table) => ({
  uuidIdx: index("tickets_uuid_idx").on(table.uuid),
  qrCodeIdx: index("tickets_qr_code_idx").on(table.qrCode),
  ticketNumberIdx: index("tickets_ticket_number_idx").on(table.ticketNumber),
  orderIdx: index("tickets_order_idx").on(table.orderId),
  usedIdx: index("tickets_used_idx").on(table.isUsed),
  eventIdx: index("tickets_event_idx").on(table.eventId)
}));

// Tabla de staff (Federated Auth — passwordHash is deprecated, kept for migration)
export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),  // DEPRECATED — moving to Supabase Auth
  authProvider: text("auth_provider").default("supabase"),  // supabase | legacy
  authProviderId: text("auth_provider_id"),  // Supabase user UUID
  role: text("role").default("staff"),
  permissions: text("permissions"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`)
});

// Tabla de logs de validación
export const validationLogs = sqliteTable("validation_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id),
  staffId: integer("staff_id").references(() => staff.id),
  action: text("action").notNull(),
  location: text("location"),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  success: integer("success", { mode: "boolean" }).notNull(),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`)
});

// Tabla de configuraciones
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category").default("general"),
  description: text("description"),
  isPublic: integer("is_public", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`)
});

// Tabla de estadísticas de ventas
export const salesStats = sqliteTable("sales_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull().references(() => events.id),
  date: text("date").notNull(),
  ticketsSold: integer("tickets_sold").default(0),
  grossRevenue: real("gross_revenue").default(0),
  platformFees: real("platform_fees").default(0),
  stripeFees: real("stripe_fees").default(0),
  netRevenue: real("net_revenue").default(0),
  refunds: real("refunds").default(0),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`)
}, (table) => ({
  eventDateIdx: index("sales_stats_event_date_idx").on(table.eventId, table.date)
}));

// Tabla de comisiones de plataforma
export const platformFees = sqliteTable("platform_fees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull().references(() => events.id),
  orderId: integer("order_id").references(() => orders.id),
  feeType: text("fee_type").notNull(),
  feePercent: real("fee_percent").notNull(),
  baseAmount: real("base_amount").notNull(),
  feeAmount: real("fee_amount").notNull(),
  currency: text("currency").default("EUR"),
  status: text("status").default("pending"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`)
}, (table) => ({
  eventIdIdx: index("platform_fees_event_idx").on(table.eventId),
  orderIdIdx: index("platform_fees_order_idx").on(table.orderId),
  statusIdx: index("platform_fees_status_idx").on(table.status)
}));

// Tabla de facturas
export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  organizerId: integer("organizer_id").notNull().references(() => organizers.id),
  eventId: integer("event_id").references(() => events.id),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  subtotal: real("subtotal").notNull(),
  platformFees: real("platform_fees").notNull(),
  stripeFees: real("stripe_fees").notNull(),
  taxAmount: real("tax_amount").default(0),
  totalToPay: real("total_to_pay").notNull(),
  currency: text("currency").default("EUR"),
  status: text("status").default("draft"),
  paidAt: text("paid_at"),
  paymentMethod: text("payment_method"),
  pdfUrl: text("pdf_url"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`)
}, (table) => ({
  organizerIdx: index("invoices_organizer_idx").on(table.organizerId),
  eventIdx: index("invoices_event_idx").on(table.eventId),
  statusIdx: index("invoices_status_idx").on(table.status),
  periodIdx: index("invoices_period_idx").on(table.periodStart, table.periodEnd)
}));

// Tabla de suscripciones (Stripe Billing)
export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizerId: integer("organizer_id").notNull().references(() => organizers.id),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planId: text("plan_id").notNull().default("free"),   // free | pro | enterprise
  planName: text("plan_name").default("Free"),
  status: text("status").default("active"),  // active | past_due | canceled | trialing
  currentPeriodStart: text("current_period_start"),
  currentPeriodEnd: text("current_period_end"),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`)
}, (table) => ({
  organizerIdx: index("subscriptions_organizer_idx").on(table.organizerId),
  stripeSubIdx: index("subscriptions_stripe_sub_idx").on(table.stripeSubscriptionId)
}));
