import { sql } from "drizzle-orm";
import { mysqlTable, text, varchar, real, int, timestamp, json } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(uuid())`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const tareConfigurations = mysqlTable("tare_configurations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(uuid())`),
  date: text("date").notNull(),
  tareWeight: real("tare_weight").notNull(),
  createdAt: timestamp("created_at").defaultNow().onUpdateNow(),
});

export const lorryQueue = mysqlTable("lorry_queue", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(uuid())`),
  lorryNumber: text("lorry_number").notNull(),
  line: text("line").notNull(),
  lineManager: text("line_manager").notNull(),
  phone: text("phone"),
  tareConfigId: varchar("tare_config_id", { length: 36 }).references(() => tareConfigurations.id),
  status: text("status").notNull().default("waiting"), // waiting, active, completed
  totalBags: int("total_bags").default(0),
  createdAt: timestamp("created_at").defaultNow().onUpdateNow(),
});

export const weighments = mysqlTable("weighments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(uuid())`),
  lorryId: varchar("lorry_id", { length: 36 }).references(() => lorryQueue.id).notNull(),
  tagId: text("tag_id").notNull(),
  plcWeight: real("plc_weight"),
  serialWeight: real("serial_weight"),
  finalWeight: real("final_weight").notNull(),
  tareWeight: real("tare_weight").notNull(),
  netWeight: real("net_weight").notNull(),
  weightSource: text("weight_source").notNull(), // plc, serial, average
  toleranceStatus: text("tolerance_status").notNull(), // good, warning, error
  weightDifference: real("weight_difference"),
  createdAt: timestamp("created_at").defaultNow().onUpdateNow(),
});

export const systemSettings = mysqlTable("system_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(uuid())`),
  category: text("category").notNull(), // api, mqtt, serial, tolerance
  settings: json("settings").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const systemActivities = mysqlTable("system_activities", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(uuid())`),
  type: text("type").notNull(), // weighment, tolerance_violation, api_sync, connection_status
  message: text("message").notNull(),
  status: text("status").notNull(), // success, warning, error
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().onUpdateNow(),
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
