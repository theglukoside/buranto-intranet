import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
// Matching server/dss-api.ts types

export interface DsZone {
  id: number;
  name: string;
  temperature: number | null;
  humidity: number | null;
  consumptionW: number;
  // Legacy Supabase compat fields
  consumption_w?: number;
  updated_at?: string;
}

export interface DsDevice {
  dsuid: string;
  name: string;
  zoneId: number | null;
  isOn: boolean;
  outputValue: number;
  deviceType: string | null;
  meterDsuid: string | null;
  // Legacy compat
  zone_id?: number | null;
  is_on?: boolean;
  output_value?: number;
  device_type?: string | null;
  meter_dsuid?: string | null;
  updated_at?: string;
}

export interface DsMeter {
  dsuid: string;
  name: string | null;
  consumptionW: number;
  consumption_w?: number;
  updated_at?: string;
}

export interface DsSystemStatus {
  reachable: boolean;
  version: string | null;
  lastChecked: string;
  error: string | null;
  token?: string | null;
  // Legacy compat
  dss_reachable?: boolean;
  last_error?: string | null;
  bridge_version?: string;
}

interface DssApiResponse {
  status: DsSystemStatus;
  zones: DsZone[];
  devices: DsDevice[];
  meters: DssMeter[];
  lastPoll: string | null;
}

// ─── Local API fetcher ────────────────────────────────────────────────────────

async function fetchDss(): Promise<DssApiResponse> {
  const res = await fetch("/api/dss/status");
  if (!res.ok) throw new Error("dSS API nicht erreichbar");
  return res.json();
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDigitalstromStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/dss/status"],
    queryFn: fetchDss,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const status = data?.status;
  const configured = true; // Always configured — credentials are hardcoded in server

  return {
    status: status
      ? {
          id: 1,
          dss_reachable: status.reachable,
          last_poll_at: data?.lastPoll || null,
          last_error: status.error || null,
          bridge_version: status.version || "local",
          updated_at: status.lastChecked,
        }
      : null,
    loading: isLoading,
    configured,
    reachable: status?.reachable ?? false,
    error: status?.error ?? null,
  };
}

export function useDigitalstromZones() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/dss/status"],
    queryFn: fetchDss,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  // Normalize to legacy format for existing page component
  const zones: DsZone[] = (data?.zones || []).map((z) => ({
    ...z,
    consumption_w: z.consumptionW,
    updated_at: data?.lastPoll || new Date().toISOString(),
  }));

  return { zones, loading: isLoading };
}

export function useDigitalstromDevices() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/dss/status"],
    queryFn: fetchDss,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const devices: DsDevice[] = (data?.devices || []).map((d) => ({
    ...d,
    zone_id: d.zoneId,
    is_on: d.isOn,
    output_value: d.outputValue,
    device_type: d.deviceType,
    meter_dsuid: d.meterDsuid,
    updated_at: data?.lastPoll || new Date().toISOString(),
  }));

  return { devices, loading: isLoading };
}

export function useDigitalstromMeters() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/dss/status"],
    queryFn: fetchDss,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const meters: DsMeter[] = (data?.meters || []).map((m) => ({
    ...m,
    consumption_w: m.consumptionW,
    updated_at: data?.lastPoll || new Date().toISOString(),
  }));

  return { meters, loading: isLoading };
}

// ─── Formatters ──────────────────────────────────────────────────────────────

export function formatSwissDe(value: number, unit: string, decimals = 1): string {
  return value.toLocaleString("de-CH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + " " + unit;
}

// ─── Control ─────────────────────────────────────────────────────────────────

export async function callScene(zoneId: number, groupId: number, sceneId: number): Promise<void> {
  await fetch("/api/dss/scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zoneId, groupId, sceneId }),
  });
}

export async function setDeviceOutput(dsuid: string, value: number): Promise<void> {
  await fetch("/api/dss/device/output", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dsuid, value }),
  });
}

// Keep legacy type alias
export type DssMeter = DsMeter;

// Legacy context hook — credentials now hardcoded server-side, always configured
export function useDigitalstromContext() {
  const { reachable, error } = useDigitalstromStatus();
  return {
    configured: true,
    reachable,
    error,
  };
}

// Legacy Provider — just renders children (no context needed anymore)
export function DigitalstromProvider({ children }: { children: ReactNode }) {
  return children as any;
}
