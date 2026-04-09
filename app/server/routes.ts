import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertDocumentSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import http from "http";
import crypto from "crypto";
import { fetchPorscheData, fetchBmwData, getPorscheCache, getBmwCache } from "./vehicle-api";
import { getDssCache, dssCallScene, dssSetOutput } from "./dss-api";
import { getSonosCache, discoverSonos, sonosPlay, sonosPause, sonosNext, sonosPrevious, sonosSetVolume, sonosSetMute } from "./sonos-api";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth config (password required setting)
  app.get("/api/auth/config", async (_req, res) => {
    const val = await storage.getSetting("password_required");
    // Default: password required (true)
    const passwordRequired = val === null ? true : val !== "false";
    res.json({ passwordRequired });
  });

  app.post("/api/auth/config", async (req, res) => {
    const { passwordRequired } = req.body;
    await storage.setSetting("password_required", passwordRequired ? "true" : "false");
    res.json({ ok: true, passwordRequired });
  });

  // Auth
  app.post("/api/auth/login", async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: "Passwort erforderlich" });
    const valid = await storage.verifyPassword(password);
    if (valid) {
      return res.json({ success: true });
    }
    return res.status(401).json({ message: "Falsches Passwort" });
  });

  app.post("/api/auth/change-password", async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Beide Passwörter erforderlich" });
    const valid = await storage.verifyPassword(currentPassword);
    if (!valid) return res.status(401).json({ message: "Aktuelles Passwort falsch" });
    const hash = bcrypt.hashSync(newPassword, 10);
    await storage.setAppPassword(hash);
    return res.json({ success: true });
  });

  // Events
  app.get("/api/events", async (_req, res) => {
    const allEvents = await storage.getEvents();
    res.json(allEvents);
  });

  app.post("/api/events", async (req, res) => {
    const parsed = insertEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const event = await storage.createEvent(parsed.data);
    res.json(event);
  });

  app.patch("/api/events/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const event = await storage.updateEvent(id, req.body);
    if (!event) return res.status(404).json({ message: "Nicht gefunden" });
    res.json(event);
  });

  app.delete("/api/events/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteEvent(id);
    res.json({ success: true });
  });

  // Documents
  app.get("/api/documents", async (_req, res) => {
    const docs = await storage.getDocuments();
    res.json(docs);
  });

  app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Keine Datei" });
    const category = req.body.category || "Sonstiges";
    const folder = req.body.folder || null;
    const doc = await storage.createDocument({
      name: req.file.originalname,
      category,
      folder,
      size: req.file.size,
      mimeType: req.file.mimetype,
      storagePath: req.file.filename,
      uploadedAt: new Date().toISOString(),
    });
    res.json(doc);
  });

  app.get("/api/documents/:id/download", async (req, res) => {
    const id = parseInt(req.params.id);
    const doc = await storage.getDocument(id);
    if (!doc) return res.status(404).json({ message: "Nicht gefunden" });
    const filePath = path.join(UPLOADS_DIR, doc.storagePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Datei nicht gefunden" });
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.name)}"`);
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });

  app.delete("/api/documents/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const doc = await storage.deleteDocument(id);
    if (doc) {
      const filePath = path.join(UPLOADS_DIR, doc.storagePath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  });

  // API Credentials
  app.get("/api/credentials", async (_req, res) => {
    const creds = await storage.getApiCredentials();
    // Don't expose raw credentials - mask them
    const masked = creds.map(c => ({
      ...c,
      credentials: JSON.stringify(
        Object.fromEntries(
          Object.entries(JSON.parse(c.credentials)).map(([k, v]) => [k, typeof v === 'string' && v.length > 0 ? "••••••••" : ""])
        )
      ),
    }));
    res.json(masked);
  });

  app.post("/api/credentials", async (req, res) => {
    const { service, credentials } = req.body;
    if (!service || !credentials) return res.status(400).json({ message: "Service und Zugangsdaten erforderlich" });
    const cred = await storage.upsertApiCredential({ service, credentials: JSON.stringify(credentials) });
    res.json(cred);
  });

  // ─── Dahua Camera Proxy ──────────────────────────────────────────────────
  // Proxies snapshot requests to the Dahua NVR on the local network.
  // Uses HTTP Digest Authentication (RFC 2617) as required by Dahua devices.
  // This avoids mixed-content (HTTPS→HTTP) blocks in the browser.
  const DAHUA_IP = "192.168.1.218";
  const DAHUA_USER = "Brandt";
  const DAHUA_PASS = "Video@Brandt667";
  let dahuaNcCounter = 0;

  /** Parse WWW-Authenticate Digest challenge header */
  function parseDigestChallenge(header: string): Record<string, string> {
    const params: Record<string, string> = {};
    const regex = /(\w+)=(?:"([^"]*)"|([^,\s]*))/g;
    let match;
    while ((match = regex.exec(header)) !== null) {
      params[match[1]] = match[2] ?? match[3];
    }
    return params;
  }

  /** Build Digest Authorization header */
  function buildDigestAuth(
    challenge: Record<string, string>,
    method: string,
    uri: string
  ): string {
    const realm = challenge.realm || "";
    const nonce = challenge.nonce || "";
    const qop = challenge.qop || "";
    dahuaNcCounter++;
    const nc = dahuaNcCounter.toString(16).padStart(8, "0");
    const cnonce = crypto.randomBytes(8).toString("hex");

    const ha1 = crypto.createHash("md5").update(`${DAHUA_USER}:${realm}:${DAHUA_PASS}`).digest("hex");
    const ha2 = crypto.createHash("md5").update(`${method}:${uri}`).digest("hex");

    let response: string;
    if (qop.includes("auth")) {
      response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`).digest("hex");
    } else {
      response = crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
    }

    let header = `Digest username="${DAHUA_USER}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
    if (qop.includes("auth")) {
      header += `, qop=auth, nc=${nc}, cnonce="${cnonce}"`;
    }
    if (challenge.opaque) {
      header += `, opaque="${challenge.opaque}"`;
    }
    return header;
  }

  /** Fetch from Dahua with Digest auth, returns a Promise of http.IncomingMessage */
  function dahuaFetch(urlPath: string, timeoutMs = 8000): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
      const url = `http://${DAHUA_IP}${urlPath}`;

      // First request — expect 401 with WWW-Authenticate
      const req1 = http.get(url, { timeout: timeoutMs }, (res1) => {
        if (res1.statusCode === 401 && res1.headers["www-authenticate"]) {
          // Parse challenge and retry with Digest auth
          res1.resume(); // consume body
          const challenge = parseDigestChallenge(res1.headers["www-authenticate"]!);
          const authHeader = buildDigestAuth(challenge, "GET", urlPath);

          const req2 = http.get(url, {
            timeout: timeoutMs,
            headers: { Authorization: authHeader },
          }, (res2) => {
            resolve(res2);
          });
          req2.on("error", reject);
          req2.on("timeout", () => { req2.destroy(); reject(new Error("timeout")); });
        } else if (res1.statusCode && res1.statusCode >= 200 && res1.statusCode < 300) {
          // No auth needed (unlikely for Dahua but handle gracefully)
          resolve(res1);
        } else {
          res1.resume();
          reject(new Error(`HTTP ${res1.statusCode}`));
        }
      });
      req1.on("error", reject);
      req1.on("timeout", () => { req1.destroy(); reject(new Error("timeout")); });
    });
  }

  app.get("/api/dahua/snapshot/:channel", async (req, res) => {
    const channel = parseInt(req.params.channel);
    if (isNaN(channel) || channel < 1 || channel > 16) {
      return res.status(400).json({ message: "Ungültiger Kanal" });
    }

    try {
      const proxyRes = await dahuaFetch(`/cgi-bin/snapshot.cgi?channel=${channel}`);
      if (!proxyRes.statusCode || proxyRes.statusCode >= 400) {
        proxyRes.resume();
        return res.status(502).json({ message: "NVR Fehler" });
      }
      res.setHeader("Content-Type", proxyRes.headers["content-type"] || "image/jpeg");
      res.setHeader("Cache-Control", "no-cache, no-store");
      proxyRes.pipe(res);
    } catch {
      res.status(502).json({ message: "NVR nicht erreichbar" });
    }
  });

  // Connection test endpoint for Dahua NVR
  app.get("/api/dahua/ping", async (_req, res) => {
    try {
      const proxyRes = await dahuaFetch("/cgi-bin/magicBox.cgi?action=getSystemInfo", 5000);
      const reachable = proxyRes.statusCode !== undefined && proxyRes.statusCode < 400;
      proxyRes.resume();
      res.json({ reachable });
    } catch {
      res.json({ reachable: false });
    }
  });

  // ─── DoorBird API ───────────────────────────────────────────────────────────
  // Proxies requests to the DoorBird device on the LAN.
  // Credentials stored in api_credentials table (service: 'doorbird').

  async function getDoorBirdCreds(): Promise<{ ip: string; user: string; pass: string } | null> {
    const cred = await storage.getApiCredential("doorbird");
    if (!cred) return null;
    try {
      const { ip, username, password } = JSON.parse(cred.credentials);
      if (!ip || !username || !password) return null;
      return { ip, user: username, pass: password };
    } catch { return null; }
  }

  function doorBirdFetch(ip: string, user: string, pass: string, path: string, timeoutMs = 8000): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${user}:${pass}`).toString("base64");
      const url = `http://${ip}${path}`;
      const req = http.get(url, {
        timeout: timeoutMs,
        headers: { Authorization: `Basic ${auth}` },
      }, (res) => {
        if (res.statusCode === 401) {
          res.resume();
          reject(new Error("Authentifizierung fehlgeschlagen (401)"));
        } else {
          resolve(res);
        }
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("DoorBird Timeout")); });
    });
  }

  // Live snapshot
  app.get("/api/doorbird/snapshot", async (_req, res) => {
    const creds = await getDoorBirdCreds();
    if (!creds) return res.status(400).json({ message: "DoorBird nicht konfiguriert" });
    try {
      const proxyRes = await doorBirdFetch(creds.ip, creds.user, creds.pass, "/bha-api/image.cgi");
      res.setHeader("Content-Type", proxyRes.headers["content-type"] || "image/jpeg");
      res.setHeader("Cache-Control", "no-cache, no-store");
      proxyRes.pipe(res);
    } catch (e: any) {
      res.status(502).json({ message: e?.message || "Snapshot nicht verfügbar" });
    }
  });

  // Open door (relay)
  app.post("/api/doorbird/open/:relay", async (req, res) => {
    const relay = req.params.relay || "1";
    const creds = await getDoorBirdCreds();
    if (!creds) return res.status(400).json({ message: "DoorBird nicht konfiguriert" });
    try {
      const proxyRes = await doorBirdFetch(creds.ip, creds.user, creds.pass, `/bha-api/open-door.cgi?r=${relay}`);
      proxyRes.resume();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(502).json({ message: e?.message || "Tür konnte nicht geöffnet werden" });
    }
  });

  // Light on
  app.post("/api/doorbird/light", async (_req, res) => {
    const creds = await getDoorBirdCreds();
    if (!creds) return res.status(400).json({ message: "DoorBird nicht konfiguriert" });
    try {
      const proxyRes = await doorBirdFetch(creds.ip, creds.user, creds.pass, "/bha-api/light-on.cgi");
      proxyRes.resume();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(502).json({ message: e?.message });
    }
  });

  // Device info + ping
  app.get("/api/doorbird/info", async (_req, res) => {
    const creds = await getDoorBirdCreds();
    if (!creds) return res.json({ configured: false });
    try {
      const proxyRes = await doorBirdFetch(creds.ip, creds.user, creds.pass, "/bha-api/info.cgi", 5000);
      let data = "";
      proxyRes.on("data", (chunk) => (data += chunk));
      proxyRes.on("end", () => {
        try {
          const json = JSON.parse(data);
          res.json({ configured: true, reachable: true, info: json });
        } catch {
          res.json({ configured: true, reachable: true });
        }
      });
    } catch (e: any) {
      res.json({ configured: true, reachable: false, error: e?.message });
    }
  });

  // ─── Digitalstrom direkte API ──────────────────────────────────────────────────

  app.get("/api/dss/status", (_req, res) => {
    const data = getDssCache();
    res.json(data);
  });

  app.post("/api/dss/scene", async (req, res) => {
    const { zoneId, groupId, sceneId } = req.body;
    try {
      await dssCallScene(zoneId, groupId, sceneId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(502).json({ error: e?.message });
    }
  });

  app.post("/api/dss/device/output", async (req, res) => {
    const { dsuid, value } = req.body;
    try {
      await dssSetOutput(dsuid, value);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(502).json({ error: e?.message });
    }
  });

  // ─── Sonos API ────────────────────────────────────────────────────────────

  app.get("/api/sonos/zones", (_req, res) => {
    res.json(getSonosCache());
  });

  app.post("/api/sonos/discover", async (_req, res) => {
    const result = await discoverSonos();
    res.json(result);
  });

  app.post("/api/sonos/zones/:ip/play", async (req, res) => {
    try { await sonosPlay(req.params.ip); res.json({ ok: true }); }
    catch (e: any) { res.status(502).json({ error: e?.message }); }
  });

  app.post("/api/sonos/zones/:ip/pause", async (req, res) => {
    try { await sonosPause(req.params.ip); res.json({ ok: true }); }
    catch (e: any) { res.status(502).json({ error: e?.message }); }
  });

  app.post("/api/sonos/zones/:ip/next", async (req, res) => {
    try { await sonosNext(req.params.ip); res.json({ ok: true }); }
    catch (e: any) { res.status(502).json({ error: e?.message }); }
  });

  app.post("/api/sonos/zones/:ip/previous", async (req, res) => {
    try { await sonosPrevious(req.params.ip); res.json({ ok: true }); }
    catch (e: any) { res.status(502).json({ error: e?.message }); }
  });

  app.post("/api/sonos/zones/:ip/volume", async (req, res) => {
    const { volume } = req.body;
    if (volume === undefined) return res.status(400).json({ error: "volume erforderlich" });
    try { await sonosSetVolume(req.params.ip, parseInt(volume)); res.json({ ok: true }); }
    catch (e: any) { res.status(502).json({ error: e?.message }); }
  });

  app.post("/api/sonos/zones/:ip/mute", async (req, res) => {
    const { muted } = req.body;
    try { await sonosSetMute(req.params.ip, Boolean(muted)); res.json({ ok: true }); }
    catch (e: any) { res.status(502).json({ error: e?.message }); }
  });

  // ─── Vehicle APIs ────────────────────────────────────────────────────────────
  // Porsche Connect — cached vehicle data (polls every 5 minutes)
  app.get("/api/vehicles/porsche", async (_req, res) => {
    const creds = await storage.getApiCredential("porsche-connect");
    if (!creds) {
      return res.json({ configured: false, vehicles: [], error: null });
    }
    const { username, password } = JSON.parse(creds.credentials);
    if (!username || !password) {
      return res.json({ configured: false, vehicles: [], error: null });
    }
    const cache = await fetchPorscheData(username, password);
    res.json({ configured: true, vehicles: cache.data, lastFetch: cache.lastFetch, error: cache.error });
  });

  app.post("/api/vehicles/porsche/refresh", async (_req, res) => {
    const creds = await storage.getApiCredential("porsche-connect");
    if (!creds) return res.status(400).json({ error: "Keine Zugangsdaten konfiguriert" });
    const { username, password } = JSON.parse(creds.credentials);
    const cache = await fetchPorscheData(username, password, true);
    res.json({ configured: true, vehicles: cache.data, lastFetch: cache.lastFetch, error: cache.error });
  });

  // BMW/Mini Connected Drive
  app.get("/api/vehicles/bmw", async (_req, res) => {
    const creds = await storage.getApiCredential("bmw-connected");
    if (!creds) {
      return res.json({ configured: false, vehicles: [], error: null });
    }
    const { username, password, region } = JSON.parse(creds.credentials);
    if (!username || !password) {
      return res.json({ configured: false, vehicles: [], error: null });
    }
    const cache = await fetchBmwData(username, password, region || "rest_of_world");
    res.json({ configured: true, vehicles: cache.data, lastFetch: cache.lastFetch, error: cache.error });
  });

  app.post("/api/vehicles/bmw/refresh", async (_req, res) => {
    const creds = await storage.getApiCredential("bmw-connected");
    if (!creds) return res.status(400).json({ error: "Keine Zugangsdaten konfiguriert" });
    const { username, password, region } = JSON.parse(creds.credentials);
    const cache = await fetchBmwData(username, password, region || "rest_of_world", true);
    res.json({ configured: true, vehicles: cache.data, lastFetch: cache.lastFetch, error: cache.error });
  });

  // Settings
  app.get("/api/settings/:key", async (req, res) => {
    const value = await storage.getSetting(req.params.key);
    res.json({ key: req.params.key, value });
  });

  app.post("/api/settings", async (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ message: "Key erforderlich" });
    await storage.setSetting(key, value);
    res.json({ success: true });
  });

  return httpServer;
}
