import { pgTable, uuid, text, timestamp, integer, index, unique } from "drizzle-orm/pg-core";
import { stores } from "./stores";

export const inventoryLevels = pgTable("inventory_levels", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id").notNull(),
    locationId: text("location_id").notNull(),
    available: integer("available").notNull().default(0),
    data: text("data"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    storeIdx: index("idx_inventory_store").on(t.storeId),
    itemIdx: index("idx_inventory_item").on(t.inventoryItemId),
    uniqueConstraint: unique("uq_inventory_store_item_loc").on(
        t.storeId,
        t.inventoryItemId,
        t.locationId
    ),
}));

export type InventoryLevel = typeof inventoryLevels.$inferSelect;
export type NewInventoryLevel = typeof inventoryLevels.$inferInsert;
