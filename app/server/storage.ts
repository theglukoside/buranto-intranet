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
  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    moderator TEXT,
    minute_keeper TEXT,
    status TEXT DEFAULT 'draft',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS meeting_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    team TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id)
  );
  CREATE TABLE IF NOT EXISTS meeting_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    item_id INTEGER,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id)
  );
`);

export const db = drizzle(sqlite);
export { sqlite };

// Meeting types
export interface Meeting {
  id: number;
  title: string;
  date: string;
  moderator: string | null;
  minute_keeper: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingItem {
  id: number;
  meeting_id: number;
  team: string;
  category: string;
  content: string;
  author: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingFile {
  id: number;
  meeting_id: number;
  item_id: number | null;
  filename: string;
  original_name: string;
  mime_type: string | null;
  uploaded_at: string;
}

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

  // Meetings
  getMeetings(): Promise<Meeting[]>;
  getMeeting(id: number): Promise<Meeting | undefined>;
  createMeeting(data: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>): Promise<Meeting>;
  updateMeeting(id: number, data: Partial<Omit<Meeting, 'id' | 'created_at' | 'updated_at'>>): Promise<Meeting | undefined>;
  deleteMeeting(id: number): Promise<void>;

  // Meeting Items
  getMeetingItems(meetingId: number): Promise<MeetingItem[]>;
  createMeetingItem(data: Omit<MeetingItem, 'id' | 'created_at' | 'updated_at'>): Promise<MeetingItem>;
  updateMeetingItem(id: number, data: Partial<Omit<MeetingItem, 'id' | 'created_at' | 'updated_at'>>): Promise<MeetingItem | undefined>;
  deleteMeetingItem(id: number): Promise<void>;

  // Meeting Files
  getMeetingFiles(meetingId: number): Promise<MeetingFile[]>;
  createMeetingFile(data: Omit<MeetingFile, 'id' | 'uploaded_at'>): Promise<MeetingFile>;
  deleteMeetingFile(id: number): Promise<MeetingFile | undefined>;
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

  // Meetings
  async getMeetings(): Promise<Meeting[]> {
    const rows = sqlite.prepare(`SELECT * FROM meetings ORDER BY date DESC`).all() as Meeting[];
    return rows;
  }

  async getMeeting(id: number): Promise<Meeting | undefined> {
    const row = sqlite.prepare(`SELECT * FROM meetings WHERE id = ?`).get(id) as Meeting | undefined;
    return row;
  }

  async createMeeting(data: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>): Promise<Meeting> {
    const stmt = sqlite.prepare(
      `INSERT INTO meetings (title, date, moderator, minute_keeper, status, notes) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
    );
    const row = stmt.get(data.title, data.date, data.moderator ?? null, data.minute_keeper ?? null, data.status ?? 'draft', data.notes ?? null) as Meeting;
    return row;
  }

  async updateMeeting(id: number, data: Partial<Omit<Meeting, 'id' | 'created_at' | 'updated_at'>>): Promise<Meeting | undefined> {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);
    if (!fields) return this.getMeeting(id);
    const stmt = sqlite.prepare(
      `UPDATE meetings SET ${fields}, updated_at = datetime('now') WHERE id = ? RETURNING *`
    );
    const row = stmt.get(...values, id) as Meeting | undefined;
    return row;
  }

  async deleteMeeting(id: number): Promise<void> {
    sqlite.prepare(`DELETE FROM meeting_files WHERE meeting_id = ?`).run(id);
    sqlite.prepare(`DELETE FROM meeting_items WHERE meeting_id = ?`).run(id);
    sqlite.prepare(`DELETE FROM meetings WHERE id = ?`).run(id);
  }

  // Meeting Items
  async getMeetingItems(meetingId: number): Promise<MeetingItem[]> {
    const rows = sqlite.prepare(`SELECT * FROM meeting_items WHERE meeting_id = ? ORDER BY created_at ASC`).all(meetingId) as MeetingItem[];
    return rows;
  }

  async createMeetingItem(data: Omit<MeetingItem, 'id' | 'created_at' | 'updated_at'>): Promise<MeetingItem> {
    const stmt = sqlite.prepare(
      `INSERT INTO meeting_items (meeting_id, team, category, content, author) VALUES (?, ?, ?, ?, ?) RETURNING *`
    );
    const row = stmt.get(data.meeting_id, data.team, data.category, data.content, data.author ?? null) as MeetingItem;
    return row;
  }

  async updateMeetingItem(id: number, data: Partial<Omit<MeetingItem, 'id' | 'created_at' | 'updated_at'>>): Promise<MeetingItem | undefined> {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);
    if (!fields) return undefined;
    const stmt = sqlite.prepare(
      `UPDATE meeting_items SET ${fields}, updated_at = datetime('now') WHERE id = ? RETURNING *`
    );
    const row = stmt.get(...values, id) as MeetingItem | undefined;
    return row;
  }

  async deleteMeetingItem(id: number): Promise<void> {
    sqlite.prepare(`DELETE FROM meeting_items WHERE id = ?`).run(id);
  }

  // Meeting Files
  async getMeetingFiles(meetingId: number): Promise<MeetingFile[]> {
    const rows = sqlite.prepare(`SELECT * FROM meeting_files WHERE meeting_id = ? ORDER BY uploaded_at ASC`).all(meetingId) as MeetingFile[];
    return rows;
  }

  async createMeetingFile(data: Omit<MeetingFile, 'id' | 'uploaded_at'>): Promise<MeetingFile> {
    const stmt = sqlite.prepare(
      `INSERT INTO meeting_files (meeting_id, item_id, filename, original_name, mime_type) VALUES (?, ?, ?, ?, ?) RETURNING *`
    );
    const row = stmt.get(data.meeting_id, data.item_id ?? null, data.filename, data.original_name, data.mime_type ?? null) as MeetingFile;
    return row;
  }

  async deleteMeetingFile(id: number): Promise<MeetingFile | undefined> {
    const row = sqlite.prepare(`DELETE FROM meeting_files WHERE id = ? RETURNING *`).get(id) as MeetingFile | undefined;
    return row;
  }
}

export const storage = new DatabaseStorage();
