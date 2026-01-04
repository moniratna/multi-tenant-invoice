import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  decimal,
  pgEnum,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ========== ENUMS ==========
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'open',
  'matched',
  'paid',
]);
export const matchStatusEnum = pgEnum('match_status', [
  'proposed',
  'confirmed',
  'rejected',
]);
export const currencyEnum = pgEnum('currency', ['USD', 'EUR', 'GBP', 'INR']);

// ========== TENANTS TABLE ==========
export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ========== VENDORS TABLE ==========
export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('vendors_tenant_id_idx').on(table.tenantId),
  }),
);

// ========== INVOICES TABLE ==========
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id').references(() => vendors.id, {
      onDelete: 'set null',
    }),
    invoiceNumber: varchar('invoice_number', { length: 100 }),
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    currency: currencyEnum('currency').default('USD').notNull(),
    invoiceDate: timestamp('invoice_date', { withTimezone: true }),
    description: text('description'),
    status: invoiceStatusEnum('status').default('open').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('invoices_tenant_id_idx').on(table.tenantId),
    statusIdx: index('invoices_status_idx').on(table.status),
    vendorIdIdx: index('invoices_vendor_id_idx').on(table.vendorId),
    invoiceDateIdx: index('invoices_invoice_date_idx').on(table.invoiceDate),
  }),
);

// ========== BANK TRANSACTIONS TABLE ==========
export const bankTransactions = pgTable(
  'bank_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    externalId: varchar('external_id', { length: 255 }),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull(),
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    currency: currencyEnum('currency').default('USD').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('bank_transactions_tenant_id_idx').on(table.tenantId),
    externalIdIdx: index('bank_transactions_external_id_idx').on(
      table.externalId,
    ),
    postedAtIdx: index('bank_transactions_posted_at_idx').on(table.postedAt),
    // Unique constraint for tenant + external_id to help with idempotency
    tenantExternalIdUnique: uniqueIndex(
      'bank_transactions_tenant_external_id_unique',
    ).on(table.tenantId, table.externalId),
  }),
);

// ========== MATCHES TABLE ==========
export const matches = pgTable(
  'matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    bankTransactionId: uuid('bank_transaction_id')
      .notNull()
      .references(() => bankTransactions.id, { onDelete: 'cascade' }),
    score: decimal('score', { precision: 5, scale: 2 }).notNull(), // 0-100 score
    status: matchStatusEnum('status').default('proposed').notNull(),
    explanation: text('explanation'), // Deterministic or AI explanation
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    confirmedBy: varchar('confirmed_by', { length: 255 }), // User ID or system
  },
  (table) => ({
    tenantIdIdx: index('matches_tenant_id_idx').on(table.tenantId),
    invoiceIdIdx: index('matches_invoice_id_idx').on(table.invoiceId),
    bankTransactionIdIdx: index('matches_bank_transaction_id_idx').on(
      table.bankTransactionId,
    ),
    statusIdx: index('matches_status_idx').on(table.status),
    // Prevent duplicate matches for the same invoice-transaction pair
    invoiceTransactionUnique: uniqueIndex(
      'matches_invoice_transaction_unique',
    ).on(table.invoiceId, table.bankTransactionId),
  }),
);

// ========== IDEMPOTENCY KEYS TABLE ==========
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 255 }).notNull().unique(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    requestHash: varchar('request_hash', { length: 64 }).notNull(), // SHA-256 hash
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    keyIdx: uniqueIndex('idempotency_keys_key_idx').on(table.key),
    tenantIdIdx: index('idempotency_keys_tenant_id_idx').on(table.tenantId),
  }),
);

// ========== USERS TABLE (for auth/RLS) ==========
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'cascade',
    }),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    isSuperAdmin: integer('is_super_admin').default(0).notNull(), // 0 or 1
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    tenantIdIdx: index('users_tenant_id_idx').on(table.tenantId),
  }),
);

// ========== RELATIONS ==========
export const tenantsRelations = relations(tenants, ({ many }) => ({
  vendors: many(vendors),
  invoices: many(invoices),
  bankTransactions: many(bankTransactions),
  matches: many(matches),
  users: many(users),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [vendors.tenantId],
    references: [tenants.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  vendor: one(vendors, {
    fields: [invoices.vendorId],
    references: [vendors.id],
  }),
  matches: many(matches),
}));

export const bankTransactionsRelations = relations(
  bankTransactions,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [bankTransactions.tenantId],
      references: [tenants.id],
    }),
    matches: many(matches),
  }),
);

export const matchesRelations = relations(matches, ({ one }) => ({
  tenant: one(tenants, {
    fields: [matches.tenantId],
    references: [tenants.id],
  }),
  invoice: one(invoices, {
    fields: [matches.invoiceId],
    references: [invoices.id],
  }),
  bankTransaction: one(bankTransactions, {
    fields: [matches.bankTransactionId],
    references: [bankTransactions.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));
