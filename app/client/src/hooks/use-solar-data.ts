import { createContext, useContext, useState, useEffect, useRef, ReactNode, createElement } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = "https://cloud.solar-manager.ch";
const DEFAULT_SM_ID = "0B3E21D7615C436E";
const DEFAULT_AUTH = btoa("dbrandt70@icloud.com:Sissach4450");

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SolarStreamData {
  "Interface Version": number;
  TimeStamp: string;
  intervalSecs: number;
  currentBatteryChargeDischarge: number;
  currentGridPower: number;
  currentPowerConsumption: number;
  currentPvGeneration: number;
  soc: number;
  devices: SolarDevice[];
}

export interface SolarDevice {
  _id: string;
  currentPowerInvSm?: number;
  currentPower?: number;
  soc?: number;
  activeDevice?: number;
  currentPercentOn?: number;
  targetPower?: number;
  [key: string]: unknown;
}

export interface SolarStats {
  consumption: number;
  production: number;
  selfConsumption: number;
  selfConsumptionRate: number;
  autarchyDegree: number;
}

export interface ForecastPoint {
  timestamp: number;
  expected: number;
  min: number;
  max: number;
}

export interface GatewayInfo {
  _id?: string;
  sm_id?: string;
  firmwareVersion?: string;
  ip?: string;
  lastUpdate?: string;
  [key: string]: unknown;
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface SolarContextValue {
  smId: string;
  authToken: string;
}

const SolarContext = createContext<SolarContextValue>({
  smId: DEFAULT_SM_ID,
  authToken: DEFAULT_AUTH,
});

export function SolarProvider({ children }: { children: ReactNode }) {
  const [smId] = useState(DEFAULT_SM_ID);
  const [authToken] = useState(DEFAULT_AUTH);

  return createElement(SolarContext.Provider, { value: { smId, authToken } }, children);
}

export function useSolarContext() {
  return useContext(SolarContext);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Basic ${token}` };
}

// ─── useSolarStream ───────────────────────────────────────────────────────────

export interface SolarStreamResult {
  data: SolarStreamData | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

export function useSolarStream(): SolarStreamResult {
  const { smId, authToken } = useSolarContext();
  const [data, setData] = useState<SolarStreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`${BASE_URL}/v1/stream/gateway/${smId}`, {
        headers: authHeaders(authToken),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SolarStreamData = await res.json();
      setData(json);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError("Keine Verbindung");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smId, authToken]);

  return { data, loading, error, lastUpdate };
}

// ─── useSolarStats ────────────────────────────────────────────────────────────

export interface SolarStatsResult {
  stats: SolarStats | null;
  loading: boolean;
  error: string | null;
}

export function useSolarStats(accuracy: "day" | "month" | "year"): SolarStatsResult {
  const { smId, authToken } = useSolarContext();
  const [stats, setStats] = useState<SolarStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    let from: Date;
    let to: Date;

    if (accuracy === "day") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (accuracy === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    const url = `${BASE_URL}/v1/statistics/gateways/${smId}?accuracy=${accuracy}&from=${from.toISOString()}&to=${to.toISOString()}`;

    setLoading(true);
    fetch(url, { headers: authHeaders(authToken) })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: SolarStats) => {
        setStats(json);
        setError(null);
      })
      .catch(() => {
        setError("Keine Verbindung");
      })
      .finally(() => setLoading(false));
  }, [smId, authToken, accuracy]);

  return { stats, loading, error };
}

// ─── useSolarForecast ─────────────────────────────────────────────────────────

export interface SolarForecastResult {
  forecast: ForecastPoint[];
  loading: boolean;
  error: string | null;
}

export function useSolarForecast(): SolarForecastResult {
  const { smId, authToken } = useSolarContext();
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/v1/forecast/gateways/${smId}`, {
      headers: authHeaders(authToken),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: ForecastPoint[]) => {
        setForecast(Array.isArray(json) ? json : []);
        setError(null);
      })
      .catch(() => {
        setError("Keine Verbindung");
      })
      .finally(() => setLoading(false));
  }, [smId, authToken]);

  return { forecast, loading, error };
}

// ─── useSolarGatewayInfo ──────────────────────────────────────────────────────

export interface SolarGatewayInfoResult {
  info: GatewayInfo | null;
  loading: boolean;
  error: string | null;
}

export function useSolarGatewayInfo(): SolarGatewayInfoResult {
  const { smId, authToken } = useSolarContext();
  const [info, setInfo] = useState<GatewayInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/v1/info/gateway/${smId}`, {
      headers: authHeaders(authToken),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: GatewayInfo) => {
        setInfo(json);
        setError(null);
      })
      .catch(() => {
        setError("Keine Verbindung");
      })
      .finally(() => setLoading(false));
  }, [smId, authToken]);

  return { info, loading, error };
}

// ─── useSolarRangeData ────────────────────────────────────────────────────────
// Fetches time-series data for a given date range (hourly intervals).
// Used for the daily area chart (kW over time) and monthly bar chart.

export interface RangeDataPoint {
  t: string;           // ISO timestamp
  pW: number;          // production W (average)
  pWh: number;         // production Wh
  cW: number;          // consumption W (average)
  cWh: number;         // consumption Wh
  bcW: number;         // battery charge W
  bcWh: number;        // battery charge Wh
  bdW: number;         // battery discharge W
  bdWh: number;        // battery discharge Wh
  soc: number;         // battery %
  eWh: number;         // export (Einspeisung) Wh
  iWh: number;         // import (Netzbezug) Wh
  scWh: number;        // self-consumption Wh
}

export interface RangeDataResult {
  data: RangeDataPoint[];
  loading: boolean;
  error: string | null;
}

export function useSolarRangeData(
  from: string,
  to: string,
  interval: 300 | 900 | 3600 = 3600
): RangeDataResult {
  const { smId, authToken } = useSolarContext();
  const [data, setData] = useState<RangeDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!from || !to) return;
    setLoading(true);
    const url = `${BASE_URL}/v3/users/${smId}/data/range?from=${from}&to=${to}&interval=${interval}`;
    fetch(url, { headers: authHeaders(authToken) })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json.data || []);
        setError(null);
      })
      .catch(() => setError("Keine Verbindung"))
      .finally(() => setLoading(false));
  }, [smId, authToken, from, to, interval]);

  return { data, loading, error };
}

// ─── useSolarConsumptionPeriod ────────────────────────────────────────────────
// Daily breakdown of consumption/production for day|week|month.

export interface ConsumptionDay {
  createdAt: string;
  consumption: number;  // Wh
  production: number;   // Wh
}

export interface ConsumptionPeriodResult {
  data: ConsumptionDay[];
  totalConsumption: number;
  totalProduction: number;
  loading: boolean;
  error: string | null;
}

export function useSolarConsumptionPeriod(
  period: "day" | "week" | "month" = "month"
): ConsumptionPeriodResult {
  const { smId, authToken } = useSolarContext();
  const [data, setData] = useState<ConsumptionDay[]>([]);
  const [totalConsumption, setTotalConsumption] = useState(0);
  const [totalProduction, setTotalProduction] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE_URL}/v1/consumption/gateway/${smId}?period=${period}`, {
      headers: authHeaders(authToken),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json.data || []);
        setTotalConsumption(json.totalConsumption || 0);
        setTotalProduction(json.totalProduction || 0);
        setError(null);
      })
      .catch(() => setError("Keine Verbindung"))
      .finally(() => setLoading(false));
  }, [smId, authToken, period]);

  return { data, totalConsumption, totalProduction, loading, error };
}

// ─── useSolarMonthlyStats ─────────────────────────────────────────────────────
// Fetches per-month production statistics for a given year.

export interface MonthlyStatPoint {
  month: number;        // 1-12
  production: number;   // Wh
  consumption: number;  // Wh
  autarchyDegree: number;
  selfConsumptionRate: number;
}

export interface MonthlyStatsResult {
  months: MonthlyStatPoint[];
  loading: boolean;
  error: string | null;
}

export function useSolarMonthlyStats(year: number): MonthlyStatsResult {
  const { smId, authToken } = useSolarContext();
  const [months, setMonths] = useState<MonthlyStatPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based
    const maxMonth = year === currentYear ? currentMonth : 12;

    const promises = Array.from({ length: maxMonth }, (_, i) => {
      const m = i + 1;
      const from = `${year}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`;
      const to =
        m === 12
          ? `${year}-12-31T23:59:59.000Z`
          : `${year}-${String(m + 1).padStart(2, "0")}-01T00:00:00.000Z`;
      return fetch(
        `${BASE_URL}/v1/statistics/gateways/${smId}?accuracy=low&from=${from}&to=${to}`,
        { headers: authHeaders(authToken) }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) =>
          d
            ? {
                month: m,
                production: d.production || 0,
                consumption: d.consumption || 0,
                autarchyDegree: d.autarchyDegree || 0,
                selfConsumptionRate: d.selfConsumptionRate || 0,
              }
            : { month: m, production: 0, consumption: 0, autarchyDegree: 0, selfConsumptionRate: 0 }
        );
    });

    Promise.all(promises)
      .then((results) => {
        setMonths(results);
        setError(null);
      })
      .catch(() => setError("Keine Verbindung"))
      .finally(() => setLoading(false));
  }, [smId, authToken, year]);

  return { months, loading, error };
}

// ─── Number formatting ────────────────────────────────────────────────────────

/** Swiss-style: 12'053 */
export function formatSwiss(value: number, decimals = 0): string {
  return new Intl.NumberFormat("de-CH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Format Wh → kWh with 1 decimal */
export function whToKwh(wh: number): string {
  return formatSwiss(wh / 1000, 1);
}
