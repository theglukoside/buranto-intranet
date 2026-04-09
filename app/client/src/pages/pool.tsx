import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Waves, Lightbulb, Power, RefreshCw, Wifi, WifiOff,
  Zap, Sun, Palette,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PoolStatus {
  light: { on: boolean; brightness: number | null; scene: number | null };
  control: { on: boolean; freigegeben: boolean };
  lastUpdated: string;
  error: string | null;
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function poolCommand(page: string, params: string) {
  const res = await fetch("/api/pool/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page, params }),
  });
  return res.json();
}

// ─── Color scenes ─────────────────────────────────────────────────────────────

const SCENES = [
  { id: 3,  label: "Weiss",       color: "#FFFFFF" },
  { id: 7,  label: "Verlauf",     color: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f)" },
  { id: 8,  label: "Szene 1",     color: "#FF001A" },
  { id: 9,  label: "Szene 2",     color: "#FFEE00" },
  { id: 10, label: "Szene 3",     color: "#00D4FF" },
  { id: 11, label: "Szene 4",     color: "#0000FF" },
  { id: 12, label: "Szene 5",     color: "#FF0000" },
  { id: 13, label: "Szene 6",     color: "#FF7700" },
];

const BRIGHTNESS = [25, 50, 75, 100];

// ─── Light Section ────────────────────────────────────────────────────────────

function LightSection({
  light,
  onCommand,
  pending,
}: {
  light: PoolStatus["light"];
  onCommand: (page: string, params: string) => void;
  pending: boolean;
}) {
  return (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-base font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-[#FFE600]" />
            Beleuchtung
          </div>
          <Badge
            className={light.on
              ? "bg-[#FFE600]/10 text-[#FFE600] border-[#FFE600]/30"
              : "bg-white/5 text-gray-500 border-white/10"
            }
          >
            {light.on ? "EIN" : "AUS"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* On/Off */}
        <div className="flex gap-3">
          <Button
            className={`flex-1 h-11 ${light.on
              ? "bg-[#FFE600] text-black hover:bg-[#FFE600]/90 font-bold"
              : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
            onClick={() => onCommand("LightDMX.html", "dli=1")}
            disabled={pending}
          >
            <Power className="h-4 w-4 mr-2" /> EIN
          </Button>
          <Button
            className={`flex-1 h-11 ${!light.on
              ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
              : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
            onClick={() => onCommand("LightDMX.html", "dli=0")}
            disabled={pending}
          >
            <Power className="h-4 w-4 mr-2" /> AUS
          </Button>
        </div>

        {/* Brightness */}
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Sun className="h-3 w-3" /> Helligkeit
          </p>
          <div className="flex gap-2">
            {BRIGHTNESS.map((b) => (
              <button
                key={b}
                onClick={() => onCommand("LightDMX.html", `dwd=${b}`)}
                disabled={pending || !light.on}
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors
                  ${light.brightness === b
                    ? "bg-[#FFE600] text-black"
                    : "bg-[#1a1a1a] text-gray-400 hover:bg-[#222] hover:text-white disabled:opacity-40"
                  }`}
              >
                {b}%
              </button>
            ))}
          </div>
        </div>

        {/* Color Scenes */}
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Palette className="h-3 w-3" /> Szenen
          </p>
          <div className="grid grid-cols-4 gap-2">
            {SCENES.map((scene) => (
              <button
                key={scene.id}
                onClick={() => onCommand("LightDMX.html", `setcolor=${scene.id}`)}
                disabled={pending || !light.on}
                title={scene.label}
                className={`relative h-10 rounded-lg overflow-hidden border-2 transition-all disabled:opacity-40
                  ${light.scene === scene.id
                    ? "border-[#FFE600] scale-105"
                    : "border-transparent hover:border-white/30"
                  }`}
              >
                {scene.id === 7 ? (
                  <div className="absolute inset-0" style={{ background: scene.color }} />
                ) : (
                  <div className="absolute inset-0" style={{ backgroundColor: scene.color }} />
                )}
                <span className="relative text-[9px] font-bold text-white/90 drop-shadow-lg">
                  {scene.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Control Section ──────────────────────────────────────────────────────────

function ControlSection({
  control,
  onCommand,
  pending,
}: {
  control: PoolStatus["control"];
  onCommand: (page: string, params: string) => void;
  pending: boolean;
}) {
  return (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-base font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#FFE600]" />
            Schaltkasten
          </div>
          <Badge
            className={control.on
              ? "bg-green-500/10 text-green-400 border-green-500/30"
              : "bg-white/5 text-gray-500 border-white/10"
            }
          >
            {control.on ? "EIN" : "AUS"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-3">
          <Button
            className={`flex-1 h-11 ${control.on
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
            onClick={() => onCommand("SteuerkastenNT.html", "sst=1")}
            disabled={pending}
          >
            <Power className="h-4 w-4 mr-2" /> EIN
          </Button>
          <Button
            className={`flex-1 h-11 ${!control.on
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
            onClick={() => onCommand("SteuerkastenNT.html", "sst=0")}
            disabled={pending}
          >
            <Power className="h-4 w-4 mr-2" /> AUS
          </Button>
        </div>
        <Button
          variant="outline"
          className="w-full border-[#333] text-gray-400 hover:text-white"
          onClick={() => onCommand("SteuerkastenNT.html", "settoggle=1")}
          disabled={pending}
        >
          Freigeben
        </Button>
        <p className="text-[10px] text-gray-600">
          Steuert den Pumpenkreis und angeschlossene Komponenten.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Pool() {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<PoolStatus>({
    queryKey: ["/api/pool/status"],
    queryFn: () => fetch("/api/pool/status").then((r) => r.json()),
    refetchInterval: 10_000,
    staleTime: 8_000,
  });

  const command = useMutation({
    mutationFn: ({ page, params }: { page: string; params: string }) =>
      poolCommand(page, params),
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/pool/status"] });
      }, 800);
    },
  });

  const onCommand = (page: string, params: string) => {
    command.mutate({ page, params });
  };

  const reachable = !status?.error;

  return (
    <div className="h-full overflow-y-auto bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Waves className="h-6 w-6 text-[#FFE600]" />
            Pool
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Myfluvo Gateway — 192.168.1.144</p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin" /> Verbinde…
            </Badge>
          ) : reachable ? (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/30 gap-1.5">
              <Wifi className="h-3 w-3" /> Online
            </Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/30 gap-1.5">
              <WifiOff className="h-3 w-3" /> Offline
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-[#333] text-gray-400 hover:text-white gap-1.5"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/pool/status"] })}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Error */}
      {status?.error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {status.error}
          <p className="text-xs text-red-400/60 mt-1">Gateway unter 192.168.1.144 nicht erreichbar</p>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {status ? (
          <>
            <LightSection
              light={status.light}
              onCommand={onCommand}
              pending={command.isPending}
            />
            <ControlSection
              control={status.control}
              onCommand={onCommand}
              pending={command.isPending}
            />
          </>
        ) : (
          <div className="col-span-2 flex flex-col items-center gap-3 py-16">
            <RefreshCw className="h-8 w-8 text-[#FFE600] animate-spin" />
            <p className="text-gray-500">Verbinde mit Pool-Gateway…</p>
          </div>
        )}
      </div>

      {/* Direct web interface link */}
      <div className="mt-6 p-3 rounded-lg bg-[#111] border border-[#222]">
        <p className="text-xs text-gray-500">
          Erweiterte Einstellungen:{" "}
          <a
            href="http://192.168.1.144"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FFE600] hover:underline"
          >
            http://192.168.1.144
          </a>{" "}
          (Myfluvo Weboberfläche)
        </p>
        {status?.lastUpdated && (
          <p className="text-[10px] text-gray-600 mt-1">
            Aktualisiert: {new Date(status.lastUpdated).toLocaleTimeString("de-CH")}
          </p>
        )}
      </div>
    </div>
  );
}
