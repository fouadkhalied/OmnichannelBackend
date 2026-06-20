import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { TenantPlan } from "../../../domain/valueObjects/TenantContext";

export const planEnum = pgEnum("organization_plan", [
    TenantPlan.FREE,
    TenantPlan.PRO,
    TenantPlan.ENTERPRISE,
]);

export const organizations = pgTable("organizations", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    plan: planEnum("plan").notNull().default(TenantPlan.FREE),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
