import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb, Blinds, Thermometer, Zap, Home, Droplets,
  Flame, Wind, Fan, Monitor, Wifi, WifiOff, RefreshCw,
  Activity, Server, ChevronRight,
} from "lucide-react";
import {
  useDigitalstromZones,
  useDigitalstromDevices,
  useDigitalstromMeters,
  useDigitalstromStatus,
  formatSwissDe,
  type DsZone,
  type DsDevice,
} from "@/hooks/use-digitalstrom-data";

// ─── Device type icons ──────────────────────────────────────────────────────

const DEVICE_ICON: Record<string, React.ElementType> = {
  light: Lightbulb,
  blind: Blinds,
  heating: Flame,
  cooling: Wind,
  ventilation: Fan,
  window: Monitor,
  audio: Monitor,
  video: Monitor,
  joker: Zap,
  unknown: Zap,
};

function deviceIcon(type: string | null): React.ElementType {
  return DEVICE_ICON[type || "unknown"] || Zap;
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className ?? ""}`} />;
}

// ─── Status Banner ──────────────────────────────────────────────────────────

function BridgeStatus() {
  const { status, loading, configured } = useDigitalstromStatus();

  if (!configured) {
    return (
      <Card className="border-dashed border-amber-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Server className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Supabase nicht konfiguriert</p>
              <p className="text-muted-foreground text-xs mt-1">
                Setze <code className="text-amber-400">VITE_SUPABASE_URL</code> und{" "}
                <code className="text-amber-400">VITE_SUPABASE_ANON_KEY</code> in der{" "}
                <code>.env</code> Datei und starte den Bridge-Container auf deinem Synology NAS.
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                Aktuell werden keine Live-Daten angezeigt.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Lade Bridge-Status…
      </div>
    );
  }

  const reachable = status?.dss_reachable ?? false;
  const lastPoll = status?.last_poll_at
    ? new Date(status.last_poll_at).toLocaleTimeString("de-CH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Badge
        variant="outline"
        className={`text-xs ${
          reachable
            ? "text-green-400 border-green-400/30"
            : "text-red-400 border-red-400/30"
        }`}
      >
        {reachable ? (
          <Wifi className="h-3 w-3 mr-1" />
        ) : (
          <WifiOff className="h-3 w-3 mr-1" />
        )}
        {reachable ? "dSS Verbunden" : "dSS Offline"}
      </Badge>
      <span className="text-xs text-muted-foreground tabular-nums">
        Letztes Update: {lastPoll}
      </span>
      {status?.bridge_version && (
        <span className="text-xs text-muted-foreground">
          Bridge v{status.bridge_version}
        </span>
      )}
    </div>
  );
}

// ─── Total Power KPIs ───────────────────────────────────────────────────────

function PowerKpis() {
  const { meters, totalConsumption, loading } = useDigitalstromMeters();
  const { zones } = useDigitalstromZones();

  const zoneCount = zones.length;
  const meterCount = meters.length;

  const cards = [
    {
      label: "Gesamtverbrauch",
      value: loading ? null : formatSwissDe(Math.round(totalConsumption)),
      unit: "W",
      icon: Zap,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Zonen",
      value: loading ? null : String(zoneCount),
      unit: "",
      icon: Home,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "Stromkreise",
      value: loading ? null : String(meterCount),
      unit: "",
      icon: Activity,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((kpi) => (
        <Card key={kpi.label} className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
              <div className={`p-1.5 rounded-md ${kpi.bg}`}>
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              </div>
            </div>
            {kpi.value === null ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold tabular-nums">{kpi.value}</span>
                {kpi.unit && (
                  <span className="text-sm text-muted-foreground">{kpi.unit}</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Zone Card ──────────────────────────────────────────────────────────────

function ZoneCard({
  zone,
  devices,
}: {
  zone: DsZone;
  devices: DsDevice[];
}) {
  const lights = devices.filter((d) => d.device_type === "light");
  const blinds = devices.filter((d) => d.device_type === "blind");
  const lightsOn = lights.filter((d) => d.is_on).length;
  const totalDevices = devices.length;

  return (
    <Card data-testid={`card-zone-${zone.id}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-muted-foreground" />
            {zone.name}
          </div>
          <Badge variant="outline" className="text-xs tabular-nums">
            {formatSwissDe(Math.round(zone.consumption_w))} W
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Temperature */}
        {zone.temperature !== null && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Thermometer className="h-3.5 w-3.5" />
              Temperatur
            </div>
            <span className="text-sm font-medium tabular-nums">
              {zone.temperature?.toFixed(1)}°C
            </span>
          </div>
        )}

        {/* Humidity */}
        {zone.humidity !== null && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Droplets className="h-3.5 w-3.5" />
              Feuchtigkeit
            </div>
            <span className="text-sm font-medium tabular-nums">
              {zone.humidity?.toFixed(0)}%
            </span>
          </div>
        )}

        {/* Lights */}
        {lights.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lightbulb
                className={`h-3.5 w-3.5 ${lightsOn > 0 ? "text-amber-400" : ""}`}
              />
              Licht
            </div>
            <span className="text-sm font-medium tabular-nums">
              {lightsOn}/{lights.length} an
            </span>
          </div>
        )}

        {/* Blinds */}
        {blinds.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Blinds className="h-3.5 w-3.5" />
              Beschattung
            </div>
            <span className="text-sm font-medium tabular-nums">
              {blinds.length} {blinds.length === 1 ? "Gerät" : "Geräte"}
            </span>
          </div>
        )}

        {/* Device list summary */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {totalDevices} {totalDevices === 1 ? "Gerät" : "Geräte"}
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          </div>
          {/* Compact device type breakdown */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {Object.entries(
              devices.reduce<Record<string, number>>((acc, d) => {
                const t = d.device_type || "unknown";
                acc[t] = (acc[t] || 0) + 1;
                return acc;
              }, {})
            ).map(([type, count]) => {
              const Icon = deviceIcon(type);
              return (
                <Badge
                  key={type}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0.5 gap-1"
                >
                  <Icon className="h-2.5 w-2.5" />
                  {count}
                </Badge>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Meters Table ───────────────────────────────────────────────────────────

function MetersOverview() {
  const { meters, loading } = useDigitalstromMeters();

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Stromkreise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (meters.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Stromkreise
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {meters.map((meter) => (
            <div
              key={meter.dsuid}
              className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate text-muted-foreground">
                  {meter.name || meter.dsuid.slice(0, 12) + "…"}
                </span>
              </div>
              <span className="font-medium tabular-nums shrink-0 ml-2">
                {formatSwissDe(Math.round(meter.consumption_w))} W
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Not Configured Placeholder ─────────────────────────────────────────────

function PlaceholderView() {
  // Show a helpful setup guide when Supabase is not yet configured
  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Digitalstrom</h1>
          <p className="text-sm text-muted-foreground">Smart Home Steuerung</p>
        </div>
      </div>

      <BridgeStatus />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Setup-Anleitung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">
              Um Live-Daten von deinem Digitalstrom-Server zu sehen:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li>Erstelle ein kostenloses Supabase-Projekt auf supabase.com</li>
              <li>Führe das mitgelieferte SQL-Schema im SQL Editor aus</li>
              <li>Starte den Bridge-Container auf deinem Synology NAS</li>
              <li>
                Setze <code className="text-amber-400 bg-amber-400/10 px-1 rounded">VITE_SUPABASE_URL</code>{" "}
                und <code className="text-amber-400 bg-amber-400/10 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>
              </li>
            </ol>
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs">
              Dein dSS-Server: <code className="font-mono">192.168.1.129:8080</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function Digitalstrom() {
  const { zones, loading: zonesLoading, configured } = useDigitalstromZones();
  const { devices, loading: devicesLoading } = useDigitalstromDevices();

  // Group devices by zone
  const devicesByZone = useMemo(() => {
    const map: Record<number, DsDevice[]> = {};
    for (const d of devices) {
      const zid = d.zone_id ?? -1;
      if (!map[zid]) map[zid] = [];
      map[zid].push(d);
    }
    return map;
  }, [devices]);

  if (!configured) {
    return <PlaceholderView />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Digitalstrom</h1>
          <p className="text-sm text-muted-foreground">Smart Home Steuerung — Live</p>
        </div>
        <BridgeStatus />
      </div>

      {/* Power KPIs */}
      <PowerKpis />

      {/* Zone Grid */}
      {zonesLoading || devicesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : zones.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Home className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Keine Zonen gefunden</p>
            <p className="text-xs mt-1">
              Prüfe ob der Bridge-Container läuft und der dSS erreichbar ist.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              devices={devicesByZone[zone.id] || []}
            />
          ))}
        </div>
      )}

      {/* Meters */}
      <MetersOverview />
    </div>
  );
}
