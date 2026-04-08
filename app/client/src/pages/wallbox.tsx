import { useOpenWBData, WallboxData } from "@/hooks/use-openwb-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Plug, BatteryCharging, Wifi, WifiOff, RefreshCw, Activity } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPower(w: number): string {
  if (w >= 1000) return (w / 1000).toFixed(2) + " kW";
  return Math.round(w) + " W";
}

function formatEnergy(kwh: number): string {
  return kwh.toFixed(2) + " kWh";
}

// ─── Power Arc ───────────────────────────────────────────────────────────────

function PowerArc({ power, maxPower = 22000 }: { power: number; maxPower?: number }) {
  const pct = Math.min(power / maxPower, 1);
  const radius = 54;
  const cx = 64;
  const cy = 72;
  const startAngle = -210;
  const sweepAngle = 240;

  function polarToCartesian(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function arcPath(fromAngle: number, toAngle: number) {
    const start = polarToCartesian(fromAngle);
    const end = polarToCartesian(toAngle);
    const largeArc = toAngle - fromAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  const endAngle = startAngle + sweepAngle * pct;

  return (
    <svg viewBox="0 0 128 90" className="w-40 h-28 mx-auto">
      {/* Track */}
      <path
        d={arcPath(startAngle, startAngle + sweepAngle)}
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Fill */}
      {pct > 0 && (
        <path
          d={arcPath(startAngle, endAngle)}
          fill="none"
          stroke="#FFE600"
          strokeWidth="10"
          strokeLinecap="round"
        />
      )}
      {/* Power value */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fill="white"
        fontSize="13"
        fontWeight="700"
        fontFamily="Montserrat, sans-serif"
      >
        {power >= 1000 ? (power / 1000).toFixed(1) : Math.round(power)}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fill="#888"
        fontSize="8"
        fontFamily="Montserrat, sans-serif"
      >
        {power >= 1000 ? "kW" : "W"}
      </text>
    </svg>
  );
}

// ─── Wallbox Card ─────────────────────────────────────────────────────────────

function WallboxCard({ wb }: { wb: WallboxData }) {
  const isCharging = wb.chargeState && wb.power > 0;
  const isPlugged = wb.plugState;

  return (
    <Card className="bg-[#111] border-[#222] overflow-hidden relative">
      {/* Active charging glow */}
      {isCharging && (
        <div className="absolute inset-0 rounded-lg border border-[#FFE600]/30 pointer-events-none" />
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
            <BatteryCharging
              className="h-5 w-5"
              style={{ color: isCharging ? "#FFE600" : "#555" }}
            />
            {wb.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isCharging && (
              <Badge className="bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/30 text-xs">
                Lädt
              </Badge>
            )}
            {isPlugged && !isCharging && (
              <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs">
                Verbunden
              </Badge>
            )}
            {!isPlugged && (
              <Badge className="bg-white/5 text-gray-500 border border-white/10 text-xs">
                Frei
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">{wb.ip}</p>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Power Arc */}
        <PowerArc power={wb.power} />

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-[#1a1a1a] rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Heute</div>
            <div className="text-sm font-bold text-white">{formatEnergy(wb.dailyImported)}</div>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Strom</div>
            <div className="text-sm font-bold text-white">
              {wb.current > 0 ? wb.current.toFixed(1) + " A" : "—"}
            </div>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Phasen</div>
            <div className="text-sm font-bold text-white">
              {wb.phasesInUse > 0 ? wb.phasesInUse + "×" : "—"}
            </div>
          </div>
        </div>

        {/* SoC bar (if available) */}
        {wb.soc !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Akku</span>
              <span>{wb.soc.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${wb.soc}%`,
                  backgroundColor: wb.soc > 80 ? "#22c55e" : wb.soc > 30 ? "#FFE600" : "#ef4444",
                }}
              />
            </div>
          </div>
        )}

        {/* Phase power bars (if charging on multiple phases) */}
        {isCharging && wb.phasesInUse > 1 && (
          <div className="mt-3 space-y-1">
            {[
              { label: "L1", val: wb.powerL1 },
              { label: "L2", val: wb.powerL2 },
              { label: "L3", val: wb.powerL3 },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-4">{label}</span>
                <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FFE600]/60 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((val / 7700) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 w-14 text-right">
                  {val > 0 ? formatPower(val) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Last update */}
        {wb.lastUpdate && (
          <p className="text-[10px] text-gray-600 mt-3 text-right">
            Aktualisiert {wb.lastUpdate.toLocaleTimeString("de-CH")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Total Summary ────────────────────────────────────────────────────────────

function TotalSummary({ wallboxes }: { wallboxes: WallboxData[] }) {
  const totalPower = wallboxes.reduce((s, wb) => s + wb.power, 0);
  const totalToday = wallboxes.reduce((s, wb) => s + wb.dailyImported, 0);
  const activeCount = wallboxes.filter((wb) => wb.chargeState).length;

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FFE600]/10">
              <Zap className="h-5 w-5 text-[#FFE600]" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Gesamt Leistung</p>
              <p className="text-xl font-bold text-white">{formatPower(totalPower)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#111] border-[#222]">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Activity className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Heute geladen</p>
              <p className="text-xl font-bold text-white">{formatEnergy(totalToday)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#111] border-[#222]">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Plug className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Aktiv</p>
              <p className="text-xl font-bold text-white">
                {activeCount} / {wallboxes.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Wallbox() {
  const { wallboxes, status } = useOpenWBData("192.168.1.55");

  return (
    <div className="h-full overflow-y-auto bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BatteryCharging className="h-6 w-6 text-[#FFE600]" />
            Wallbox
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">OpenWB Ladestation — Live</p>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2">
          {status.connected ? (
            <Badge className="bg-green-500/10 text-green-400 border border-green-500/30 gap-1.5">
              <Wifi className="h-3 w-3" />
              Verbunden
            </Badge>
          ) : status.connecting ? (
            <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Verbinde…
            </Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-400 border border-red-500/30 gap-1.5">
              <WifiOff className="h-3 w-3" />
              Nicht erreichbar
            </Badge>
          )}
        </div>
      </div>

      {/* Error message */}
      {status.error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {status.error}
          <p className="text-xs text-red-400/60 mt-1">
            Stelle sicher, dass MQTT WebSocket auf Port 9001 bei {status.brokerIp} aktiv ist.
          </p>
        </div>
      )}

      {/* Summary */}
      <TotalSummary wallboxes={wallboxes} />

      {/* Wallbox cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {wallboxes.map((wb) => (
          <WallboxCard key={wb.id} wb={wb} />
        ))}
      </div>

      {/* Info footer */}
      <div className="mt-6 p-3 rounded-lg bg-[#111] border border-[#222]">
        <p className="text-xs text-gray-500">
          Daten werden live über MQTT WebSocket von {status.brokerIp}:9001 bezogen.
          Ladeleistung wird alle paar Sekunden aktualisiert.
        </p>
      </div>
    </div>
  );
}
