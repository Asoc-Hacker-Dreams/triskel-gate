import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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
  status: text("status").default("active"), // active, paused, cancelled, completed
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
  totalAmount: real("total_amount").notNull(),
  currency: text("currency").default("EUR"),
  status: text("status").default("pending"), // pending, completed, cancelled, refunded
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

// Tabla de tickets mejorada
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
  usedBy: text("used_by"), // staff member who validated
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

// Tabla de staff/administradores
export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("staff"), // admin, staff, validator
  permissions: text("permissions"), // JSON string
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
  action: text("action").notNull(), // validate, invalidate, check
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
  date: text("date").notNull(), // YYYY-MM-DD
  ticketsSold: integer("tickets_sold").default(0),
  revenue: real("revenue").default(0),
  refunds: real("refunds").default(0),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`)
}, (table) => ({
  eventDateIdx: index("sales_stats_event_date_idx").on(table.eventId, table.date)
}));
