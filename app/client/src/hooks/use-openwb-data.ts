import { useState, useEffect, useRef, useCallback } from "react";

// ─── OpenWB MQTT Topics ──────────────────────────────────────────────────────
// OpenWB publishes live data via MQTT over WebSocket (port 9001)
// Topics: openWB/chargepoint/{id}/get/{value}

export interface WallboxData {
  id: number;
  name: string;
  ip: string;
  power: number;          // W — current charging power
  powerL1: number;        // W — L1
  powerL2: number;        // W — L2
  powerL3: number;        // W — L3
  current: number;        // A — charging current
  voltage: number;        // V — voltage
  plugState: boolean;     // vehicle plugged in
  chargeState: boolean;   // actively charging
  dailyImported: number;  // kWh — today
  totalImported: number;  // kWh — all time
  phasesInUse: number;    // 1 or 3
  soc: number | null;     // % — state of charge (if available)
  lastUpdate: Date | null;
}

export interface OpenWBStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  brokerIp: string;
}

const DEFAULT_WALLBOX: WallboxData = {
  id: 0,
  name: "",
  ip: "",
  power: 0,
  powerL1: 0,
  powerL2: 0,
  powerL3: 0,
  current: 0,
  voltage: 230,
  plugState: false,
  chargeState: false,
  dailyImported: 0,
  totalImported: 0,
  phasesInUse: 0,
  soc: null,
  lastUpdate: null,
};

const WALLBOX_CONFIG = [
  { id: 1, name: "Wallbox 1", ip: "192.168.1.55" },
  { id: 2, name: "Wallbox 2", ip: "192.168.1.56" },
];

// ─── useOpenWB ───────────────────────────────────────────────────────────────

export function useOpenWBData(brokerIp = "192.168.1.55") {
  const [wallboxes, setWallboxes] = useState<WallboxData[]>(
    WALLBOX_CONFIG.map((c) => ({
      ...DEFAULT_WALLBOX,
      id: c.id,
      name: c.name,
      ip: c.ip,
    }))
  );
  const [status, setStatus] = useState<OpenWBStatus>({
    connected: false,
    connecting: true,
    error: null,
    brokerIp,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const updateWallbox = useCallback((cpId: number, updates: Partial<WallboxData>) => {
    setWallboxes((prev) =>
      prev.map((wb) => (wb.id === cpId ? { ...wb, ...updates, lastUpdate: new Date() } : wb))
    );
  }, []);

  const parseMqttMessage = useCallback((topic: string, payload: string) => {
    // openWB/chargepoint/{id}/get/{key}
    const match = topic.match(/^openWB\/chargepoint\/(\d+)\/get\/(.+)$/);
    if (!match) return;

    const cpId = parseInt(match[1]);
    const key = match[2];
    const val = parseFloat(payload);

    switch (key) {
      case "power":
        updateWallbox(cpId, { power: isNaN(val) ? 0 : val });
        break;
      case "powers":
        // OpenWB 2.x: JSON array [L1, L2, L3]
        try {
          const arr = JSON.parse(payload);
          if (Array.isArray(arr) && arr.length >= 3) {
            updateWallbox(cpId, { powerL1: arr[0], powerL2: arr[1], powerL3: arr[2] });
          }
        } catch { /* ignore */ }
        break;
      case "current":
        updateWallbox(cpId, { current: isNaN(val) ? 0 : val });
        break;
      case "voltage":
        updateWallbox(cpId, { voltage: isNaN(val) ? 230 : val });
        break;
      case "plug_state":
        updateWallbox(cpId, { plugState: payload === "true" || payload === "1" });
        break;
      case "charge_state":
        updateWallbox(cpId, { chargeState: payload === "true" || payload === "1" });
        break;
      case "daily_imported":
        updateWallbox(cpId, { dailyImported: isNaN(val) ? 0 : val / 1000 }); // Wh → kWh
        break;
      case "imported":
        updateWallbox(cpId, { totalImported: isNaN(val) ? 0 : val / 1000 });
        break;
      case "phases_in_use":
        updateWallbox(cpId, { phasesInUse: isNaN(val) ? 0 : val });
        break;
      case "soc":
        updateWallbox(cpId, { soc: isNaN(val) ? null : val });
        break;
    }
  }, [updateWallbox]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // MQTT over WebSocket — OpenWB listens on port 9001
    const wsUrl = `ws://${brokerIp}:9001/mqtt`;

    setStatus((s) => ({ ...s, connecting: true, error: null }));

    try {
      const ws = new WebSocket(wsUrl, ["mqtt"]);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        // Send MQTT CONNECT packet
        const connectPacket = buildMqttConnect("buranto-intranet-" + Math.random().toString(36).slice(2, 8));
        ws.send(connectPacket);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        const data = event.data;

        // Parse raw MQTT packets
        if (data instanceof ArrayBuffer || data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            const buf = reader.result as ArrayBuffer;
            const view = new Uint8Array(buf);
            handleMqttPacket(view, ws, parseMqttMessage, setStatus);
          };
          reader.readAsArrayBuffer(data instanceof Blob ? data : new Blob([data]));
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setStatus((s) => ({ ...s, connected: false, connecting: false }));
        // Reconnect after 5 seconds
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setStatus((s) => ({
          ...s,
          connected: false,
          connecting: false,
          error: `Keine Verbindung zu ${brokerIp}:9001`,
        }));
      };
    } catch (e) {
      setStatus((s) => ({
        ...s,
        connected: false,
        connecting: false,
        error: `WebSocket Fehler: ${e}`,
      }));
    }
  }, [brokerIp, parseMqttMessage]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { wallboxes, status };
}

// ─── Raw MQTT Packet Handling ────────────────────────────────────────────────

function buildMqttConnect(clientId: string): ArrayBuffer {
  const encoder = new TextEncoder();
  const clientIdBytes = encoder.encode(clientId);

  // Protocol name: "MQTT" (v3.1.1)
  const protocolName = encoder.encode("MQTT");
  const payload = new Uint8Array([
    0, 4, ...protocolName,  // Protocol name with length prefix
    4,                       // Protocol level (3.1.1)
    0,                       // Connect flags (clean session=0, no will, no auth)
    0, 60,                   // Keep alive: 60 seconds
    0, clientIdBytes.length, // Client ID length
    ...clientIdBytes,
  ]);

  return new Uint8Array([0x10, payload.length, ...payload]).buffer;
}

function buildMqttSubscribe(topics: string[]): ArrayBuffer {
  const encoder = new TextEncoder();
  let payload: number[] = [
    0, 1, // Packet identifier
  ];
  for (const topic of topics) {
    const topicBytes = encoder.encode(topic);
    payload = [...payload, 0, topicBytes.length, ...topicBytes, 0]; // QoS 0
  }
  return new Uint8Array([0x82, payload.length, ...payload]).buffer;
}

function handleMqttPacket(
  view: Uint8Array,
  ws: WebSocket,
  onMessage: (topic: string, payload: string) => void,
  setStatus: (fn: (s: OpenWBStatus) => OpenWBStatus) => void
) {
  if (view.length < 2) return;

  const packetType = (view[0] >> 4) & 0x0f;

  switch (packetType) {
    case 2: { // CONNACK
      const returnCode = view[3];
      if (returnCode === 0) {
        setStatus((s) => ({ ...s, connected: true, connecting: false, error: null }));
        // Subscribe to all chargepoint topics
        const subPacket = buildMqttSubscribe([
          "openWB/chargepoint/+/get/#",
          "openWB/chargepoint/+/set/#",
        ]);
        ws.send(subPacket);
      } else {
        setStatus((s) => ({
          ...s,
          connected: false,
          connecting: false,
          error: `MQTT Verbindung abgelehnt (Code ${returnCode})`,
        }));
      }
      break;
    }
    case 3: { // PUBLISH
      // Parse topic and payload from PUBLISH packet
      try {
        let pos = 1;
        // Remaining length (variable-length encoding)
        let remainingLength = 0;
        let multiplier = 1;
        while (pos < view.length) {
          const byte = view[pos++];
          remainingLength += (byte & 0x7f) * multiplier;
          multiplier *= 128;
          if ((byte & 0x80) === 0) break;
        }
        // Topic length
        const topicLen = (view[pos] << 8) | view[pos + 1];
        pos += 2;
        const decoder = new TextDecoder();
        const topic = decoder.decode(view.slice(pos, pos + topicLen));
        pos += topicLen;
        const payload = decoder.decode(view.slice(pos));
        onMessage(topic, payload);
      } catch { /* ignore malformed packets */ }
      break;
    }
  }
}
