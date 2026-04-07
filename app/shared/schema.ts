import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// App password for authentication
export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

// Events / Termine
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  time: text("time"),
  category: text("category").notNull(), // Gemeinde, Kultur, Sport, Privat
});

export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Documents metadata
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(), // Verträge, Versicherungen, Haus, Fahrzeuge, Finanzen, Sonstiges
  folder: text("folder"),
  size: integer("size").notNull(),
  mimeType: text("mime_type"),
  storagePath: text("storage_path").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// API Credentials
export const apiCredentials = sqliteTable("api_credentials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  service: text("service").notNull().unique(), // solar_manager, digitalstrom, porsche, mini, elektra
  credentials: text("credentials").notNull(), // JSON string of key-value pairs
});

export const insertApiCredentialSchema = createInsertSchema(apiCredentials).omit({ id: true });
export type InsertApiCredential = z.infer<typeof insertApiCredentialSchema>;
export type ApiCredential = typeof apiCredentials.$inferSelect;
