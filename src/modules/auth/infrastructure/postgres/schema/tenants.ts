import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { TenantPlan } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import { planEnum } from "../../../../../libs/shared/infrastructure/postgres/schema/organizations";

export const tenants = pgTable("tenants", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: text("company_name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    plan: planEnum("plan").notNull().default(TenantPlan.FREE),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
