import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Car, Gauge, BatteryCharging, Fuel, MapPin, Lock, Unlock,
  RefreshCw, Settings, AlertCircle, CheckCircle, Zap, Navigation,
  Thermometer, Wrench,
} from "lucide-react";
import { useOpenWBData } from "@/hooks/use-openwb-data";
import { Link } from "wouter";

// Vehicle data type (mirrored from server/vehicle-api.ts)
interface VehicleApiData {
  vin: string;
  model: string;
  brand: "PORSCHE" | "BMW" | "MINI";
  year?: number;
  color?: string;
  mileage?: number;
  fuelLevel?: number;
  batteryLevel?: number;
  electricRange?: number;
  combustionRange?: number;
  isCharging?: boolean;
  chargingStatus?: string;
  remainingChargingTime?: number;
  chargingPower?: number;
  doors?: {
    locked: boolean;
    frontLeft?: string;
    frontRight?: string;
    rearLeft?: string;
    rearRight?: string;
    trunk?: string;
  };
  location?: { lat: number; lng: number; address?: string };
  serviceAlerts?: string[];
  lastUpdated: Date;
  error?: string;
}

// ─── Static vehicle configuration ─────────────────────────────────────────────
// Matches API data by model keywords

const VEHICLE_CONFIG = [
  {
    key: "taycan",
    label: "Porsche Taycan",
    type: "ev" as const,
    brand: "PORSCHE" as const,
    color: "Silber",
    plate: "BL ••• ",
    icon: "🔌",
    wallboxId: 1, // OpenWB chargepoint ID
  },
  {
    key: "cayenne",
    label: "Porsche Cayenne",
    type: "hybrid" as const,
    brand: "PORSCHE" as const,
    color: "Schwarz",
    plate: "BL ••• ",
    icon: "⚡",
    wallboxId: 2,
  },
  {
    key: "mini",
    label: "Mini JCW Cabrio",
    type: "combustion" as const,
    brand: "MINI" as const,
    color: "Grün",
    plate: "BL ••• ",
    icon: "🚗",
    wallboxId: null,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatKm(km?: number) {
  if (km === undefined) return "—";
  return km.toLocaleString("de-CH") + " km";
}

function doorsAllClosed(doors?: VehicleApiData["doors"]) {
  if (!doors) return null;
  const states = [doors.frontLeft, doors.frontRight, doors.rearLeft, doors.rearRight, doors.trunk];
  return states.every((s) => !s || s === "CLOSED" || s === "closed");
}

// ─── Battery / Fuel Arc ───────────────────────────────────────────────────────

function LevelArc({
  value,
  color,
  label,
  isCharging,
}: {
  value: number;
  color: string;
  label: string;
  isCharging?: boolean;
}) {
  const pct = Math.min(Math.max(value, 0), 100) / 100;
  const r = 40;
  const cx = 56;
  const cy = 56;
  const startAngle = -210;
  const sweepAngle = 240;

  function polar(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arc(from: number, to: number) {
    const s = polar(from);
    const e = polar(to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const endAngle = startAngle + sweepAngle * pct;

  return (
    <svg viewBox="0 0 112 80" className="w-28 h-20">
      <path d={arc(startAngle, startAngle + sweepAngle)} fill="none" stroke="#222" strokeWidth="8" strokeLinecap="round" />
      {pct > 0 && (
        <path d={arc(startAngle, endAngle)} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Montserrat,sans-serif">
        {value}
      </text>
      <text x={cx} y={cx + 8} textAnchor="middle" fill="#888" fontSize="8" fontFamily="Montserrat,sans-serif">
        {label}
      </text>
      {isCharging && (
        <text x={cx} y={cy + 18} textAnchor="middle" fill="#FFE600" fontSize="7" fontFamily="Montserrat,sans-serif">
          ⚡ lädt
        </text>
      )}
    </svg>
  );
}

// ─── Vehicle Card ─────────────────────────────────────────────────────────────

function VehicleCard({
  config,
  apiData,
  wallboxPower,
  isConfigured,
}: {
  config: typeof VEHICLE_CONFIG[0];
  apiData?: VehicleApiData;
  wallboxPower: number;
  isConfigured: boolean;
}) {
  const isCharging = (apiData?.isCharging) || wallboxPower > 50;
  const doorsOk = doorsAllClosed(apiData?.doors);
  const isLocked = apiData?.doors?.locked;

  return (
    <Card className="bg-[#111] border-[#222] overflow-hidden relative">
      {isCharging && <div className="absolute inset-0 rounded-lg border border-[#FFE600]/20 pointer-events-none" />}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
              <Car className="h-5 w-5 text-[#FFE600]" />
              {config.label}
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">{config.color}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isLocked === true && (
              <Badge className="bg-green-500/10 text-green-400 border border-green-500/30 text-xs gap-1">
                <Lock className="h-2.5 w-2.5" /> Verriegelt
              </Badge>
            )}
            {isLocked === false && (
              <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs gap-1">
                <Unlock className="h-2.5 w-2.5" /> Offen
              </Badge>
            )}
            {isCharging && (
              <Badge className="bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/30 text-xs gap-1">
                <BatteryCharging className="h-2.5 w-2.5" /> Lädt
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {!isConfigured ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle className="h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-500 text-center">
              {config.brand === "MINI" ? "BMW Connected Drive" : "Porsche Connect"} Zugangsdaten nicht konfiguriert
            </p>
            <Link href="/einstellungen">
              <Button size="sm" variant="outline" className="border-[#333] text-gray-400 hover:text-white gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                Konfigurieren
              </Button>
            </Link>
          </div>
        ) : apiData?.error ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <p className="text-xs text-red-400 text-center">{apiData.error}</p>
          </div>
        ) : (
          <>
            {/* Level gauges */}
            <div className="flex justify-center gap-4 my-2">
              {(config.type === "ev" || config.type === "hybrid") && apiData?.batteryLevel !== undefined && (
                <div className="text-center">
                  <LevelArc
                    value={apiData.batteryLevel}
                    color={apiData.batteryLevel > 30 ? "#FFE600" : "#ef4444"}
                    label="%"
                    isCharging={isCharging}
                  />
                  <p className="text-[10px] text-gray-500">Akku</p>
                </div>
              )}
              {config.type !== "ev" && apiData?.fuelLevel !== undefined && (
                <div className="text-center">
                  <LevelArc
                    value={apiData.fuelLevel}
                    color={apiData.fuelLevel > 20 ? "#60a5fa" : "#ef4444"}
                    label="%"
                  />
                  <p className="text-[10px] text-gray-500">Tank</p>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-[#1a1a1a] rounded-lg p-2">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                  <Gauge className="h-3 w-3" /> km-Stand
                </div>
                <div className="text-sm font-bold text-white">{formatKm(apiData?.mileage)}</div>
              </div>

              {config.type === "ev" && apiData?.electricRange !== undefined && (
                <div className="bg-[#1a1a1a] rounded-lg p-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                    <Zap className="h-3 w-3" /> Reichweite
                  </div>
                  <div className="text-sm font-bold text-white">{formatKm(apiData.electricRange)}</div>
                </div>
              )}

              {config.type === "hybrid" && (
                <>
                  {apiData?.electricRange !== undefined && (
                    <div className="bg-[#1a1a1a] rounded-lg p-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                        <Zap className="h-3 w-3" /> E-Reichweite
                      </div>
                      <div className="text-sm font-bold text-white">{formatKm(apiData.electricRange)}</div>
                    </div>
                  )}
                  {apiData?.combustionRange !== undefined && (
                    <div className="bg-[#1a1a1a] rounded-lg p-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                        <Fuel className="h-3 w-3" /> Benzin
                      </div>
                      <div className="text-sm font-bold text-white">{formatKm(apiData.combustionRange)}</div>
                    </div>
                  )}
                </>
              )}

              {config.type === "combustion" && apiData?.combustionRange !== undefined && (
                <div className="bg-[#1a1a1a] rounded-lg p-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                    <Navigation className="h-3 w-3" /> Reichweite
                  </div>
                  <div className="text-sm font-bold text-white">{formatKm(apiData.combustionRange)}</div>
                </div>
              )}
            </div>

            {/* Wallbox charging info */}
            {wallboxPower > 50 && (
              <div className="mt-2 p-2 rounded-lg bg-[#FFE600]/5 border border-[#FFE600]/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#FFE600]">
                  <BatteryCharging className="h-3.5 w-3.5" />
                  Lädt gerade
                </div>
                <span className="text-sm font-bold text-[#FFE600]">
                  {wallboxPower >= 1000 ? (wallboxPower / 1000).toFixed(2) + " kW" : Math.round(wallboxPower) + " W"}
                </span>
              </div>
            )}

            {/* Location */}
            {apiData?.location?.address && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                <MapPin className="h-3 w-3" />
                {apiData.location.address}
              </div>
            )}

            {/* Doors status */}
            {doorsOk !== null && (
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                {doorsOk ? (
                  <><CheckCircle className="h-3 w-3 text-green-400" /><span className="text-green-400">Alle Türen geschlossen</span></>
                ) : (
                  <><AlertCircle className="h-3 w-3 text-orange-400" /><span className="text-orange-400">Tür/Kofferraum offen</span></>
                )}
              </div>
            )}

            {/* Service alerts */}
            {apiData?.serviceAlerts && apiData.serviceAlerts.length > 0 && (
              <div className="mt-2 p-2 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <div className="flex items-center gap-1.5 text-xs text-orange-400 mb-1">
                  <Wrench className="h-3 w-3" /> Service
                </div>
                {apiData.serviceAlerts.slice(0, 2).map((alert, i) => (
                  <p key={i} className="text-xs text-gray-400">{alert}</p>
                ))}
              </div>
            )}

            {/* Last updated */}
            {apiData?.lastUpdated && (
              <p className="text-[10px] text-gray-600 mt-2 text-right">
                {new Date(apiData.lastUpdated).toLocaleTimeString("de-CH")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Fahrzeuge() {
  const queryClient = useQueryClient();
  const { wallboxes } = useOpenWBData("192.168.1.55");

  // Porsche data
  const { data: porscheData, isLoading: porscheLoading } = useQuery({
    queryKey: ["/api/vehicles/porsche"],
    queryFn: () => fetch("/api/vehicles/porsche").then((r) => r.json()),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  // BMW/Mini data
  const { data: bmwData, isLoading: bmwLoading } = useQuery({
    queryKey: ["/api/vehicles/bmw"],
    queryFn: () => fetch("/api/vehicles/bmw").then((r) => r.json()),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  // Refresh mutations
  const refreshPorsche = useMutation({
    mutationFn: () => fetch("/api/vehicles/porsche/refresh", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/vehicles/porsche"] }),
  });

  const refreshBmw = useMutation({
    mutationFn: () => fetch("/api/vehicles/bmw/refresh", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/vehicles/bmw"] }),
  });

  // Match API data to static config
  function getApiData(config: typeof VEHICLE_CONFIG[0]): VehicleApiData | undefined {
    const allVehicles: VehicleApiData[] = [
      ...(porscheData?.vehicles || []),
      ...(bmwData?.vehicles || []),
    ];
    return allVehicles.find((v) => {
      const modelLower = v.model?.toLowerCase() || "";
      if (config.key === "taycan") return modelLower.includes("taycan");
      if (config.key === "cayenne") return modelLower.includes("cayenne");
      if (config.key === "mini") return v.brand === "MINI" || modelLower.includes("mini") || modelLower.includes("jcw");
      return false;
    });
  }

  function isConfigured(config: typeof VEHICLE_CONFIG[0]) {
    if (config.brand === "PORSCHE") return porscheData?.configured === true;
    if (config.brand === "MINI") return bmwData?.configured === true;
    return false;
  }

  const isLoading = porscheLoading || bmwLoading;

  return (
    <div className="h-full overflow-y-auto bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Car className="h-6 w-6 text-[#FFE600]" />
            Fahrzeuge
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Live-Status über Porsche Connect & BMW Connected Drive</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-[#333] text-gray-400 hover:text-white gap-1.5"
            onClick={() => { refreshPorsche.mutate(); refreshBmw.mutate(); }}
            disabled={refreshPorsche.isPending || refreshBmw.isPending || isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${(refreshPorsche.isPending || refreshBmw.isPending) ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Fahrzeuge",
            value: VEHICLE_CONFIG.length.toString(),
            icon: Car,
            color: "text-[#FFE600]",
            bg: "bg-[#FFE600]/10",
          },
          {
            label: "Lädt gerade",
            value: wallboxes.filter((wb) => wb.chargeState).length.toString(),
            icon: BatteryCharging,
            color: "text-green-400",
            bg: "bg-green-500/10",
          },
          {
            label: "Gesamt Ladeleistung",
            value: (() => {
              const total = wallboxes.reduce((s, wb) => s + wb.power, 0);
              return total >= 1000 ? (total / 1000).toFixed(1) + " kW" : Math.round(total) + " W";
            })(),
            icon: Zap,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
          },
        ].map((item) => (
          <Card key={item.label} className="bg-[#111] border-[#222]">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.bg}`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">{item.label}</p>
                  <p className="text-xl font-bold text-white">{item.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vehicle cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {VEHICLE_CONFIG.map((config) => {
          const wb = config.wallboxId !== null
            ? wallboxes.find((w) => w.id === config.wallboxId)
            : null;
          return (
            <VehicleCard
              key={config.key}
              config={config}
              apiData={getApiData(config)}
              wallboxPower={wb?.power || 0}
              isConfigured={isConfigured(config)}
            />
          );
        })}
      </div>

      {/* API config hint */}
      {(!porscheData?.configured || !bmwData?.configured) && (
        <Card className="mt-6 bg-[#111] border-[#FFE600]/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Settings className="h-4 w-4 text-[#FFE600] mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Fahrzeug-APIs konfigurieren</p>
                <p className="text-xs text-gray-500 mt-1">
                  Trage deine Zugangsdaten in den{" "}
                  <Link href="/einstellungen" className="text-[#FFE600] hover:underline">Einstellungen</Link>{" "}
                  ein:
                </p>
                <ul className="text-xs text-gray-500 mt-1 space-y-0.5 list-disc list-inside">
                  {!porscheData?.configured && <li>Porsche Connect — E-Mail & Passwort (für Taycan & Cayenne)</li>}
                  {!bmwData?.configured && <li>BMW Connected Drive — E-Mail & Passwort (für Mini JCW)</li>}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
