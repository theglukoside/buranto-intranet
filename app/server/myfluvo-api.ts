/**
 * Myfluvo Pool Gateway API
 * Gateway: http://192.168.1.144
 *
 * The gateway uses simple HTTP GET with query params to control devices.
 * Current state is read by parsing the HTML response of each page.
 *
 * Pages:
 *  - /LightDMX.html         — LED/DMX lighting
 *  - /SteuerkastenNT.html   — Control box (pool circuits)
 *  - /Frequenzumrichter.html — VFD pump controller
 *  - /LuchsNT.html          — Luchs NT pump
 *  - /Wandlerbox.html       — GSA converter
 */

import http from "http";

// ─── Config ───────────────────────────────────────────────────────────────────

const GATEWAY_IP = "192.168.1.144";
const GATEWAY_PORT = 80;
const REQUEST_TIMEOUT = 6000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PoolLightState {
  on: boolean;
  brightness: number | null;   // 25 | 50 | 75 | 100
  scene: number | null;         // 3=Weiss, 7=Farbverlauf, 8-13=Szene 1-6
  dmxChannels?: DmxChannel[];
}

export interface DmxChannel {
  id: number;
  color: string;
  duration: number;
  brightness: number;
}

export interface PoolControlState {
  on: boolean;
  freigegeben: boolean;
}

export interface PoolStatus {
  light: PoolLightState;
  control: PoolControlState;
  lastUpdated: Date;
  error: string | null;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let cachedStatus: PoolStatus = {
  light: { on: false, brightness: null, scene: null },
  control: { on: false, freigegeben: false },
  lastUpdated: new Date(0),
  error: null,
};

const CACHE_TTL_MS = 5000; // 5 seconds
let pollTimer: ReturnType<typeof setInterval> | null = null;

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function gatewayGet(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `http://${GATEWAY_IP}:${GATEWAY_PORT}${path}`;
    const req = http.get(url, { timeout: REQUEST_TIMEOUT }, (res) => {
      let data = "";
      res.setEncoding("latin1"); // Gateway may use ISO-8859-1
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Gateway Timeout")); });
  });
}

// ─── HTML Parsers ─────────────────────────────────────────────────────────────

function parseRadioChecked(html: string, name: string): string | null {
  // Find: input ... name="<name>" value="<v>" checked
  const re = new RegExp(
    `<input[^>]+name="${name}"[^>]+value="([^"]*)"[^>]*checked`,
    "i"
  );
  const m = html.match(re);
  if (m) return m[1];
  // Also try: value="<v>" ... name="<name>" ... checked (different attribute order)
  const re2 = new RegExp(
    `<input[^>]+value="([^"]*)"[^>]+name="${name}"[^>]*checked`,
    "i"
  );
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

function parseInputValue(html: string, name: string): string | null {
  const re = new RegExp(`<input[^>]+name="${name}"[^>]+value="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? m[1] : null;
}

function isLightOn(html: string): boolean {
  // Look for: name="ilo" value="1" checked (ON) vs value="0" checked (OFF)
  const val = parseRadioChecked(html, "ilo");
  return val === "1";
}

function parseBrightness(html: string): number | null {
  // Brightness buttons: ?dwd=25, ?dwd=50, ?dwd=75, ?dwd=100
  // Try to find active/selected button by checking URL context
  // Fallback: look for selected class or active state
  // Check the page for dwd value in a hidden input or selected button
  const match = html.match(/dwd=(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function parseScene(html: string): number | null {
  // setcolor=3 (Weiss), 7 (Farbverlauf), 8-13 (Szene 1-6)
  const match = html.match(/setcolor=(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function isControlOn(html: string): boolean {
  // Look for: ?sst=0 (AUS button active / currently off means button to turn off is shown)
  // Or check button styles - "SetButtoH" = highlighted/active state
  // The "AUS" button with class SetButtoH means it's currently OFF
  // The "EIN" button with class SetButtoH means it's currently ON
  const einActive = /SetButtoH[^>]*>EIN/i.test(html) || /href='[^']*sst=0'/i.test(html);
  return einActive;
}

// ─── Status fetcher ───────────────────────────────────────────────────────────

export async function fetchPoolStatus(force = false): Promise<PoolStatus> {
  const now = new Date();
  if (!force && now.getTime() - cachedStatus.lastUpdated.getTime() < CACHE_TTL_MS) {
    return cachedStatus;
  }

  try {
    const [lightHtml, controlHtml] = await Promise.all([
      gatewayGet("/LightDMX.html"),
      gatewayGet("/SteuerkastenNT.html"),
    ]);

    cachedStatus = {
      light: {
        on: isLightOn(lightHtml),
        brightness: parseBrightness(lightHtml),
        scene: parseScene(lightHtml),
      },
      control: {
        on: isControlOn(controlHtml),
        freigegeben: /settoggle=1/i.test(controlHtml),
      },
      lastUpdated: now,
      error: null,
    };
  } catch (e: any) {
    cachedStatus = {
      ...cachedStatus,
      lastUpdated: now,
      error: e?.message || "Gateway nicht erreichbar",
    };
  }

  return cachedStatus;
}

// ─── Command sender ───────────────────────────────────────────────────────────

export async function sendPoolCommand(page: string, params: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const path = `/${page}?${params}`;
    await gatewayGet(path);
    // Force refresh status after command
    setTimeout(() => fetchPoolStatus(true), 500);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Befehl fehlgeschlagen" };
  }
}

export function getPoolCache(): PoolStatus {
  return cachedStatus;
}

// ─── Auto-poll ────────────────────────────────────────────────────────────────

export function startPoolPoll() {
  fetchPoolStatus(true); // immediate
  if (!pollTimer) {
    pollTimer = setInterval(() => fetchPoolStatus(true), 10_000); // every 10s
  }
}

startPoolPoll();
