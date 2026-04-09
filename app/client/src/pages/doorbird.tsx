import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DoorOpen, Camera, Wifi, WifiOff, RefreshCw,
  Settings, Lightbulb, AlertTriangle, CheckCircle, Lock,
  ExternalLink, Volume2,
} from "lucide-react";
import { Link } from "wouter";

// ─── Live Snapshot ────────────────────────────────────────────────────────────

function LiveCamera({ interval = 2000 }: { interval?: number }) {
  const [src, setSrc] = useState(`/api/doorbird/snapshot?t=${Date.now()}`);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    setSrc(`/api/doorbird/snapshot?t=${Date.now()}`);
    setError(false);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(refresh, interval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refresh, interval]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-[#0a0a0a] aspect-video">
      {/* Live badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
        <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs text-white font-medium bg-black/60 px-2 py-0.5 rounded-full">LIVE</span>
      </div>

      {/* Refresh button */}
      <button
        onClick={refresh}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>

      {/* Image */}
      {!error ? (
        <img
          key={src}
          src={src}
          alt="DoorBird Live"
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <Camera className="h-10 w-10 text-gray-600" />
          <p className="text-sm text-gray-500">Kein Bild verfügbar</p>
          <button onClick={refresh} className="text-xs text-[#FFE600] hover:underline">
            Erneut versuchen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Door Open Button ─────────────────────────────────────────────────────────

function DoorButton({ relay = "1" }: { relay?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);

  const open = useMutation({
    mutationFn: () =>
      fetch(`/api/doorbird/open/${relay}`, { method: "POST" }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.ok) {
        setSuccess(true);
        setConfirming(false);
        setTimeout(() => setSuccess(false), 4000);
      }
    },
    onError: () => setConfirming(false),
  });

  if (success) {
    return (
      <Button
        className="w-full h-14 text-base bg-green-500/20 text-green-400 border border-green-500/30 cursor-default"
        disabled
      >
        <CheckCircle className="h-5 w-5 mr-2" />
        Tür geöffnet
      </Button>
    );
  }

  if (confirming) {
    return (
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-14 border-[#333] text-gray-400 hover:text-white"
          onClick={() => setConfirming(false)}
        >
          Abbrechen
        </Button>
        <Button
          className="flex-1 h-14 text-base bg-[#FFE600] text-black hover:bg-[#FFE600]/90 font-bold"
          onClick={() => open.mutate()}
          disabled={open.isPending}
        >
          {open.isPending ? (
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <DoorOpen className="h-5 w-5 mr-2" />
          )}
          Ja, öffnen
        </Button>
      </div>
    );
  }

  return (
    <Button
      className="w-full h-14 text-base bg-[#FFE600] text-black hover:bg-[#FFE600]/90 font-bold gap-2"
      onClick={() => setConfirming(true)}
    >
      <DoorOpen className="h-5 w-5" />
      Tür öffnen
    </Button>
  );
}

// ─── Light Button ─────────────────────────────────────────────────────────────

function LightButton() {
  const [success, setSuccess] = useState(false);

  const light = useMutation({
    mutationFn: () =>
      fetch("/api/doorbird/light", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  return (
    <Button
      variant="outline"
      className={`w-full h-12 border-[#333] gap-2 ${success ? "text-yellow-400 border-yellow-400/30" : "text-gray-400 hover:text-white"}`}
      onClick={() => light.mutate()}
      disabled={light.isPending}
    >
      <Lightbulb className={`h-4 w-4 ${success ? "text-yellow-400" : ""}`} />
      {success ? "Licht aktiviert" : "Licht einschalten"}
    </Button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DoorBird() {
  const { data: info } = useQuery({
    queryKey: ["/api/doorbird/info"],
    queryFn: () => fetch("/api/doorbird/info").then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const configured = info?.configured !== false;
  const reachable = info?.reachable === true;
  const deviceInfo = info?.info?.BHA?.DEVICE_INFO;

  return (
    <div className="h-full overflow-y-auto bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DoorOpen className="h-6 w-6 text-[#FFE600]" />
            DoorBird
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {deviceInfo?.DEVICE_TYPE
              ? `${deviceInfo.DEVICE_TYPE} — ${deviceInfo.FIRMWARE_VERSION || ""}`
              : "Türklingel & Zugang"}
          </p>
        </div>

        {/* Status */}
        {configured ? (
          reachable ? (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/30 gap-1.5">
              <Wifi className="h-3 w-3" /> Online
            </Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/30 gap-1.5">
              <WifiOff className="h-3 w-3" /> Nicht erreichbar
            </Badge>
          )
        ) : (
          <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 gap-1.5">
            <Settings className="h-3 w-3" /> Nicht konfiguriert
          </Badge>
        )}
      </div>

      {/* Not configured */}
      {!configured && (
        <Card className="bg-[#111] border-[#FFE600]/20 mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-[#FFE600] mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">DoorBird konfigurieren</p>
                <p className="text-xs text-gray-500 mt-1">
                  Trage IP-Adresse, Benutzername und Passwort in den{" "}
                  <Link href="/einstellungen" className="text-[#FFE600] hover:underline">
                    Einstellungen
                  </Link>{" "}
                  ein.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera — large */}
        <div className="lg:col-span-2">
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-3">
              {configured ? (
                <LiveCamera interval={2000} />
              ) : (
                <div className="aspect-video rounded-xl bg-[#0a0a0a] flex flex-col items-center justify-center gap-2">
                  <Camera className="h-10 w-10 text-gray-700" />
                  <p className="text-sm text-gray-600">Kamera nicht konfiguriert</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4">
          {/* Door opener card */}
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-4 w-4 text-[#FFE600]" />
                <span className="text-sm font-semibold text-white">Zugang</span>
              </div>
              <DoorButton relay="1" />

              {/* Warning */}
              <div className="mt-3 flex items-start gap-2 text-xs text-gray-600">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Tür öffnet das Hauptrelais für ca. 3 Sekunden</span>
              </div>
            </CardContent>
          </Card>

          {/* Light card */}
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-semibold text-white">Beleuchtung</span>
              </div>
              <LightButton />
            </CardContent>
          </Card>

          {/* Device info */}
          {/* DoorBird App Deeplinks */}
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-4">
                <ExternalLink className="h-4 w-4 text-[#FFE600]" />
                <span className="text-sm font-semibold text-white">DoorBird App</span>
              </div>
              <div className="flex flex-col gap-2">
                {/* Live View */}
                <a
                  href={deviceInfo?.DEVICE_TYPE
                    ? `doorbird://live/${info?.info?.BHA?.VERSION?.[0]?.DEVICE_TYPE || ""}`
                    : "doorbird://"}
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-md bg-white/5 border border-[#333] text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Camera className="h-4 w-4" />
                  Live-Ansicht öffnen
                </a>
                {/* Bell / Chime settings */}
                <a
                  href="doorbird://"
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-md bg-white/5 border border-[#333] text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Volume2 className="h-4 w-4" />
                  A1061 Glocke konfigurieren
                </a>
              </div>
              <p className="text-[10px] text-gray-600 mt-3">
                Öffnet die DoorBird App direkt auf dem Gerät
              </p>
            </CardContent>
          </Card>

          {/* Device info */}
          {deviceInfo && (
            <Card className="bg-[#111] border-[#222]">
              <CardContent className="pt-4 pb-4 space-y-2">
                {[
                  ["Gerät", deviceInfo.DEVICE_TYPE],
                  ["Firmware", deviceInfo.FIRMWARE_VERSION],
                  ["Aufbau", deviceInfo.BUILD_NUMBER],
                ].map(([label, value]) =>
                  value ? (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-gray-300">{value}</span>
                    </div>
                  ) : null
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
