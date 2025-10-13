import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, timestamp, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const tareConfigurations = pgTable("tare_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull(),
  tareWeight: real("tare_weight").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lorryQueue = pgTable("lorry_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lorryNumber: text("lorry_number").notNull(),
  line: text("line").notNull(),
  lineManager: text("line_manager").notNull(),
  phone: text("phone"),
  tareConfigId: varchar("tare_config_id").references(() => tareConfigurations.id),
  status: text("status").notNull().default("waiting"), // waiting, active, completed
  totalBags: integer("total_bags").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const weighments = pgTable("weighments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lorryId: varchar("lorry_id").references(() => lorryQueue.id).notNull(),
  tagId: text("tag_id").notNull(),
  plcWeight: real("plc_weight"),
  serialWeight: real("serial_weight"),
  finalWeight: real("final_weight").notNull(),
  tareWeight: real("tare_weight").notNull(),
  netWeight: real("net_weight").notNull(),
  weightSource: text("weight_source").notNull(), // plc, serial, average
  toleranceStatus: text("tolerance_status").notNull(), // good, warning, error
  weightDifference: real("weight_difference"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // api, mqtt, serial, tolerance
  settings: json("settings").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const systemActivities = pgTable("system_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // weighment, tolerance_violation, api_sync, connection_status
  message: text("message").notNull(),
  status: text("status").notNull(), // success, warning, error
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertTareConfigSchema = createInsertSchema(tareConfigurations).omit({ id: true, createdAt: true });
export const insertLorryQueueSchema = createInsertSchema(lorryQueue).omit({ id: true, createdAt: true });
export const insertWeighmentSchema = createInsertSchema(weighments).omit({ id: true, createdAt: true });
export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true });
export const insertSystemActivitySchema = createInsertSchema(systemActivities).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type TareConfiguration = typeof tareConfigurations.$inferSelect;
export type InsertTareConfiguration = z.infer<typeof insertTareConfigSchema>;

export type LorryQueue = typeof lorryQueue.$inferSelect;
export type InsertLorryQueue = z.infer<typeof insertLorryQueueSchema>;

export type Weighment = typeof weighments.$inferSelect;
export type InsertWeighment = z.infer<typeof insertWeighmentSchema>;

export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

export type SystemActivity = typeof systemActivities.$inferSelect;
export type InsertSystemActivity = z.infer<typeof insertSystemActivitySchema>;

// Extended types for API responses
export type LorryWithTareConfig = LorryQueue & {
  tareConfig?: TareConfiguration;
  weighmentCount?: number;
};

export type WeighmentWithLorry = Weighment & {
  lorry: LorryQueue;
};

export type WeightReading = {
  plcWeight?: number;
  serialWeight?: number;
  timestamp: Date;
  tagId?: string;
};

export type ToleranceCheck = {
  difference: number;
  tolerance: number;
  status: "good" | "warning" | "error";
  finalWeight: number;
  weightSource: "plc" | "serial" | "average";
};
