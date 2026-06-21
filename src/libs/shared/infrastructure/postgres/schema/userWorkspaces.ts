import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { organizations } from "./organizations";
import { stores } from "../../../../../modules/auth/infrastructure/postgres/schema/stores";

export const userWorkspaces = pgTable("user_workspaces", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    role: text("role").default("admin").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    userOrgStoreIdx: uniqueIndex("user_org_store_unique_idx").on(table.userId, table.organizationId, table.storeId),
    userIdx: index("user_workspaces_user_id_idx").on(table.userId),
    orgIdx: index("user_workspaces_organization_id_idx").on(table.organizationId),
}));

export type UserWorkspace = typeof userWorkspaces.$inferSelect;
export type NewUserWorkspace = typeof userWorkspaces.$inferInsert;
