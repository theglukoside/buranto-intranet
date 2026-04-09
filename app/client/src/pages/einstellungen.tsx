import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import {
  Sun, Moon, Key, Shield, Save, Eye, EyeOff,
  Zap, Home, Car, Droplets, WifiOff, CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ApiCredential } from "@shared/schema";
import { useSolarStream, useSolarGatewayInfo, useSolarContext } from "@/hooks/use-solar-data";
import { useDigitalstromStatus, useDigitalstromContext } from "@/hooks/use-digitalstrom-data";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className ?? ""}`} />;
}

// ─── Solar Manager Status Section ─────────────────────────────────────────────

function SolarManagerStatus() {
  const { smId } = useSolarContext();
  const { data: streamData, loading: streamLoading, error: streamError, lastUpdate } = useSolarStream();
  const { info, loading: infoLoading, error: infoError } = useSolarGatewayInfo();

  const isConnected = !streamError && (streamLoading || streamData !== null);
  const hasError = !!streamError;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-400" />
            Solar Manager
          </div>
          {streamLoading && !streamData ? (
            <Badge variant="outline" className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Verbinde…
            </Badge>
          ) : hasError ? (
            <Badge variant="outline" className="text-xs text-red-400 border-red-400/30">
              <WifiOff className="h-3 w-3 mr-1" />
              Getrennt
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verbunden
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* SM ID */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">SM ID</span>
          <span className="font-mono text-xs font-medium">{smId}</span>
        </div>

        {/* Gateway firmware */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Firmware</span>
          {infoLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : infoError ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <span className="font-mono text-xs font-medium">
              {(info as Record<string, unknown>)?.firmwareVersion as string
                ?? (info as Record<string, unknown>)?.firmware_version as string
                ?? (info as Record<string, unknown>)?.version as string
                ?? "—"}
            </span>
          )}
        </div>

        {/* Gateway IP */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Gateway IP</span>
          {infoLoading ? (
            <Skeleton className="h-4 w-28" />
          ) : infoError ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <span className="font-mono text-xs font-medium">
              {(info as Record<string, unknown>)?.ip as string
                ?? (info as Record<string, unknown>)?.ipAddress as string
                ?? "—"}
            </span>
          )}
        </div>

        {/* Last update */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Letzte Aktualisierung</span>
          <span className="text-xs font-medium tabular-nums">
            {lastUpdate
              ? lastUpdate.toLocaleTimeString("de-CH", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "—"}
          </span>
        </div>

        {/* Connection info note */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Zugangsdaten sind in der App hinterlegt und werden direkt vom Browser verwendet.
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Digitalstrom Bridge Status Section ───────────────────────────────────────

function DigitalstromBridgeStatus() {
  const { configured } = useDigitalstromContext();
  const { status, loading } = useDigitalstromStatus();

  const isConnected = configured && status?.dss_reachable;
  const lastPoll = status?.last_poll_at
    ? new Date(status.last_poll_at).toLocaleTimeString("de-CH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-blue-400" />
            Digitalstrom Bridge
          </div>
          {!configured ? (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Nicht konfiguriert
            </Badge>
          ) : loading ? (
            <Badge variant="outline" className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Verbinde…
            </Badge>
          ) : isConnected ? (
            <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verbunden
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-red-400 border-red-400/30">
              <WifiOff className="h-3 w-3 mr-1" />
              Getrennt
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">dSS Server</span>
          <span className="font-mono text-xs font-medium">192.168.1.129:8080</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Bridge Version</span>
          <span className="font-mono text-xs font-medium">
            {status?.bridge_version ?? "—"}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Letzte Abfrage</span>
          <span className="text-xs font-medium tabular-nums">{lastPoll}</span>
        </div>

        {status?.last_error && (
          <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded">
            {status.last_error}
          </div>
        )}

        <div className="pt-2 border-t text-xs text-muted-foreground">
          Bridge läuft als Docker-Container auf dem Synology NAS und pollt den dSS alle 30 Sekunden.
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Service configs ──────────────────────────────────────────────────────────

interface ServiceConfig {
  service: string;
  label: string;
  icon: React.ElementType;
  fields: { key: string; label: string; type: string }[];
}

const services: ServiceConfig[] = [
  {
    service: "digitalstrom",
    label: "Digitalstrom",
    icon: Home,
    fields: [
      { key: "serverIp", label: "Server IP", type: "text" },
      { key: "token", label: "App Token", type: "password" },
    ],
  },
  {
    service: "doorbird",
    label: "DoorBird Türklingel",
    icon: Car,
    fields: [
      { key: "ip", label: "IP-Adresse (z.B. 192.168.1.x)", type: "text" },
      { key: "username", label: "Benutzername", type: "text" },
      { key: "password", label: "Passwort", type: "password" },
    ],
  },
  {
    service: "porsche-connect",
    label: "Porsche Connect (Taycan & Cayenne)",
    icon: Car,
    fields: [
      { key: "username", label: "Porsche ID E-Mail", type: "email" },
      { key: "password", label: "Passwort", type: "password" },
    ],
  },
  {
    service: "bmw-connected",
    label: "BMW Connected Drive (Mini JCW)",
    icon: Car,
    fields: [
      { key: "username", label: "MyMINI E-Mail", type: "email" },
      { key: "password", label: "Passwort", type: "password" },
    ],
  },
  {
    service: "elektra",
    label: "Elektra Sissach",
    icon: Zap,
    fields: [
      { key: "username", label: "Benutzername", type: "text" },
      { key: "password", label: "Passwort", type: "password" },
    ],
  },
];

function CredentialForm({ config }: { config: ServiceConfig }) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState(false);

  const { data: credentials = [] } = useQuery<ApiCredential[]>({
    queryKey: ["/api/credentials"],
  });

  const existing = credentials.find((c) => c.service === config.service);

  const saveMutation = useMutation({
    mutationFn: (data: { service: string; credentials: Record<string, string> }) =>
      apiRequest("POST", "/api/credentials", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      toast({ title: "Gespeichert", description: `${config.label} Zugangsdaten aktualisiert.` });
    },
  });

  const handleSave = () => {
    const filteredValues = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v && v.length > 0)
    );
    if (Object.keys(filteredValues).length === 0) return;
    saveMutation.mutate({ service: config.service, credentials: filteredValues });
    setValues({});
  };

  return (
    <Card data-testid={`card-credential-${config.service}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <config.icon className="h-4 w-4 text-muted-foreground" />
            {config.label}
          </div>
          <Badge variant={existing ? "secondary" : "outline"} className="text-xs">
            {existing ? "Konfiguriert" : "Nicht verbunden"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {config.fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-xs text-muted-foreground">{field.label}</label>
            <div className="relative">
              <Input
                type={showPasswords || field.type !== "password" ? "text" : "password"}
                value={values[field.key] || ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={existing ? "••••••••" : `${field.label} eingeben`}
                className="text-sm"
                data-testid={`input-${config.service}-${field.key}`}
              />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPasswords(!showPasswords)}
              className="text-xs"
            >
              {showPasswords ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
              {showPasswords ? "Verbergen" : "Anzeigen"}
            </Button>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid={`button-save-${config.service}`}
          >
            <Save className="h-3.5 w-3.5 mr-1" /> Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Einstellungen() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiRequest("POST", "/api/auth/change-password", data),
    onSuccess: () => {
      toast({ title: "Erfolg", description: "Passwort wurde geändert." });
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: () => {
      toast({ title: "Fehler", description: "Aktuelles Passwort ist falsch.", variant: "destructive" });
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-xl font-semibold">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">System- und API-Konfiguration</p>
      </div>

      {/* App Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Theme */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              Darstellung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">Dark Mode</div>
                <div className="text-xs text-muted-foreground">Dunkles Design für Dashboard</div>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={toggleTheme}
                data-testid="switch-dark-mode"
              />
            </div>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              App-Passwort
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Aktuelles Passwort</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Neues Passwort</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
            </div>
            <Button
              size="sm"
              onClick={() => changePasswordMutation.mutate({ currentPassword, newPassword })}
              disabled={!currentPassword || !newPassword || changePasswordMutation.isPending}
              data-testid="button-change-password"
            >
              <Key className="h-3.5 w-3.5 mr-1" /> Passwort ändern
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Language */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Sprache</div>
            <div className="text-xs text-muted-foreground">Aktuell nur Deutsch verfügbar</div>
          </div>
          <Badge variant="secondary">Deutsch</Badge>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Verbundene Dienste</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SolarManagerStatus />
          <DigitalstromBridgeStatus />
        </div>
      </div>

      {/* Other API Credentials */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">API-Zugangsdaten</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((svc) => (
            <CredentialForm key={svc.service} config={svc} />
          ))}
        </div>
      </div>
    </div>
  );
}
