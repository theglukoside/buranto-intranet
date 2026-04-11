import {
  type Event, type InsertEvent, events,
  type Document as Doc, type InsertDocument, documents,
  type ApiCredential, type InsertApiCredential, apiCredentials,
  appSettings,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Auto-create tables on startup
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    time TEXT,
    category TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    folder TEXT,
    size INTEGER NOT NULL,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS api_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT NOT NULL UNIQUE,
    credentials TEXT NOT NULL
  );
`);

export const db = drizzle(sqlite);

export interface IStorage {
  // Auth
  getAppPassword(): Promise<string | null>;
  setAppPassword(hash: string): Promise<void>;
  verifyPassword(password: string): Promise<boolean>;

  // Events
  getEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<void>;

  // Documents
  getDocuments(): Promise<Doc[]>;
  getDocument(id: number): Promise<Doc | undefined>;
  createDocument(doc: InsertDocument): Promise<Doc>;
  deleteDocument(id: number): Promise<Doc | undefined>;

  // API Credentials
  getApiCredentials(): Promise<ApiCredential[]>;
  getApiCredential(service: string): Promise<ApiCredential | undefined>;
  upsertApiCredential(cred: InsertApiCredential): Promise<ApiCredential>;

  // Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Seed default password if not exists
    const existing = db.select().from(appSettings).where(eq(appSettings.key, "app_password")).get();
    if (!existing) {
      const hash = bcrypt.hashSync("buranto-2026", 10);
      db.insert(appSettings).values({ key: "app_password", value: hash }).run();
    }
  }

  async getAppPassword(): Promise<string | null> {
    const row = db.select().from(appSettings).where(eq(appSettings.key, "app_password")).get();
    return row?.value ?? null;
  }

  async setAppPassword(hash: string): Promise<void> {
    const existing = db.select().from(appSettings).where(eq(appSettings.key, "app_password")).get();
    if (existing) {
      db.update(appSettings).set({ value: hash }).where(eq(appSettings.key, "app_password")).run();
    } else {
      db.insert(appSettings).values({ key: "app_password", value: hash }).run();
    }
  }

  async verifyPassword(password: string): Promise<boolean> {
    const hash = await this.getAppPassword();
    if (!hash) return false;
    return bcrypt.compareSync(password, hash);
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return db.select().from(events).all();
  }

  async getEvent(id: number): Promise<Event | undefined> {
    return db.select().from(events).where(eq(events.id, id)).get();
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    return db.insert(events).values(event).returning().get();
  }

  async updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event | undefined> {
    return db.update(events).set(event).where(eq(events.id, id)).returning().get();
  }

  async deleteEvent(id: number): Promise<void> {
    db.delete(events).where(eq(events.id, id)).run();
  }

  // Documents
  async getDocuments(): Promise<Doc[]> {
    return db.select().from(documents).all();
  }

  async getDocument(id: number): Promise<Doc | undefined> {
    return db.select().from(documents).where(eq(documents.id, id)).get();
  }

  async createDocument(doc: InsertDocument): Promise<Doc> {
    return db.insert(documents).values(doc).returning().get();
  }

  async deleteDocument(id: number): Promise<Doc | undefined> {
    return db.delete(documents).where(eq(documents.id, id)).returning().get();
  }

  // API Credentials
  async getApiCredentials(): Promise<ApiCredential[]> {
    return db.select().from(apiCredentials).all();
  }

  async getApiCredential(service: string): Promise<ApiCredential | undefined> {
    return db.select().from(apiCredentials).where(eq(apiCredentials.service, service)).get();
  }

  async upsertApiCredential(cred: InsertApiCredential): Promise<ApiCredential> {
    const existing = db.select().from(apiCredentials).where(eq(apiCredentials.service, cred.service)).get();
    if (existing) {
      return db.update(apiCredentials).set({ credentials: cred.credentials }).where(eq(apiCredentials.service, cred.service)).returning().get();
    }
    return db.insert(apiCredentials).values(cred).returning().get();
  }

  // Settings
  async getSetting(key: string): Promise<string | null> {
    const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
    if (existing) {
      db.update(appSettings).set({ value }).where(eq(appSettings.key, key)).run();
    } else {
      db.insert(appSettings).values({ key, value }).run();
    }
  }
}

export const storage = new DatabaseStorage();
