import { useState, useEffect, useRef, createContext, useContext, createElement, ReactNode } from "react";

// ─── Configuration ──────────────────────────────────────────────────────────
// Direct REST API calls to Supabase PostgREST — no @supabase/supabase-js needed.
// This avoids bundling the auth module which references localStorage/sessionStorage.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DsZone {
  id: number;
  name: string;
  temperature: number | null;
  humidity: number | null;
  consumption_w: number;
  updated_at: string;
}

export interface DsDevice {
  dsuid: string;
  name: string;
  zone_id: number | null;
  is_on: boolean;
  output_value: number;
  device_type: string | null;
  meter_dsuid: string | null;
  updated_at: string;
}

export interface DsMeter {
  dsuid: string;
  name: string | null;
  consumption_w: number;
  updated_at: string;
}

export interface DsSystemStatus {
  id: number;
  dss_reachable: boolean;
  last_poll_at: string | null;
  last_error: string | null;
  bridge_version: string;
  updated_at: string;
}

// ─── Supabase REST helper ───────────────────────────────────────────────────

async function supabaseGet<T>(table: string, query = ""): Promise<T> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Context ────────────────────────────────────────────────────────────────

interface DigitalstromContextValue {
  configured: boolean;
}

const DigitalstromContext = createContext<DigitalstromContextValue>({
  configured: false,
});

export function DigitalstromProvider({ children }: { children: ReactNode }) {
  const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  return createElement(
    DigitalstromContext.Provider,
    { value: { configured } },
    children
  );
}

export function useDigitalstromContext() {
  return useContext(DigitalstromContext);
}

// ─── Generic polling hook ───────────────────────────────────────────────────

function useSupabasePolling<T>(
  fetcher: () => Promise<T | null>,
  intervalMs = 30000
) {
  const { configured } = useDigitalstromContext();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      setError("Supabase nicht konfiguriert");
      return;
    }

    const poll = async () => {
      try {
        const result = await fetcher();
        setData(result);
        setError(null);
        setLastUpdate(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler");
      } finally {
        setLoading(false);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  return { data, loading, error, lastUpdate, configured };
}

// ─── useDigitalstromZones ───────────────────────────────────────────────────

export interface DsZonesResult {
  zones: DsZone[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  configured: boolean;
}

export function useDigitalstromZones(): DsZonesResult {
  const { data, loading, error, lastUpdate, configured } = useSupabasePolling<DsZone[]>(
    () => supabaseGet<DsZone[]>("ds_zones", "select=*&order=id.asc"),
    30000
  );
  return { zones: data || [], loading, error, lastUpdate, configured };
}

// ─── useDigitalstromDevices ─────────────────────────────────────────────────

export interface DsDevicesResult {
  devices: DsDevice[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  configured: boolean;
}

export function useDigitalstromDevices(): DsDevicesResult {
  const { data, loading, error, lastUpdate, configured } = useSupabasePolling<DsDevice[]>(
    () => supabaseGet<DsDevice[]>("ds_devices", "select=*&order=zone_id.asc"),
    30000
  );
  return { devices: data || [], loading, error, lastUpdate, configured };
}

// ─── useDigitalstromMeters ──────────────────────────────────────────────────

export interface DsMetersResult {
  meters: DsMeter[];
  totalConsumption: number;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  configured: boolean;
}

export function useDigitalstromMeters(): DsMetersResult {
  const { data, loading, error, lastUpdate, configured } = useSupabasePolling<DsMeter[]>(
    () => supabaseGet<DsMeter[]>("ds_meters", "select=*&order=consumption_w.desc"),
    30000
  );
  const meters = data || [];
  const totalConsumption = meters.reduce((sum, m) => sum + (m.consumption_w || 0), 0);
  return { meters, totalConsumption, loading, error, lastUpdate, configured };
}

// ─── useDigitalstromStatus ──────────────────────────────────────────────────

export interface DsStatusResult {
  status: DsSystemStatus | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
}

export function useDigitalstromStatus(): DsStatusResult {
  const { data, loading, error, configured } = useSupabasePolling<DsSystemStatus>(
    async () => {
      const rows = await supabaseGet<DsSystemStatus[]>("ds_system_status", "select=*&id=eq.1");
      return rows[0] || null;
    },
    30000
  );
  return { status: data, loading, error, configured };
}

// ─── Number formatting ──────────────────────────────────────────────────────

export function formatSwissDe(value: number, decimals = 0): string {
  return new Intl.NumberFormat("de-CH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
