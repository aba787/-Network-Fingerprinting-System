import { pgTable, serial, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deviceBaselinesTable = pgTable("device_baselines", {
  id: serial("id").primaryKey(),
  ip: varchar("ip", { length: 45 }).notNull(),
  label: varchar("label", { length: 255 }),
  fingerprint: jsonb("fingerprint").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertDeviceBaselineSchema = createInsertSchema(deviceBaselinesTable).omit({ id: true, created_at: true });
export type InsertDeviceBaseline = z.infer<typeof insertDeviceBaselineSchema>;
export type DeviceBaseline = typeof deviceBaselinesTable.$inferSelect;
