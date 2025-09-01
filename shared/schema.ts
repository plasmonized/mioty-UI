import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const connections = pgTable("connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  interface: text("interface"),
  status: text("status").notNull().default("disconnected"), // connected, disconnected, pending
  ipAddress: text("ip_address").default("172.30.1.1"),
  edgeCardIp: text("edge_card_ip").default("172.30.1.2"),
  autoConnect: boolean("auto_connect").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const baseStationConfig = pgTable("base_station_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  uniqueBaseStationId: text("unique_base_station_id").notNull(),
  baseStationName: text("base_station_name").notNull(),
  baseStationVendor: text("base_station_vendor").notNull(),
  baseStationModel: text("base_station_model").notNull(),
  serviceCenterAddr: text("service_center_addr").notNull(),
  serviceCenterPort: integer("service_center_port").notNull(),
  profile: text("profile").notNull().default("EU1"),
  tlsAuthRequired: boolean("tls_auth_required").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const certificates = pgTable("certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull().unique(),
  type: text("type").notNull(), // certificate, key
  description: text("description"),
  status: text("status").notNull().default("valid"), // valid, invalid, missing
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  content: text("content"), // base64 encoded content
});

export const baseStationStatus = pgTable("base_station_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull().default("stopped"), // running, stopped, error
  autoStart: boolean("auto_start").default(false),
  lastStarted: timestamp("last_started"),
  lastStopped: timestamp("last_stopped"),
  uptime: text("uptime"),
  memoryUsage: text("memory_usage"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow(),
  level: text("level").notNull(), // INFO, WARN, ERROR, CONN
  message: text("message").notNull(),
  source: text("source").default("system"),
});

export const systemInfo = pgTable("system_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cliVersion: text("cli_version").default("0.2.5"),
  edgeCardModel: text("edge_card_model").default("GWC-62-MY-868"),
  firmwareVersion: text("firmware_version"),
  lastSync: timestamp("last_sync"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBaseStationConfigSchema = createInsertSchema(baseStationConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertCertificateSchema = createInsertSchema(certificates).omit({
  id: true,
  uploadedAt: true,
});

export const insertBaseStationStatusSchema = createInsertSchema(baseStationStatus).omit({
  id: true,
  updatedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

export const insertSystemInfoSchema = createInsertSchema(systemInfo).omit({
  id: true,
  updatedAt: true,
});

// Types
export type Connection = typeof connections.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;

export type BaseStationConfig = typeof baseStationConfig.$inferSelect;
export type InsertBaseStationConfig = z.infer<typeof insertBaseStationConfigSchema>;

export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;

export type BaseStationStatus = typeof baseStationStatus.$inferSelect;
export type InsertBaseStationStatus = z.infer<typeof insertBaseStationStatusSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type SystemInfo = typeof systemInfo.$inferSelect;
export type InsertSystemInfo = z.infer<typeof insertSystemInfoSchema>;
