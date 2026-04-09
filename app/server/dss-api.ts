/**
 * Digitalstrom Server (dSS) API Service
 * Communicates directly with the local dSS at 192.168.1.129:8080
 * No Supabase/cloud dependency needed — fully local.
 */

import http from "http";

// ─── Config ───────────────────────────────────────────────────────────────────

const DSS_HOST = "192.168.1.129";
const DSS_PORT = 8080;
const DSS_USER = "dssadmin";
const DSS_PASS = "brdss";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DssZone {
  id: number;
  name: string;
  temperature: number | null;
  humidity: number | null;
  consumptionW: number;
}

export interface DssDevice {
  dsuid: string;
  name: string;
  zoneId: number | null;
  isOn: boolean;
  outputValue: number;
  deviceType: string | null;
  meterDsuid: string | null;
}

export interface DssMeter {
  dsuid: string;
  name: string | null;
  consumptionW: number;
}

export interface DssStatus {
  reachable: boolean;
  version: string | null;
  lastChecked: Date;
  error: string | null;
  token: string | null;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface DssCache {
  token: string | null;
  tokenExpiry: Date | null;
  status: DssStatus;
  zones: DssZone[];
  devices: DssDevice[];
  meters: DssMeter[];
  lastPoll: Date | null;
}

const cache: DssCache = {
  token: null,
  tokenExpiry: null,
  status: { reachable: false, version: null, lastChecked: new Date(), error: null, token: null },
  zones: [],
  devices: [],
  meters: [],
  lastPoll: null,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function dssGet(path: string, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const tokenParam = cache.token ? `&token=${cache.token}` : "";
    const url = `http://${DSS_HOST}:${DSS_PORT}/json${path}${path.includes("?") ? "" : "?"}${tokenParam}`;

    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok === false) {
            reject(new Error(parsed.message || "dSS API Fehler"));
          } else {
            resolve(parsed.result ?? parsed);
          }
        } catch {
          reject(new Error("Ungültige JSON-Antwort vom dSS"));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("dSS Timeout")); });
  });
}

// ─── Authentication ───────────────────────────────────────────────────────────

async function authenticate(): Promise<string | null> {
  // Token still valid?
  if (cache.token && cache.tokenExpiry && cache.tokenExpiry > new Date()) {
    return cache.token;
  }

  try {
    const result = await new Promise<any>((resolve, reject) => {
      const url = `http://${DSS_HOST}:${DSS_PORT}/json/system/login?user=${encodeURIComponent(DSS_USER)}&password=${encodeURIComponent(DSS_PASS)}`;
      const req = http.get(url, { timeout: 8000 }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error("JSON parse error")); }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    });

    if (result.ok && result.result?.token) {
      cache.token = result.result.token;
      cache.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000); // 55 minutes
      return cache.token;
    }
    throw new Error(result.message || "Login fehlgeschlagen");
  } catch (e: any) {
    cache.status.error = `Login fehlgeschlagen: ${e?.message}`;
    cache.status.reachable = false;
    cache.token = null;
    return null;
  }
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchZones(): Promise<DssZone[]> {
  try {
    const result = await dssGet("/apartment/getZonesAndLastCalledScenes?token=" + cache.token);
    const zones: DssZone[] = [];

    for (const z of result?.zones || []) {
      if (z.id === 0) continue; // Skip broadcast zone

      let temp: number | null = null;
      let humidity: number | null = null;
      let consumptionW = 0;

      // Try to get sensor values for this zone
      try {
        const sensors = await dssGet(`/zone/getValues?id=${z.id}&token=${cache.token}`);
        for (const s of sensors?.values || []) {
          if (s.type === 9) temp = s.value;       // temperature
          if (s.type === 13) humidity = s.value;  // humidity
        }
      } catch { /* zone may have no sensors */ }

      zones.push({
        id: z.id,
        name: z.name || `Zone ${z.id}`,
        temperature: temp !== null ? Math.round(temp * 10) / 10 : null,
        humidity: humidity !== null ? Math.round(humidity) : null,
        consumptionW,
      });
    }
    return zones;
  } catch {
    return cache.zones; // return old data on error
  }
}

async function fetchDevices(): Promise<DssDevice[]> {
  try {
    const result = await dssGet(`/apartment/getDevices?token=${cache.token}`);
    return (result || []).map((d: any) => ({
      dsuid: d.id || d.dSUID,
      name: d.name || d.id,
      zoneId: d.zoneID ?? null,
      isOn: d.on === true || d.outputValue > 0,
      outputValue: d.outputValue ?? 0,
      deviceType: mapDeviceType(d.functionID),
      meterDsuid: d.meterDSUID ?? null,
    }));
  } catch {
    return cache.devices;
  }
}

async function fetchMeters(): Promise<DssMeter[]> {
  try {
    const result = await dssGet(`/metering/getLatest?dsid=.meters(all)&token=${cache.token}`);
    return (result?.values || []).map((m: any) => ({
      dsuid: m.dsid || m.meterID,
      name: m.name || null,
      consumptionW: m.value ?? 0,
    }));
  } catch {
    return cache.meters;
  }
}

function mapDeviceType(functionId: number): string {
  switch (functionId) {
    case 1: return "light";
    case 2: return "blind";
    case 3: return "heating";
    case 4: return "audio";
    case 7: return "joker";
    case 8: return "cooling";
    case 9: return "ventilation";
    default: return "unknown";
  }
}

// ─── Poll ─────────────────────────────────────────────────────────────────────

async function poll() {
  try {
    const token = await authenticate();
    if (!token) return;

    // Version check
    try {
      const info = await dssGet(`/system/version?token=${token}`);
      cache.status.version = info?.version || null;
      cache.status.reachable = true;
      cache.status.error = null;
    } catch { /* non-critical */ }

    // Fetch data in parallel
    const [zones, devices, meters] = await Promise.all([
      fetchZones(),
      fetchDevices(),
      fetchMeters(),
    ]);

    cache.zones = zones;
    cache.devices = devices;
    cache.meters = meters;
    cache.lastPoll = new Date();
    cache.status.lastChecked = new Date();
    cache.status.reachable = true;
  } catch (e: any) {
    cache.status.reachable = false;
    cache.status.error = e?.message || "Verbindungsfehler";
    cache.status.lastChecked = new Date();
    cache.token = null; // force re-auth
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getDssCache() {
  return {
    status: cache.status,
    zones: cache.zones,
    devices: cache.devices,
    meters: cache.meters,
    lastPoll: cache.lastPoll,
  };
}

export async function dssCallScene(zoneId: number, groupId: number, sceneId: number): Promise<void> {
  const token = await authenticate();
  if (!token) throw new Error("Nicht authentifiziert");
  await dssGet(`/zone/callScene?id=${zoneId}&groupID=${groupId}&sceneNr=${sceneId}&token=${token}`);
}

export async function dssSetOutput(deviceDsuid: string, value: number): Promise<void> {
  const token = await authenticate();
  if (!token) throw new Error("Nicht authentifiziert");
  await dssGet(`/device/setOutputValue?dsid=${deviceDsuid}&elementIndex=0&value=${value}&token=${token}`);
}

export async function startDssPoll() {
  await poll(); // immediate first poll
  if (!pollTimer) {
    pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  }
}

// Auto-start
startDssPoll();
