import { useState, useEffect, useRef, useCallback } from "react";

// ─── Configuration ──────────────────────────────────────────────────────────
// Dahua NVR/DVR accessible via server-side proxy to avoid mixed-content blocks.
// The Express server proxies requests from /api/dahua/* to the NVR on the LAN.
//
// Direct URLs (for reference / Web-Interface link):
//   Snapshot: http://192.168.1.218/cgi-bin/snapshot.cgi?channel=<n>
//   MJPEG:    http://192.168.1.218/cgi-bin/mjpg/video.cgi?channel=<n>&subtype=1
//   Info:     http://192.168.1.218/cgi-bin/magicBox.cgi?action=getSystemInfo

const DAHUA_IP = "192.168.1.218";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DahuaChannel {
  channel: number;
  name: string;
}

export interface DahuaSystemInfo {
  deviceType?: string;
  serialNumber?: string;
  hardwareVersion?: string;
  softwareVersion?: string;
  channelCount?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Snapshot URL via server-side proxy — avoids HTTPS→HTTP mixed content */
export function getSnapshotUrl(channel: number): string {
  return `/api/dahua/snapshot/${channel}`;
}

/** MJPEG stream URL — still direct (only works on HTTP page or same-origin) */
export function getMjpegStreamUrl(channel: number, subtype = 1): string {
  return `/api/dahua/snapshot/${channel}`; // fallback to snapshot proxy
}

/** RTSP URL for a given channel (for external players, not browser) */
export function getRtspUrl(channel: number, subtype = 1): string {
  return `rtsp://Brandt:Video@Brandt667@${DAHUA_IP}:554/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
}

/** Web interface URL */
export function getWebInterfaceUrl(): string {
  return `http://${DAHUA_IP}`;
}

export function getDahuaIp(): string {
  return DAHUA_IP;
}

// ─── useSnapshotRefresh ─────────────────────────────────────────────────────
// Periodically refreshes a snapshot URL by appending a cache-buster.

export function useSnapshotRefresh(channel: number, intervalMs = 5000) {
  const [url, setUrl] = useState(() => getSnapshotUrl(channel) + `?t=${Date.now()}`);
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    setUrl(getSnapshotUrl(channel) + `?t=${Date.now()}`);
    setError(false);
  }, [channel]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [channel, intervalMs, refresh]);

  const onError = useCallback(() => setError(true), []);
  const onLoad = useCallback(() => setError(false), []);

  return { url, error, onError, onLoad, refresh };
}

// ─── useDahuaChannels ───────────────────────────────────────────────────────
// Provides channel list with sensible defaults.

const DEFAULT_CHANNELS: DahuaChannel[] = [
  { channel: 1, name: "Kanal 1" },
  { channel: 2, name: "Kanal 2" },
  { channel: 3, name: "Kanal 3" },
  { channel: 4, name: "Kanal 4" },
  { channel: 5, name: "Kanal 5" },
  { channel: 6, name: "Kanal 6" },
  { channel: 7, name: "Kanal 7" },
  { channel: 8, name: "Kanal 8" },
];

export function useDahuaChannels(): {
  channels: DahuaChannel[];
  loading: boolean;
} {
  return { channels: DEFAULT_CHANNELS, loading: false };
}

// ─── Connection test ────────────────────────────────────────────────────────
// Uses the server-side /api/dahua/ping endpoint instead of direct browser request.

export function useDahuaConnectionTest(): {
  reachable: boolean | null;
  loading: boolean;
  testConnection: () => void;
} {
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const testConnection = useCallback(() => {
    setLoading(true);
    fetch("/api/dahua/ping")
      .then((res) => res.json())
      .then((data) => {
        setReachable(data.reachable === true);
        setLoading(false);
      })
      .catch(() => {
        setReachable(false);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    testConnection();
  }, [testConnection]);

  return { reachable, loading, testConnection };
}
