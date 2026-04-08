/**
 * Sonos API Service
 * Auto-discovers Sonos devices via subnet scan (no SSDP multicast needed)
 * Controls zones: play/pause/next/prev/volume/group info
 */

import net from "net";
import http from "http";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SonosTrack {
  title: string;
  artist: string;
  album: string;
  albumArtUri: string;
  duration: number;      // seconds
  position: number;      // seconds
}

export interface SonosZone {
  id: string;
  name: string;
  ip: string;
  state: "playing" | "paused" | "stopped" | "transitioning" | "unknown";
  volume: number;        // 0-100
  muted: boolean;
  track: SonosTrack | null;
  groupMembers: string[]; // IPs of grouped speakers
  isCoordinator: boolean;
  lastUpdated: Date;
}

export interface SonosCache {
  zones: SonosZone[];
  discovered: string[];  // IPs of found Sonos devices
  lastScan: Date | null;
  lastPoll: Date | null;
  scanning: boolean;
  error: string | null;
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

const cache: SonosCache = {
  zones: [],
  discovered: [],
  lastScan: null,
  lastPoll: null,
  scanning: false,
  error: null,
};

const POLL_INTERVAL_MS = 3000;
const SCAN_TIMEOUT_MS = 600;
const SUBNET = "192.168.1";

let pollTimer: ReturnType<typeof setInterval> | null = null;

// ─── Subnet scanner ───────────────────────────────────────────────────────────

async function checkPort(ip: string, port: number, timeout = SCAN_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port, timeout });
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
  });
}

async function scanSubnet(): Promise<string[]> {
  const promises: Promise<string | null>[] = [];
  for (let i = 1; i <= 254; i++) {
    const ip = `${SUBNET}.${i}`;
    promises.push(
      checkPort(ip, 1400).then((open) => (open ? ip : null))
    );
  }
  const results = await Promise.all(promises);
  const found = results.filter(Boolean) as string[];

  // Verify it's actually a Sonos device
  const sonosDevices: string[] = [];
  for (const ip of found) {
    const isSonos = await verifySonos(ip);
    if (isSonos) sonosDevices.push(ip);
  }
  return sonosDevices;
}

function verifySonos(ip: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      `http://${ip}:1400/xml/device_description.xml`,
      { timeout: 1000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve(data.includes("Sonos") || data.includes("urn:schemas-upnp-org:device:ZonePlayer"));
        });
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

// ─── Sonos HTTP API calls ─────────────────────────────────────────────────────

function sonosRequest(ip: string, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${ip}:1400${path}`, { timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function sonosSoapRequest(ip: string, service: string, action: string, body: string): Promise<string> {
  const soapBody = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>${body}</s:Body>
</s:Envelope>`;

  return new Promise((resolve, reject) => {
    const path = `/MediaRenderer/${service}/Control`;
    const options = {
      hostname: ip,
      port: 1400,
      path,
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"urn:schemas-upnp-org:service:${service}:1#${action}"`,
        "Content-Length": Buffer.byteLength(soapBody),
      },
      timeout: 3000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.write(soapBody);
    req.end();
  });
}

function extractXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

// ─── Get zone info ────────────────────────────────────────────────────────────

async function getZoneInfo(ip: string): Promise<Partial<SonosZone>> {
  try {
    // Zone attributes
    const attrXml = await sonosRequest(ip, "/xml/zone_attributes.xml").catch(() => "");
    const roomName = extractXml(attrXml, "CurrentZoneName") || ip;

    // Current transport state
    const transportBody = `<u:GetTransportInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:GetTransportInfo>`;
    const transportXml = await sonosSoapRequest(ip, "AVTransport", "GetTransportInfo", transportBody).catch(() => "");
    const stateStr = extractXml(transportXml, "CurrentTransportState").toLowerCase();
    const state = (["playing", "paused_playback", "stopped", "transitioning"].includes(stateStr)
      ? stateStr.replace("paused_playback", "paused")
      : "unknown") as SonosZone["state"];

    // Volume
    const volBody = `<u:GetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetVolume>`;
    const volXml = await sonosSoapRequest(ip, "RenderingControl", "GetVolume", volBody).catch(() => "");
    const volume = parseInt(extractXml(volXml, "CurrentVolume")) || 0;

    // Mute
    const muteBody = `<u:GetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetMute>`;
    const muteXml = await sonosSoapRequest(ip, "RenderingControl", "GetMute", muteBody).catch(() => "");
    const muted = extractXml(muteXml, "CurrentMute") === "1";

    // Current track
    const trackBody = `<u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:GetPositionInfo>`;
    const trackXml = await sonosSoapRequest(ip, "AVTransport", "GetPositionInfo", trackBody).catch(() => "");

    let track: SonosTrack | null = null;
    const trackMeta = extractXml(trackXml, "TrackMetaData");
    if (trackMeta && trackMeta !== "NOT_IMPLEMENTED") {
      const title = decodeXml(extractXml(trackMeta, "dc:title") || extractXml(trackMeta, "title"));
      const artist = decodeXml(extractXml(trackMeta, "dc:creator") || extractXml(trackMeta, "artist"));
      const album = decodeXml(extractXml(trackMeta, "upnp:album") || extractXml(trackMeta, "album"));
      let albumArtUri = extractXml(trackMeta, "upnp:albumArtURI") || extractXml(trackMeta, "albumArtURI");

      // Make album art URL absolute
      if (albumArtUri && albumArtUri.startsWith("/")) {
        albumArtUri = `http://${ip}:1400${albumArtUri}`;
      }

      const durStr = extractXml(trackXml, "TrackDuration");
      const posStr = extractXml(trackXml, "RelTime");

      track = {
        title: title || "Unbekannter Titel",
        artist: artist || "Unbekannter Künstler",
        album: album || "",
        albumArtUri,
        duration: parseTimeToSeconds(durStr),
        position: parseTimeToSeconds(posStr),
      };
    }

    // Group members (via topology)
    const topoXml = await sonosRequest(ip, "/status/topology").catch(() => "");
    const groupMembers = parseGroupMembers(topoXml, ip);
    const isCoordinator = groupMembers[0] === ip || groupMembers.length === 0;

    return {
      ip,
      name: roomName,
      state: state as SonosZone["state"],
      volume,
      muted,
      track,
      groupMembers,
      isCoordinator,
      lastUpdated: new Date(),
    };
  } catch (e) {
    return { ip, name: ip, state: "unknown", volume: 0, muted: false, track: null, groupMembers: [], isCoordinator: true, lastUpdated: new Date() };
  }
}

function parseTimeToSeconds(time: string): number {
  if (!time) return 0;
  const parts = time.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function decodeXml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseGroupMembers(topoXml: string, currentIp: string): string[] {
  // Find the group containing this device
  const zoneMatches = [...topoXml.matchAll(/location="http:\/\/([^:]+):1400/g)];
  if (zoneMatches.length === 0) return [currentIp];

  // Simple: find the group that contains our IP
  const groups = topoXml.match(/<ZoneGroup [^>]*Coordinator="[^"]*"[^>]*>[\s\S]*?<\/ZoneGroup>/g) || [];
  for (const group of groups) {
    if (group.includes(currentIp)) {
      const members = [...group.matchAll(/location="http:\/\/([^:]+):1400/g)].map((m) => m[1]);
      // Coordinator is first
      const coordMatch = group.match(/Coordinator="([^"]+)"/);
      const coordIp = coordMatch ? coordMatch[1] : currentIp;
      return [coordIp, ...members.filter((m) => m !== coordIp)];
    }
  }
  return [currentIp];
}

// ─── Control functions ────────────────────────────────────────────────────────

async function sendTransportCommand(ip: string, command: string): Promise<void> {
  const body = `<u:${command} xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:${command}>`;
  await sonosSoapRequest(ip, "AVTransport", command, body);
}

export async function sonosPlay(ip: string): Promise<void> {
  await sendTransportCommand(ip, "Play");
}

export async function sonosPause(ip: string): Promise<void> {
  await sendTransportCommand(ip, "Pause");
}

export async function sonosNext(ip: string): Promise<void> {
  await sendTransportCommand(ip, "Next");
}

export async function sonosPrevious(ip: string): Promise<void> {
  await sendTransportCommand(ip, "Previous");
}

export async function sonosSetVolume(ip: string, volume: number): Promise<void> {
  const vol = Math.max(0, Math.min(100, volume));
  const body = `<u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>${vol}</DesiredVolume></u:SetVolume>`;
  await sonosSoapRequest(ip, "RenderingControl", "SetVolume", body);
}

export async function sonosSetMute(ip: string, muted: boolean): Promise<void> {
  const body = `<u:SetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredMute>${muted ? 1 : 0}</DesiredMute></u:SetMute>`;
  await sonosSoapRequest(ip, "RenderingControl", "SetMute", body);
}

// ─── Discovery & polling ──────────────────────────────────────────────────────

export async function discoverSonos(): Promise<SonosCache> {
  if (cache.scanning) return cache;

  cache.scanning = true;
  cache.error = null;

  try {
    const ips = await scanSubnet();
    cache.discovered = ips;
    cache.lastScan = new Date();

    if (ips.length === 0) {
      cache.error = `Keine Sonos-Geräte im Subnetz ${SUBNET}.x gefunden`;
    } else {
      await pollZones();
      startPolling();
    }
  } catch (e: any) {
    cache.error = e?.message || "Fehler bei der Entdeckung";
  } finally {
    cache.scanning = false;
  }

  return cache;
}

async function pollZones(): Promise<void> {
  if (cache.discovered.length === 0) return;

  const zones = await Promise.all(
    cache.discovered.map(async (ip) => {
      const info = await getZoneInfo(ip);
      const existing = cache.zones.find((z) => z.ip === ip);
      return {
        id: ip,
        name: info.name || existing?.name || ip,
        ip,
        state: info.state || "unknown",
        volume: info.volume ?? existing?.volume ?? 0,
        muted: info.muted ?? existing?.muted ?? false,
        track: info.track !== undefined ? info.track : (existing?.track || null),
        groupMembers: info.groupMembers || [],
        isCoordinator: info.isCoordinator ?? true,
        lastUpdated: info.lastUpdated || new Date(),
      } as SonosZone;
    })
  );

  cache.zones = zones;
  cache.lastPoll = new Date();
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(pollZones, POLL_INTERVAL_MS);
}

export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function getSonosCache(): SonosCache {
  return cache;
}

// Auto-start discovery on import
discoverSonos();
