import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Camera, Video, Maximize2, Minimize2, RefreshCw,
  Grid2x2, Grid3x3, LayoutGrid, Monitor, ExternalLink,
  Wifi, WifiOff, CircleDot,
} from "lucide-react";
import {
  useDahuaChannels,
  useSnapshotRefresh,
  useDahuaConnectionTest,
  getMjpegStreamUrl,
  getWebInterfaceUrl,
  getDahuaIp,
} from "@/hooks/use-dahua-data";

// ─── Types ──────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "2x2" | "single";

// ─── Camera Tile ────────────────────────────────────────────────────────────

function CameraTile({
  channel,
  name,
  onFullscreen,
  useMjpeg,
}: {
  channel: number;
  name: string;
  onFullscreen: (channel: number) => void;
  useMjpeg: boolean;
}) {
  const { url, error, onError, onLoad, refresh } = useSnapshotRefresh(channel, 5000);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleLoad = useCallback(() => {
    onLoad();
    setImgLoaded(true);
  }, [onLoad]);

  const streamSrc = useMjpeg ? getMjpegStreamUrl(channel) : url;

  return (
    <div className="relative group bg-black rounded-lg overflow-hidden aspect-video">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900">
          <WifiOff className="h-8 w-8 text-zinc-600" />
          <span className="text-xs text-zinc-500">Kanal {channel} — Kein Signal</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-zinc-400 hover:text-white"
            onClick={() => refresh()}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Erneut versuchen
          </Button>
        </div>
      ) : (
        <>
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
              <div className="animate-pulse text-xs text-zinc-500">Lade...</div>
            </div>
          )}
          <img
            src={streamSrc}
            alt={name}
            className="w-full h-full object-contain"
            onError={onError}
            onLoad={handleLoad}
          />
        </>
      )}

      {/* Overlay: channel name + controls */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5">
          <CircleDot className={`h-2.5 w-2.5 ${error ? "text-red-400" : "text-green-400"}`} />
          <span className="text-[11px] text-white font-medium">{name}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => refresh()}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => onFullscreen(channel)}
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Bottom: live indicator */}
      {!error && (
        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Badge className="bg-red-600/80 text-white text-[9px] px-1.5 py-0 border-0 gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </Badge>
        </div>
      )}
    </div>
  );
}

// ─── Fullscreen View ────────────────────────────────────────────────────────

function FullscreenView({
  channel,
  name,
  onClose,
}: {
  channel: number;
  name: string;
  onClose: () => void;
}) {
  const { url, error, onError, onLoad, refresh } = useSnapshotRefresh(channel, 3000);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-[#FFE600]" />
          <span className="text-sm font-medium text-white">{name}</span>
          {!error && (
            <Badge className="bg-red-600/80 text-white text-[9px] px-1.5 py-0 border-0 gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white"
            onClick={() => refresh()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white"
            onClick={onClose}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <WifiOff className="h-12 w-12" />
            <span>Kein Signal von Kanal {channel}</span>
            <Button variant="secondary" size="sm" onClick={() => refresh()}>
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Erneut versuchen
            </Button>
          </div>
        ) : (
          <img
            src={url}
            alt={name}
            className="max-w-full max-h-full object-contain rounded"
            onError={onError}
            onLoad={onLoad}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function Videoanlage() {
  const { channels } = useDahuaChannels();
  const { reachable, loading: connLoading, testConnection } = useDahuaConnectionTest();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [fullscreenChannel, setFullscreenChannel] = useState<number | null>(null);
  const [visibleChannels, setVisibleChannels] = useState(8);
  const [useMjpeg] = useState(false);

  const displayChannels = channels.slice(0, visibleChannels);

  const gridClass =
    viewMode === "single"
      ? "grid-cols-1 max-w-3xl mx-auto"
      : viewMode === "2x2"
      ? "grid-cols-1 md:grid-cols-2"
      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  const fullscreenName =
    fullscreenChannel !== null
      ? channels.find((c) => c.channel === fullscreenChannel)?.name ?? `Kanal ${fullscreenChannel}`
      : "";

  return (
    <div className="p-4 md:p-6 space-y-5 overflow-y-auto h-full">
      {/* Fullscreen overlay */}
      {fullscreenChannel !== null && (
        <FullscreenView
          channel={fullscreenChannel}
          name={fullscreenName}
          onClose={() => setFullscreenChannel(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Video className="h-5 w-5 text-[#FFE600]" />
            Videoanlage
          </h1>
          <p className="text-sm text-muted-foreground">
            Dahua DMSS — {getDahuaIp()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={`text-xs gap-1.5 ${
              connLoading
                ? "text-muted-foreground"
                : reachable
                ? "text-green-400 border-green-400/20"
                : "text-red-400 border-red-400/20"
            }`}
          >
            {connLoading ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                Verbinde...
              </>
            ) : reachable ? (
              <>
                <Wifi className="h-3 w-3" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Nicht erreichbar
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "2x2" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode("2x2")}
          >
            <Grid2x2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "single" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode("single")}
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-muted-foreground">Kanäle:</span>
          {[4, 8].map((n) => (
            <Button
              key={n}
              variant={visibleChannels === n ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setVisibleChannels(n)}
            >
              {n}
            </Button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={testConnection}
        >
          <RefreshCw className={`h-3 w-3 ${connLoading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>

        <a
          href={getWebInterfaceUrl()}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <ExternalLink className="h-3 w-3" />
            Web-Interface
          </Button>
        </a>
      </div>

      {/* Camera Grid */}
      {reachable === false && !connLoading ? (
        <Card className="border-dashed">
          <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
            <WifiOff className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Videoanlage nicht erreichbar</p>
              <p className="text-sm text-muted-foreground mt-1">
                Stelle sicher, dass du mit dem Heimnetzwerk verbunden bist
                und das Gerät unter {getDahuaIp()} erreichbar ist.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={testConnection}>
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={`grid ${gridClass} gap-3`}>
          {displayChannels.map((ch) => (
            <CameraTile
              key={ch.channel}
              channel={ch.channel}
              name={ch.name}
              onFullscreen={setFullscreenChannel}
              useMjpeg={useMjpeg}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Camera className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium">Dahua DMSS Videoanlage</p>
              <p className="text-muted-foreground text-xs">
                Snapshots werden alle 5 Sekunden aktualisiert. Für Echtzeit-Video öffne
                das Web-Interface direkt. Die Kameras sind nur im Heimnetzwerk erreichbar.
              </p>
              <p className="text-muted-foreground text-xs">
                Klicke auf eine Kamera und dann auf das Vollbild-Icon für eine vergrösserte Ansicht.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
