import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Sun, Zap, Battery, ArrowUpFromLine, ArrowDownToLine,
  Home, Car, CalendarDays, FolderOpen, Settings, Video,
  WifiOff, TrendingUp, TrendingDown, Activity, Gauge,
  BarChart3, CircleDot, Plug,
} from "lucide-react";
import {
  useSolarStream, useSolarStats, useSolarRangeData,
  useSolarConsumptionPeriod, useSolarMonthlyStats,
  formatSwiss, whToKwh,
} from "@/hooks/use-solar-data";
import {
  useDigitalstromMeters, useDigitalstromStatus, useDigitalstromContext,
  useDigitalstromZones,
} from "@/hooks/use-digitalstrom-data";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Line, ComposedChart,
} from "recharts";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className ?? ""}`} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(): string {
  return new Date().toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(): string {
  return new Date().toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${online ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" : "bg-red-400"}`}
    />
  );
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({
  value,
  max = 100,
  size = 80,
  strokeWidth = 7,
  color = "#FFE600",
  label,
  sublabel,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
  sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(215, 20%, 18%)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="text-center -mt-[calc(50%+10px)] mb-4">
        <div className="text-lg font-bold tabular-nums">{label}</div>
        {sublabel && <div className="text-[10px] text-muted-foreground">{sublabel}</div>}
      </div>
    </div>
  );
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────

function HBar({
  label,
  value,
  max,
  color,
  suffix = "",
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {formatSwiss(Math.round(value))}{suffix}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Quick links ──────────────────────────────────────────────────────────────

const quickLinks = [
  { title: "Solar Manager", href: "/solar", icon: Sun, color: "text-green-400" },
  { title: "Digitalstrom", href: "/digitalstrom", icon: Home, color: "text-blue-400" },
  { title: "Strom", href: "/strom", icon: Zap, color: "text-amber-400" },
  { title: "Videoanlage", href: "/videoanlage", icon: Video, color: "text-red-400" },
  { title: "Fahrzeuge", href: "/fahrzeuge", icon: Car, color: "text-purple-400" },
  { title: "Termine", href: "/termine", icon: CalendarDays, color: "text-pink-400" },
  { title: "Dokumente", href: "/dokumente", icon: FolderOpen, color: "text-cyan-400" },
  { title: "Einstellungen", href: "/einstellungen", icon: Settings, color: "text-zinc-400" },
];

// ─── Tooltip style shared ─────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(215, 25%, 12%)",
  border: "1px solid hsl(215, 20%, 20%)",
  borderRadius: "6px",
  fontSize: "12px",
  color: "#fff",
};

const AXIS_TICK_STYLE = { fill: "hsl(215, 12%, 50%)", fontSize: 11 };
const GRID_COLOR = "hsl(215, 20%, 20%)";

// ═════════════════════════════════════════════════════════════════════════════
// Chart 1: Tagesverlauf — Area Chart (Heute / Letzte 7 Tage)
// ═════════════════════════════════════════════════════════════════════════════

function TagesverlaufChart() {
  const [tab, setTab] = useState<"heute" | "woche">("heute");

  const now = new Date();

  // Heute: midnight → now
  const todayFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
  const todayTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  // Letzte 7 Tage
  const weekTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  const weekFrom7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0).toISOString();

  const { data: todayData, loading: todayLoading } = useSolarRangeData(todayFrom, todayTo, 300);
  const { data: weekData, loading: weekLoading } = useSolarRangeData(weekFrom7, weekTo, 3600);

  const activeData = tab === "heute" ? todayData : weekData;
  const loading = tab === "heute" ? todayLoading : weekLoading;

  // Format x-axis labels
  const chartData = activeData.map((pt) => {
    const d = new Date(pt.t);
    const label =
      tab === "heute"
        ? d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
    return {
      label,
      verbrauch: +(pt.cW / 1000).toFixed(3),
      produktion: +(pt.pW / 1000).toFixed(3),
      einspeisung: +(Math.max(pt.pW - pt.cW, 0) / 1000).toFixed(3),
      soc: pt.soc,
    };
  });

  // Thin the x-axis ticks for readability
  const tickInterval = tab === "heute" ? 11 : Math.max(1, Math.floor(chartData.length / 12));

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#FFE600]" />
            Energieverlauf
          </CardTitle>
          <div className="flex gap-1">
            <button
              onClick={() => setTab("heute")}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                tab === "heute"
                  ? "bg-[#FFE600] text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Heute
            </button>
            <button
              onClick={() => setTab("woche")}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                tab === "woche"
                  ? "bg-[#FFE600] text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Letzte 7 Tage
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            Keine Daten verfügbar
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK_STYLE}
                interval={tickInterval}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={AXIS_TICK_STYLE}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v} kW`}
                width={54}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={AXIS_TICK_STYLE}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                width={40}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number, name: string) => {
                  if (name === "soc") return [`${value} %`, "Batterie SoC"];
                  return [`${value.toFixed(2)} kW`, name];
                }}
                labelStyle={{ color: "hsl(215, 12%, 70%)", marginBottom: 4 }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="verbrauch"
                name="Verbrauch"
                stackId="1"
                stroke="#67B7DC"
                fill="#67B7DC"
                fillOpacity={0.4}
                strokeWidth={1.5}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="produktion"
                name="Solarproduktion"
                stackId="2"
                stroke="#FFE600"
                fill="#FFE600"
                fillOpacity={0.35}
                strokeWidth={1.5}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="einspeisung"
                name="Einspeisung"
                stackId="3"
                stroke="#B8F400"
                fill="#B8F400"
                fillOpacity={0.2}
                strokeWidth={1}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="soc"
                name="soc"
                stroke="#FFFFFF"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        <div className="flex items-center gap-5 mt-2 flex-wrap">
          {[
            { color: "#67B7DC", label: "Verbrauch" },
            { color: "#FFE600", label: "Solarproduktion" },
            { color: "#B8F400", label: "Einspeisung" },
            { color: "#FFFFFF", label: "Batterie SoC", dashed: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block w-5 h-0.5"
                style={{
                  backgroundColor: item.color,
                  borderTop: item.dashed ? "2px dashed " + item.color : undefined,
                  background: item.dashed ? "none" : item.color,
                }}
              />
              {item.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Chart 2: Autarkie & Eigenverbrauch — Donut Rings (2×2 grid)
// ═════════════════════════════════════════════════════════════════════════════

function DonutRing({
  value,
  size = 110,
  strokeWidth = 10,
  color,
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  sublabel: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(value, 0), 100) / 100;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(215, 20%, 18%)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.7s ease" }}
          />
        </svg>
        {/* Centered text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ transform: "rotate(0deg)" }}
        >
          <span className="text-xl font-bold tabular-nums text-white">
            {value.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-medium text-white">{label}</div>
        <div className="text-[10px] text-muted-foreground">{sublabel}</div>
      </div>
    </div>
  );
}

function AutarkieRinge() {
  const { stats: statsMonth, loading: loadingMonth } = useSolarStats("month");
  const { stats: statsYear, loading: loadingYear } = useSolarStats("year");

  const autarkie30 = statsMonth?.autarchyDegree ?? 0;
  const autarkieYear = statsYear?.autarchyDegree ?? 0;
  const eigenverbrauch30 = statsMonth?.selfConsumptionRate ?? 0;
  const eigenverbrauchYear = statsYear?.selfConsumptionRate ?? 0;

  const loading = loadingMonth || loadingYear;

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CircleDot className="h-4 w-4 text-[#FFE600]" />
          Autarkie &amp; Eigenverbrauch
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="w-[110px] h-[110px] rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Autarkie 30d */}
            <DonutRing
              value={autarkie30}
              color="#00C8FF"
              label="Autarkie"
              sublabel="30 Tage"
            />
            {/* Autarkie 365d */}
            <DonutRing
              value={autarkieYear}
              color="#00C8FF"
              label="Autarkie"
              sublabel="365 Tage"
            />
            {/* Eigenverbrauch 30d */}
            <DonutRing
              value={eigenverbrauch30}
              color="#FFE600"
              label="Eigenverbrauch"
              sublabel="30 Tage"
            />
            {/* Eigenverbrauch 365d */}
            <DonutRing
              value={eigenverbrauchYear}
              color="#FFE600"
              label="Eigenverbrauch"
              sublabel="365 Tage"
            />
          </div>
        )}
        {/* Totals row */}
        {!loading && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Produktion (Monat)</div>
              <div className="text-sm font-semibold text-[#FFE600] tabular-nums">
                {whToKwh(statsMonth?.production ?? 0)} kWh
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Produktion (Jahr)</div>
              <div className="text-sm font-semibold text-[#FFE600] tabular-nums">
                {whToKwh(statsYear?.production ?? 0)} kWh
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Verbrauch (Monat)</div>
              <div className="text-sm font-semibold text-[#67B7DC] tabular-nums">
                {whToKwh(statsMonth?.consumption ?? 0)} kWh
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Verbrauch (Jahr)</div>
              <div className="text-sm font-semibold text-[#67B7DC] tabular-nums">
                {whToKwh(statsYear?.consumption ?? 0)} kWh
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Chart 3: Monatsübersicht — Daily grouped bar chart
// ═════════════════════════════════════════════════════════════════════════════

function MonatsuebersichtChart() {
  const { data, loading } = useSolarConsumptionPeriod("month");

  const chartData = data.map((d) => {
    const date = new Date(d.createdAt);
    const day = date.getDate().toString().padStart(2, "0");
    const prodKwh = +(d.production / 1000).toFixed(2);
    const consKwh = +(d.consumption / 1000).toFixed(2);
    const einsKwh = +(Math.max(d.production - d.consumption, 0) / 1000).toFixed(2);
    return { tag: day, Verbrauch: consKwh, Produktion: prodKwh, Einspeisung: einsKwh };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#FFE600]" />
            Monatsübersicht
          </CardTitle>
          <Badge variant="secondary" className="text-[10px]">Monat</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
            Keine Daten verfügbar
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="tag"
                tick={AXIS_TICK_STYLE}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis
                tick={AXIS_TICK_STYLE}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}`}
                width={36}
                unit=" kWh"
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number, name: string) => [`${v.toFixed(2)} kWh`, name]}
                labelStyle={{ color: "hsl(215, 12%, 70%)", marginBottom: 4 }}
                labelFormatter={(label) => `Tag ${label}`}
              />
              <Bar dataKey="Verbrauch" fill="#F56565" radius={[2, 2, 0, 0]} maxBarSize={8} />
              <Bar dataKey="Produktion" fill="#FFE600" radius={[2, 2, 0, 0]} maxBarSize={8} />
              <Bar dataKey="Einspeisung" fill="#48BB78" radius={[2, 2, 0, 0]} maxBarSize={8} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {[
            { color: "#F56565", label: "Verbrauch" },
            { color: "#FFE600", label: "Produktion" },
            { color: "#48BB78", label: "Einspeisung" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Chart 4: Jahresproduktion — Monthly grouped bars, multi-year
// ═════════════════════════════════════════════════════════════════════════════

const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const YEAR_COLORS: Record<number, string> = {
  2023: "#F56565",
  2024: "#B794F4",
  2025: "#ED8936",
  2026: "#4FD1C5",
};

function JahresproduktionChart() {
  const { months: months2024, loading: l2024 } = useSolarMonthlyStats(2024);
  const { months: months2025, loading: l2025 } = useSolarMonthlyStats(2025);
  const { months: months2026, loading: l2026 } = useSolarMonthlyStats(2026);

  const loading = l2024 || l2025 || l2026;

  // Build chart data: 12 months, each with 2024/2025/2026 production in kWh
  const chartData = MONTH_LABELS.map((monat, i) => {
    const m = i + 1;
    const find = (arr: typeof months2024) => arr.find((pt) => pt.month === m)?.production ?? 0;
    return {
      monat,
      "2024": +(find(months2024) / 1000).toFixed(2),
      "2025": +(find(months2025) / 1000).toFixed(2),
      "2026": +(find(months2026) / 1000).toFixed(2),
    };
  });

  const years = [2024, 2025, 2026];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#FFE600]" />
          Produktion — Jahresvergleich
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="monat"
                tick={AXIS_TICK_STYLE}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={AXIS_TICK_STYLE}
                axisLine={false}
                tickLine={false}
                width={42}
                tickFormatter={(v) =>
                  v >= 1000
                    ? formatSwiss(v, 0)
                    : String(v)
                }
                unit=" kWh"
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number, name: string) => [`${formatSwiss(v, 2)} kWh`, name]}
                labelStyle={{ color: "hsl(215, 12%, 70%)", marginBottom: 4 }}
              />
              {years.map((year) => (
                <Bar
                  key={year}
                  dataKey={String(year)}
                  name={String(year)}
                  fill={YEAR_COLORS[year]}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={12}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
        {/* Year legend */}
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {years.map((year) => (
            <div key={year} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: YEAR_COLORS[year] }}
              />
              {year}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Energie-Fluss card  —  the hero visualization
// ═════════════════════════════════════════════════════════════════════════════

function EnergieFluss() {
  const { data, loading, error } = useSolarStream();
  const { configured } = useDigitalstromContext();
  const { totalConsumption: dsTotalW, loading: dsLoading } = useDigitalstromMeters();
  const { status: dsStatus } = useDigitalstromStatus();

  if (error) {
    return (
      <Card className="col-span-full">
        <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
          <WifiOff className="h-5 w-5" />
          <span className="text-sm">Keine Verbindung zum Solar Manager</span>
        </CardContent>
      </Card>
    );
  }

  const pv = data?.currentPvGeneration ?? 0;
  const consumption = data?.currentPowerConsumption ?? 0;
  const grid = data?.currentGridPower ?? 0;
  const batt = data?.currentBatteryChargeDischarge ?? 0;
  const soc = data?.soc ?? 0;
  const isEinspeisung = grid < 0;
  const dsOnline = configured && dsStatus?.dss_reachable;
  const dsW = configured && !dsLoading ? dsTotalW : 0;

  // max for bars — use whichever is larger between pv and consumption
  const barMax = Math.max(pv, consumption, 1);

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#FFE600]" />
            Energie-Fluss — Live
          </CardTitle>
          <Badge variant="secondary" className="text-[10px] gap-1">
            <StatusDot online={!error} />
            {loading ? "Verbinde..." : formatTime()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Top row: 4 big KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Solar */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sun className="h-3.5 w-3.5 text-green-400" />
              Solarproduktion
            </div>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tabular-nums text-green-400">
                  {formatSwiss(pv)}
                </span>
                <span className="text-sm text-muted-foreground">W</span>
              </div>
            )}
          </div>

          {/* Verbrauch */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Verbrauch
            </div>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tabular-nums text-amber-400">
                  {formatSwiss(consumption)}
                </span>
                <span className="text-sm text-muted-foreground">W</span>
              </div>
            )}
          </div>

          {/* Netz */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isEinspeisung ? (
                <ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <ArrowDownToLine className="h-3.5 w-3.5 text-orange-400" />
              )}
              {isEinspeisung ? "Einspeisung" : "Netzbezug"}
            </div>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold tabular-nums ${isEinspeisung ? "text-emerald-400" : "text-orange-400"}`}>
                  {formatSwiss(Math.abs(grid))}
                </span>
                <span className="text-sm text-muted-foreground">W</span>
              </div>
            )}
          </div>

          {/* Batterie */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Battery className="h-3.5 w-3.5 text-blue-400" />
              Batterie
            </div>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tabular-nums text-blue-400">
                  {soc}
                </span>
                <span className="text-sm text-muted-foreground">%</span>
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {batt > 50 ? "Lädt" : batt < -50 ? "Entlädt" : "Standby"}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Visual bars */}
        {!loading && (
          <div className="space-y-2 pt-2 border-t">
            <HBar label="Solarproduktion" value={pv} max={barMax} color="#4ade80" suffix=" W" />
            <HBar label="Gesamtverbrauch" value={consumption} max={barMax} color="#fbbf24" suffix=" W" />
            {dsOnline && dsW > 0 && (
              <HBar label="Digitalstrom" value={dsW} max={barMax} color="#60a5fa" suffix=" W" />
            )}
            <HBar label="Batterieladung" value={soc} max={100} color="#3b82f6" suffix="%" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tagesstatistik — kWh, Autarkie, Eigenverbrauch
// ═════════════════════════════════════════════════════════════════════════════

function Tagesstatistik() {
  const { stats, loading, error } = useSolarStats("day");

  const production = stats?.production ?? 0;
  const consumption = stats?.consumption ?? 0;
  const selfConsumption = stats?.selfConsumption ?? 0;
  const autarky = stats?.autarchyDegree ?? 0;
  const selfRate = stats?.selfConsumptionRate ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#FFE600]" />
          Heute
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <WifiOff className="h-4 w-4" />
            <span>Keine Daten</span>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <ProgressRing
                  value={autarky}
                  color="#4ade80"
                  label={`${autarky.toFixed(0)}%`}
                  sublabel="Autarkie"
                />
              </div>
              <div className="text-center">
                <ProgressRing
                  value={selfRate}
                  color="#FFE600"
                  label={`${selfRate.toFixed(0)}%`}
                  sublabel="Eigenverbrauch"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Sun className="h-3 w-3 text-green-400" />
                  Erzeugt
                </span>
                <span className="font-semibold tabular-nums text-green-400">
                  {whToKwh(production)} kWh
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-amber-400" />
                  Verbraucht
                </span>
                <span className="font-semibold tabular-nums text-amber-400">
                  {whToKwh(consumption)} kWh
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CircleDot className="h-3 w-3 text-[#FFE600]" />
                  Eigenverbrauch
                </span>
                <span className="font-semibold tabular-nums">
                  {whToKwh(selfConsumption)} kWh
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Monats- und Jahresstatistik
// ═════════════════════════════════════════════════════════════════════════════

function PeriodStats({
  period,
  icon: Icon,
  title,
}: {
  period: "month" | "year";
  icon: typeof TrendingUp;
  title: string;
}) {
  const { stats, loading, error } = useSolarStats(period);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#FFE600]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <WifiOff className="h-4 w-4" />
            <span>Keine Daten</span>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Erzeugt</span>
              <span className="font-semibold tabular-nums text-green-400">
                {whToKwh(stats?.production ?? 0)} kWh
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Verbraucht</span>
              <span className="font-semibold tabular-nums text-amber-400">
                {whToKwh(stats?.consumption ?? 0)} kWh
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Eigenverbrauch</span>
              <span className="font-semibold tabular-nums">
                {whToKwh(stats?.selfConsumption ?? 0)} kWh
              </span>
            </div>
            <div className="pt-2 border-t flex justify-between text-sm">
              <span className="text-muted-foreground">Autarkie</span>
              <Badge variant="secondary" className="tabular-nums">
                {(stats?.autarchyDegree ?? 0).toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Eigenverbrauchsrate</span>
              <Badge variant="secondary" className="tabular-nums">
                {(stats?.selfConsumptionRate ?? 0).toFixed(1)}%
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Digitalstrom Status card
// ═════════════════════════════════════════════════════════════════════════════

function DigitalstromKarte() {
  const { configured } = useDigitalstromContext();
  const { zones, loading: zonesLoading } = useDigitalstromZones();
  const { totalConsumption, meters, loading: metersLoading } = useDigitalstromMeters();
  const { status } = useDigitalstromStatus();

  if (!configured) return null;

  const online = status?.dss_reachable ?? false;
  const zonesWithTemp = zones.filter((z) => z.temperature !== null && z.temperature > 0);
  const activeDeviceZones = zones.filter((z) => z.consumption_w > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Home className="h-4 w-4 text-blue-400" />
            Digitalstrom
          </CardTitle>
          <Badge variant="secondary" className="text-[10px] gap-1">
            <StatusDot online={online} />
            {online ? "Online" : "Offline"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {metersLoading || zonesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <>
            {/* Total power */}
            <div className="flex items-baseline gap-2">
              <Plug className="h-4 w-4 text-blue-400" />
              <span className="text-2xl font-bold tabular-nums">
                {formatSwiss(Math.round(totalConsumption))}
              </span>
              <span className="text-sm text-muted-foreground">W gesamt</span>
            </div>

            {/* Meters breakdown */}
            {meters.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Stromkreise</div>
                {meters.slice(0, 5).map((m) => (
                  <div key={m.dsuid} className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate mr-2">
                      {m.name || m.dsuid.slice(0, 12)}
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatSwiss(Math.round(m.consumption_w))} W
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Temperatures */}
            {zonesWithTemp.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Temperaturen</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {zonesWithTemp.slice(0, 6).map((z) => (
                    <div key={z.id} className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate mr-2">{z.name}</span>
                      <span className="tabular-nums font-medium">{z.temperature?.toFixed(1)}°</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active zones */}
            {activeDeviceZones.length > 0 && (
              <div className="pt-2 border-t text-xs text-muted-foreground">
                {activeDeviceZones.length} Zone{activeDeviceZones.length !== 1 ? "n" : ""} aktiv
                {" · "}{zones.length} Zonen total
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Systemstatus
// ═════════════════════════════════════════════════════════════════════════════

function Systemstatus() {
  const { data: solarData } = useSolarStream();
  const { status: dsStatus } = useDigitalstromStatus();
  const { configured: dsConfigured } = useDigitalstromContext();

  const systems = [
    {
      name: "Solar Manager",
      online: !!solarData,
      detail: solarData ? `SoC ${solarData.soc}%` : "Keine Verbindung",
    },
    ...(dsConfigured
      ? [
          {
            name: "Digitalstrom Bridge",
            online: !!dsStatus?.dss_reachable,
            detail: dsStatus?.dss_reachable
              ? `v${dsStatus.bridge_version}`
              : dsStatus?.last_error || "Offline",
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[#FFE600]" />
          Systemstatus
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {systems.map((sys) => (
          <div key={sys.name} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              <StatusDot online={sys.online} />
              <span className="text-sm">{sys.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{sys.detail}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Dashboard
// ═════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  return (
    <div className="p-4 md:p-6 space-y-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{formatDate()} — Sissach, BL</p>
        </div>
      </div>

      {/* Hero: Energie-Fluss */}
      <EnergieFluss />

      {/* Stats row: Heute / Monat / Jahr */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Tagesstatistik />
        <PeriodStats period="month" icon={TrendingUp} title="Dieser Monat" />
        <PeriodStats period="year" icon={TrendingDown} title="Dieses Jahr" />
      </div>

      {/* Chart 1: Energieverlauf — full width area chart */}
      <TagesverlaufChart />

      {/* Chart 2: Autarkie & Eigenverbrauch Ringe — full width */}
      <AutarkieRinge />

      {/* Charts 3 & 4: Monatsübersicht + Jahresproduktion side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonatsuebersichtChart />
        <JahresproduktionChart />
      </div>

      {/* Secondary row: Digitalstrom + System */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DigitalstromKarte />
        <Systemstatus />
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Schnellzugriff
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
                  <link.icon className={`h-5 w-5 ${link.color}`} />
                  <span className="text-xs font-medium">{link.title}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
