import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Music, RefreshCw, Wifi, WifiOff, Radio, Users,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SonosTrack {
  title: string;
  artist: string;
  album: string;
  albumArtUri: string;
  duration: number;
  position: number;
}

interface SonosZone {
  id: string;
  name: string;
  ip: string;
  state: "playing" | "paused" | "stopped" | "transitioning" | "unknown";
  volume: number;
  muted: boolean;
  track: SonosTrack | null;
  groupMembers: string[];
  isCoordinator: boolean;
  lastUpdated: string;
}

interface SonosCache {
  zones: SonosZone[];
  discovered: string[];
  lastScan: string | null;
  lastPoll: string | null;
  scanning: boolean;
  error: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function stateLabel(state: SonosZone["state"]): string {
  switch (state) {
    case "playing": return "Spielt";
    case "paused": return "Pausiert";
    case "stopped": return "Gestoppt";
    case "transitioning": return "Lädt...";
    default: return "Unbekannt";
  }
}

// ─── Volume Slider (debounced) ─────────────────────────────────────────────────

function VolumeControl({ zone, onVolumeChange }: { zone: SonosZone; onVolumeChange: (ip: string, vol: number) => void }) {
  const [localVol, setLocalVol] = useState(zone.volume);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((val: number[]) => {
    setLocalVol(val[0]);
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => onVolumeChange(zone.ip, val[0]), 300);
    setTimer(t);
  }, [zone.ip, timer, onVolumeChange]);

  return (
    <div className="flex items-center gap-2">
      <Volume2 className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
      <Slider
        value={[localVol]}
        min={0}
        max={100}
        step={2}
        onValueChange={handleChange}
        className="flex-1"
      />
      <span className="text-xs text-gray-500 w-7 text-right">{localVol}</span>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ track, state }: { track: SonosTrack; state: SonosZone["state"] }) {
  const pct = track.duration > 0 ? Math.min((track.position / track.duration) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="h-1 bg-[#222] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            backgroundColor: state === "playing" ? "#FFE600" : "#555",
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>{formatTime(track.position)}</span>
        <span>{track.duration > 0 ? formatTime(track.duration) : "–"}</span>
      </div>
    </div>
  );
}

// ─── Zone Card ────────────────────────────────────────────────────────────────

function ZoneCard({
  zone,
  allZones,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onVolume,
  onMute,
}: {
  zone: SonosZone;
  allZones: SonosZone[];
  onPlay: (ip: string) => void;
  onPause: (ip: string) => void;
  onNext: (ip: string) => void;
  onPrev: (ip: string) => void;
  onVolume: (ip: string, vol: number) => void;
  onMute: (ip: string, muted: boolean) => void;
}) {
  const isPlaying = zone.state === "playing";
  const hasTrack = zone.track !== null && zone.track.title !== "Unbekannter Titel";

  // Get group member names
  const groupNames = zone.groupMembers
    .filter((ip) => ip !== zone.ip)
    .map((ip) => allZones.find((z) => z.ip === ip)?.name || ip);

  return (
    <Card
      className="bg-[#111] border-[#222] overflow-hidden relative"
      style={{
        boxShadow: isPlaying ? "0 0 0 1px rgba(255,230,0,0.2)" : undefined,
      }}
    >
      {/* Album art background blur */}
      {hasTrack && zone.track?.albumArtUri && (
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url(${zone.track.albumArtUri})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(20px)",
          }}
        />
      )}

      <CardContent className="relative pt-4 pb-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#FFE600]" />
              {zone.name}
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">{zone.ip}</p>
          </div>
          <Badge
            className={`text-xs ${
              isPlaying
                ? "bg-[#FFE600]/10 text-[#FFE600] border-[#FFE600]/30"
                : "bg-white/5 text-gray-500 border-white/10"
            }`}
          >
            {stateLabel(zone.state)}
          </Badge>
        </div>

        {/* Album art + track info */}
        <div className="flex gap-3 mb-4">
          {/* Album art */}
          <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-[#1a1a1a] flex items-center justify-center">
            {zone.track?.albumArtUri ? (
              <img
                src={zone.track.albumArtUri}
                alt="Cover"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <Music className="h-6 w-6 text-gray-600" />
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            {zone.track ? (
              <>
                <p className="text-white text-sm font-medium truncate">
                  {zone.track.title || "—"}
                </p>
                <p className="text-gray-400 text-xs truncate">{zone.track.artist}</p>
                {zone.track.album && (
                  <p className="text-gray-600 text-xs truncate">{zone.track.album}</p>
                )}
              </>
            ) : (
              <p className="text-gray-600 text-sm">Nichts gespielt</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {zone.track && zone.track.duration > 0 && (
          <div className="mb-3">
            <ProgressBar track={zone.track} state={zone.state} />
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-gray-400 hover:text-white"
            onClick={() => onPrev(zone.ip)}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            className={`h-10 w-10 rounded-full ${
              isPlaying
                ? "bg-[#FFE600] text-black hover:bg-[#FFE600]/90"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
            onClick={() => isPlaying ? onPause(zone.ip) : onPlay(zone.ip)}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-gray-400 hover:text-white"
            onClick={() => onNext(zone.ip)}
          >
            <SkipForward className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className={`h-8 w-8 ml-2 ${zone.muted ? "text-red-400 hover:text-red-300" : "text-gray-400 hover:text-white"}`}
            onClick={() => onMute(zone.ip, !zone.muted)}
          >
            {zone.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Volume */}
        <VolumeControl zone={zone} onVolumeChange={onVolume} />

        {/* Group members */}
        {groupNames.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-500">
            <Users className="h-3 w-3" />
            Gruppe mit: {groupNames.join(", ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Sonos() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SonosCache>({
    queryKey: ["/api/sonos/zones"],
    queryFn: () => fetch("/api/sonos/zones").then((r) => r.json()),
    refetchInterval: 3000,
    staleTime: 2000,
  });

  const discover = useMutation({
    mutationFn: () => fetch("/api/sonos/discover", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sonos/zones"] }),
  });

  const command = useMutation({
    mutationFn: ({ ip, action, body }: { ip: string; action: string; body?: object }) =>
      fetch(`/api/sonos/zones/${ip}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sonos/zones"] }),
  });

  const zones = data?.zones || [];
  const playingCount = zones.filter((z) => z.state === "playing").length;

  return (
    <div className="h-full overflow-y-auto bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Music className="h-6 w-6 text-[#FFE600]" />
            Sonos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.discovered.length
              ? `${data.discovered.length} Gerät${data.discovered.length !== 1 ? "e" : ""} gefunden`
              : "Suche Sonos-Geräte..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status */}
          {data?.scanning ? (
            <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin" /> Suche...
            </Badge>
          ) : data?.discovered.length ? (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/30 gap-1.5">
              <Wifi className="h-3 w-3" /> {playingCount > 0 ? `${playingCount} spielt` : "Verbunden"}
            </Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/30 gap-1.5">
              <WifiOff className="h-3 w-3" /> Keine Geräte
            </Badge>
          )}

          <Button
            size="sm"
            variant="outline"
            className="border-[#333] text-gray-400 hover:text-white gap-1.5"
            onClick={() => discover.mutate()}
            disabled={discover.isPending || data?.scanning}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${discover.isPending ? "animate-spin" : ""}`} />
            Erneut suchen
          </Button>
        </div>
      </div>

      {/* Error */}
      {data?.error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {data.error}
          <p className="text-xs text-red-400/60 mt-1">
            Stelle sicher, dass Sonos-Geräte im Netzwerk {data.error.includes("192.168.1") ? "" : "(192.168.1.x) "}aktiv sind.
          </p>
        </div>
      )}

      {/* Scanning state */}
      {(isLoading || data?.scanning) && zones.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16">
          <RefreshCw className="h-8 w-8 text-[#FFE600] animate-spin" />
          <p className="text-gray-500">Suche Sonos-Geräte im Netzwerk 192.168.1.x...</p>
          <p className="text-xs text-gray-600">Scanne 254 IPs auf Port 1400</p>
        </div>
      )}

      {/* No zones found */}
      {!isLoading && !data?.scanning && zones.length === 0 && !data?.error && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Music className="h-8 w-8 text-gray-600" />
          <p className="text-gray-500">Keine Sonos-Geräte gefunden</p>
          <Button
            variant="outline"
            className="border-[#333] text-gray-400 hover:text-white gap-1.5"
            onClick={() => discover.mutate()}
          >
            <RefreshCw className="h-4 w-4" /> Nochmal suchen
          </Button>
        </div>
      )}

      {/* Zone cards */}
      {zones.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              allZones={zones}
              onPlay={(ip) => command.mutate({ ip, action: "play" })}
              onPause={(ip) => command.mutate({ ip, action: "pause" })}
              onNext={(ip) => command.mutate({ ip, action: "next" })}
              onPrev={(ip) => command.mutate({ ip, action: "previous" })}
              onVolume={(ip, volume) => command.mutate({ ip, action: "volume", body: { volume } })}
              onMute={(ip, muted) => command.mutate({ ip, action: "mute", body: { muted } })}
            />
          ))}
        </div>
      )}

      {/* Footer info */}
      {data?.lastPoll && (
        <p className="text-[10px] text-gray-700 mt-6 text-center">
          Aktualisiert {new Date(data.lastPoll).toLocaleTimeString("de-CH")} — Intervall: 3s
        </p>
      )}
    </div>
  );
}
