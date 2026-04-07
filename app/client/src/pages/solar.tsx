import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Sun, Battery, ArrowUpFromLine, ArrowDownToLine, Gauge,
  RefreshCw, WifiOff, Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  useSolarStream,
  useSolarStats,
  useSolarForecast,
  formatSwiss,
  whToKwh,
} from "@/hooks/use-solar-data";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className ?? ""}`} />;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  color?: string;
  loading?: boolean;
  extra?: React.ReactNode;
}

function KpiCard({ icon: Icon, label, value, unit, color = "text-foreground", loading, extra }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-24 mt-1" />
        ) : (
          <div className={`text-2xl font-semibold tabular-nums ${color}`}>
            {value}
            {unit && <span className="text-sm ml-1 font-normal text-muted-foreground">{unit}</span>}
          </div>
        )}
        {extra}
      </CardContent>
    </Card>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Erneut versuchen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${color ?? ""}`}>{value}</span>
    </div>
  );
}

// ─── Forecast Chart ───────────────────────────────────────────────────────────

function ForecastChart() {
  const { forecast, loading, error } = useSolarForecast();

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error || forecast.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        Keine Vorhersagedaten verfügbar
      </div>
    );
  }

  // Filter to today + next 24h
  const now = Date.now();
  const next24h = now + 24 * 60 * 60 * 1000;
  const data = forecast
    .filter((p) => p.timestamp >= now - 3600000 && p.timestamp <= next24h)
    .map((p) => ({
      time: new Date(p.timestamp).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }),
      erwartet: Math.round(p.expected),
      min: Math.round(p.min),
      max: Math.round(p.max),
    }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 20%)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10 }}
            stroke="hsl(215, 12%, 50%)"
            interval={Math.floor(data.length / 6)}
          />
          <YAxis tick={{ fontSize: 10 }} stroke="hsl(215, 12%, 50%)" unit=" W" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(215, 25%, 12%)",
              border: "1px solid hsl(215, 20%, 20%)",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = { erwartet: "Erwartet", min: "Min", max: "Max" };
              return [`${formatSwiss(value)} W`, labels[name] ?? name];
            }}
          />
          <Area
            type="monotone"
            dataKey="max"
            stroke="hsl(142, 71%, 45%)"
            fill="hsl(142, 71%, 45%)"
            fillOpacity={0.08}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <Area
            type="monotone"
            dataKey="erwartet"
            stroke="hsl(142, 71%, 45%)"
            fill="hsl(142, 71%, 45%)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="min"
            stroke="hsl(44, 76%, 46%)"
            fill="transparent"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-4 justify-center mt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-green-400" />
          Prognose
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          Min / Max
        </div>
      </div>
    </div>
  );
}

// ─── Heute Tab ────────────────────────────────────────────────────────────────

function HeuteTab() {
  const { stats, loading: statsLoading, error: statsError } = useSolarStats("day");

  return (
    <div className="space-y-4">
      {/* Forecast chart */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Solarprognose — nächste 24 Stunden</CardTitle>
        </CardHeader>
        <CardContent>
          <ForecastChart />
        </CardContent>
      </Card>

      {/* Daily stats */}
      {statsError ? (
        <ErrorState message="Tagesstatistiken nicht verfügbar" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Heute erzeugt</div>
              {statsLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <div className="text-lg font-semibold tabular-nums">
                  {stats ? whToKwh(stats.production) : "—"} <span className="text-sm text-muted-foreground">kWh</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Heute verbraucht</div>
              {statsLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <div className="text-lg font-semibold tabular-nums">
                  {stats ? whToKwh(stats.consumption) : "—"} <span className="text-sm text-muted-foreground">kWh</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Eigenverbrauchsrate</div>
              {statsLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <div className="text-lg font-semibold tabular-nums text-green-400">
                  {stats ? formatSwiss(stats.selfConsumptionRate, 1) : "—"}
                  <span className="text-sm ml-0.5">%</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Autarkiegrad</div>
              {statsLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <div className="text-lg font-semibold tabular-nums text-green-400">
                  {stats ? formatSwiss(stats.autarchyDegree, 1) : "—"}
                  <span className="text-sm ml-0.5">%</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Woche / Monat Tab ────────────────────────────────────────────────────────

function PeriodTab({ accuracy, label }: { accuracy: "month" | "year"; label: string }) {
  const { stats, loading, error } = useSolarStats(accuracy);

  if (error) return <ErrorState message={`${label}sstatistiken nicht verfügbar`} />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {(
        [
          { key: "production", label: "Erzeugt", unit: "kWh", color: "text-green-400", isWh: true },
          { key: "consumption", label: "Verbraucht", unit: "kWh", color: "text-amber-400", isWh: true },
          { key: "selfConsumption", label: "Eigenverbrauch", unit: "kWh", color: undefined, isWh: true },
          { key: "selfConsumptionRate", label: "Eigenverbrauchsrate", unit: "%", color: "text-green-400", isWh: false },
          { key: "autarchyDegree", label: "Autarkiegrad", unit: "%", color: "text-green-400", isWh: false },
        ] as const
      ).map((item) => (
        <Card key={item.key}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
            {loading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <div className={`text-lg font-semibold tabular-nums ${item.color ?? ""}`}>
                {stats
                  ? item.isWh
                    ? whToKwh(stats[item.key])
                    : formatSwiss(stats[item.key], 1)
                  : "—"}{" "}
                <span className="text-sm text-muted-foreground">{item.unit}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Solar() {
  const { data, loading, error, lastUpdate } = useSolarStream();

  const gridPower = data?.currentGridPower ?? 0;
  const isEinspeisung = gridPower < 0;
  const gridLabel = isEinspeisung ? "Einspeisung" : "Netzbezug";
  const GridIcon = isEinspeisung ? ArrowUpFromLine : ArrowDownToLine;
  const gridColor = isEinspeisung ? "text-emerald-400" : "text-orange-400";

  const soc = data?.soc ?? 0;
  const batteryCharge = data?.currentBatteryChargeDischarge ?? 0;
  const batteryLabel =
    batteryCharge > 50 ? "Lädt" : batteryCharge < -50 ? "Entlädt" : "Standby";

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Solar Manager</h1>
          <p className="text-sm text-muted-foreground">Solaranlage 13.2 kWp — Sissach</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md tabular-nums">
              Letzte Aktualisierung:{" "}
              {lastUpdate.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <Badge
            variant="secondary"
            className={error ? "text-red-400 border-red-400/20" : "text-green-400 border-green-400/20"}
          >
            {error ? (
              <><WifiOff className="h-3 w-3 mr-1" /> Keine Verbindung</>
            ) : (
              <><Sun className="h-3 w-3 mr-1" /> Aktiv</>
            )}
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      {error ? (
        <ErrorState message="Verbindung zum Solar Manager unterbrochen. Bitte Netzverbindung prüfen." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={Sun}
            label="Produktion"
            value={data ? formatSwiss(data.currentPvGeneration) : "—"}
            unit="W"
            color="text-green-400"
            loading={loading}
          />
          <KpiCard
            icon={Gauge}
            label="Verbrauch"
            value={data ? formatSwiss(data.currentPowerConsumption) : "—"}
            unit="W"
            color="text-amber-400"
            loading={loading}
          />
          <KpiCard
            icon={Battery}
            label="Batterie"
            value={data ? `${soc}` : "—"}
            unit="%"
            color="text-blue-400"
            loading={loading}
            extra={
              !loading && data ? (
                <>
                  <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${soc}%` }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">{batteryLabel}</div>
                </>
              ) : null
            }
          />
          <KpiCard
            icon={GridIcon}
            label={gridLabel}
            value={data ? formatSwiss(Math.abs(gridPower)) : "—"}
            unit="W"
            color={gridColor}
            loading={loading}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="today" className="space-y-4">
        <TabsList>
          <TabsTrigger value="today">Heute</TabsTrigger>
          <TabsTrigger value="week">Woche</TabsTrigger>
          <TabsTrigger value="month">Monat</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          <HeuteTab />
        </TabsContent>

        <TabsContent value="week">
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Aktueller Monat</h2>
            <PeriodTab accuracy="month" label="Monat" />
          </div>
        </TabsContent>

        <TabsContent value="month">
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Aktuelles Jahr</h2>
            <PeriodTab accuracy="year" label="Jahr" />
          </div>
        </TabsContent>
      </Tabs>

      {/* Battery Details */}
      {!loading && data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Battery className="h-4 w-4 text-blue-400" />
              Batterie Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatRow label="Ladezustand (SOC)" value={`${soc} %`} color="text-blue-400" />
            <StatRow
              label="Ladeleistung"
              value={batteryCharge > 0 ? `+${formatSwiss(batteryCharge)} W` : `${formatSwiss(batteryCharge)} W`}
              color={batteryCharge > 50 ? "text-green-400" : batteryCharge < -50 ? "text-orange-400" : undefined}
            />
            <StatRow label="Status" value={batteryLabel} />
          </CardContent>
        </Card>
      )}

      {/* Energy Flow */}
      {!loading && data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              Energiefluss
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatRow label="PV Produktion" value={`${formatSwiss(data.currentPvGeneration)} W`} color="text-green-400" />
            <StatRow label="Hausverbrauch" value={`${formatSwiss(data.currentPowerConsumption)} W`} color="text-amber-400" />
            <StatRow
              label={isEinspeisung ? "Netzeinspeisung" : "Netzbezug"}
              value={`${formatSwiss(Math.abs(gridPower))} W`}
              color={gridColor}
            />
            <StatRow
              label="Batterie"
              value={batteryCharge > 0 ? `Lädt ${formatSwiss(batteryCharge)} W` : batteryCharge < 0 ? `Entlädt ${formatSwiss(Math.abs(batteryCharge))} W` : "Standby"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
