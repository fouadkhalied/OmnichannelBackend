import { pgTable, uuid, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"),
    displayName: text("display_name"),
    isActivated: boolean("is_activated").default(false).notNull(),
    activationRequestedAt: timestamp("activation_requested_at").defaultNow(),
    activatedAt: timestamp("activated_at"),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
