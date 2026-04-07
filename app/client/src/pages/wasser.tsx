import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Droplets, Thermometer, Waves, Timer, Power, Info, TrendingDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface PoolFeature {
  name: string;
  active: boolean;
  description: string;
}

const usageData = Array.from({ length: 7 }, (_, i) => {
  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  return {
    day: days[i],
    usage: 180 + Math.round(Math.random() * 120),
  };
});

export default function Wasser() {
  const [features, setFeatures] = useState<PoolFeature[]>([
    { name: "Gegenstromanlage", active: false, description: "Schwimmstrom 45 m³/h" },
    { name: "Massagedüsen", active: false, description: "6 Düsen, einstellbare Stärke" },
    { name: "Bodenreinigung", active: true, description: "Automatischer Zyklus" },
    { name: "Beleuchtung Pool", active: false, description: "RGB LED Unterwasser" },
    { name: "Umwälzpumpe", active: true, description: "Filterung & Zirkulation" },
    { name: "Heizung", active: true, description: "Wärmepumpe Solar-unterstützt" },
  ]);

  const toggleFeature = (index: number) => {
    const updated = [...features];
    updated[index].active = !updated[index].active;
    setFeatures(updated);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Wasser</h1>
          <p className="text-sm text-muted-foreground">Pool & Wassersteuerung — MyFluvo</p>
        </div>
        <Badge variant="secondary" className="text-blue-400 border-blue-400/20">
          <Waves className="h-3 w-3 mr-1" /> Online
        </Badge>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">Wassertemperatur</span>
            </div>
            <div className="text-2xl font-semibold tabular-nums">26.4<span className="text-sm">°C</span></div>
            <div className="text-xs text-muted-foreground mt-1">Ziel: 27°C</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">pH-Wert</span>
            </div>
            <div className="text-2xl font-semibold tabular-nums">7.2</div>
            <Badge variant="secondary" className="text-xs text-green-400 mt-1">Optimal</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Filterlaufzeit</span>
            </div>
            <div className="text-2xl font-semibold tabular-nums">6.2<span className="text-sm">h</span></div>
            <div className="text-xs text-muted-foreground mt-1">Heute / 8h Ziel</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Power className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Energieverbrauch</span>
            </div>
            <div className="text-2xl font-semibold tabular-nums">3.8<span className="text-sm">kWh</span></div>
            <div className="flex items-center gap-1 mt-1 text-xs text-green-400">
              <TrendingDown className="h-3 w-3" /> -12%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pool Features Control */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pool Steuerung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {features.map((feature, i) => (
              <div
                key={feature.name}
                className="flex items-center justify-between py-3 border-b last:border-0"
                data-testid={`pool-feature-${i}`}
              >
                <div>
                  <div className="text-sm font-medium">{feature.name}</div>
                  <div className="text-xs text-muted-foreground">{feature.description}</div>
                </div>
                <Switch
                  checked={feature.active}
                  onCheckedChange={() => toggleFeature(i)}
                  data-testid={`switch-pool-${feature.name.toLowerCase().replace(/\s+/g, "-")}`}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Water Usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Wasserverbrauch (Liter/Tag)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 20%)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(215, 12%, 50%)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(215, 12%, 50%)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(215, 25%, 12%)",
                      border: "1px solid hsl(215, 20%, 20%)",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value} L`, "Verbrauch"]}
                  />
                  <Bar dataKey="usage" fill="hsl(199, 89%, 48%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fluvo Info */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">MyFluvo — Pool Control by Fluvo</p>
              <p className="text-muted-foreground text-xs mt-1">
                MyFluvo ist ein Pool-Steuerungssystem für Gegenstromanlage, Massagedüsen und weitere Wasserattraktionen.
                Aktuell werden Demo-Daten angezeigt.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
