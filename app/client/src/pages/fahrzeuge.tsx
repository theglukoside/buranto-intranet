import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Car, Fuel, MapPin, Wrench, Gauge, Thermometer, Info, CircleDot,
} from "lucide-react";

interface Vehicle {
  brand: string;
  model: string;
  color: string;
  plate: string;
  mileage: string;
  fuelLevel: number;
  fuelType: string;
  serviceStatus: string;
  nextService: string;
  tirePressure: { fl: number; fr: number; rl: number; rr: number };
  location: string;
  locked: boolean;
  temperature: number;
  apiNote: string;
}

const vehicles: Vehicle[] = [
  {
    brand: "Porsche",
    model: "Cayenne E-Hybrid",
    color: "Schwarz",
    plate: "BL 42XXX",
    mileage: "34'280 km",
    fuelLevel: 68,
    fuelType: "Hybrid (Benzin + Elektro)",
    serviceStatus: "In Ordnung",
    nextService: "Bei 40'000 km oder Dez. 2026",
    tirePressure: { fl: 2.4, fr: 2.4, rl: 2.6, rr: 2.6 },
    location: "Zuhause — Sissach",
    locked: true,
    temperature: 18,
    apiNote: "Porsche Connect API (pyporscheconnectapi)",
  },
  {
    brand: "Mini",
    model: "Cooper SE",
    color: "British Racing Green",
    plate: "BL 38XXX",
    mileage: "21'450 km",
    fuelLevel: 82,
    fuelType: "Elektrisch",
    serviceStatus: "In Ordnung",
    nextService: "Bei 30'000 km oder Sep. 2026",
    tirePressure: { fl: 2.3, fr: 2.3, rl: 2.5, rr: 2.5 },
    location: "Zuhause — Sissach",
    locked: true,
    temperature: 17,
    apiNote: "BMW/Mini Connected Drive (bimmer_connected)",
  },
];

function TirePressureDisplay({ pressure }: { pressure: Vehicle["tirePressure"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex items-center gap-1.5 justify-center p-2 bg-muted/50 rounded">
        <CircleDot className="h-3 w-3 text-muted-foreground" />
        <span className="tabular-nums">{pressure.fl} bar</span>
      </div>
      <div className="flex items-center gap-1.5 justify-center p-2 bg-muted/50 rounded">
        <CircleDot className="h-3 w-3 text-muted-foreground" />
        <span className="tabular-nums">{pressure.fr} bar</span>
      </div>
      <div className="flex items-center gap-1.5 justify-center p-2 bg-muted/50 rounded">
        <CircleDot className="h-3 w-3 text-muted-foreground" />
        <span className="tabular-nums">{pressure.rl} bar</span>
      </div>
      <div className="flex items-center gap-1.5 justify-center p-2 bg-muted/50 rounded">
        <CircleDot className="h-3 w-3 text-muted-foreground" />
        <span className="tabular-nums">{pressure.rr} bar</span>
      </div>
      <div className="text-[10px] text-muted-foreground col-span-2 text-center">VL / VR / HL / HR</div>
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Card data-testid={`card-vehicle-${vehicle.brand.toLowerCase()}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            {vehicle.brand} {vehicle.model}
          </div>
          <Badge variant={vehicle.locked ? "secondary" : "destructive"} className="text-xs">
            {vehicle.locked ? "Verriegelt" : "Offen"}
          </Badge>
        </CardTitle>
        <div className="text-xs text-muted-foreground">
          {vehicle.color} — {vehicle.plate}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gauge className="h-3 w-3" /> Kilometerstand
            </div>
            <div className="text-sm font-medium tabular-nums">{vehicle.mileage}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Fuel className="h-3 w-3" /> {vehicle.fuelType.includes("Elektro") || vehicle.fuelType.includes("Elektrisch") ? "Ladezustand" : "Tankfüllung"}
            </div>
            <div className="flex items-center gap-2">
              <Progress value={vehicle.fuelLevel} className="h-2 flex-1" />
              <span className="text-sm font-medium tabular-nums">{vehicle.fuelLevel}%</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wrench className="h-3 w-3" /> Service
            </div>
            <div className="text-sm font-medium">{vehicle.serviceStatus}</div>
            <div className="text-[11px] text-muted-foreground">{vehicle.nextService}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> Standort
            </div>
            <div className="text-sm font-medium">{vehicle.location}</div>
          </div>
        </div>

        {/* Tire Pressure */}
        <div>
          <div className="text-xs text-muted-foreground mb-2">Reifendruck</div>
          <TirePressureDisplay pressure={vehicle.tirePressure} />
        </div>

        {/* Temperature */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Thermometer className="h-3 w-3" /> Innentemperatur
          </div>
          <span className="text-sm font-medium tabular-nums">{vehicle.temperature}°C</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Fahrzeuge() {
  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-xl font-semibold">Fahrzeuge</h1>
        <p className="text-sm text-muted-foreground">Fahrzeugstatus & -verwaltung</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {vehicles.map((v) => (
          <VehicleCard key={v.brand} vehicle={v} />
        ))}
      </div>

      {/* API Info */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm space-y-2">
              <p className="font-medium">Fahrzeug-APIs</p>
              {vehicles.map((v) => (
                <p key={v.brand} className="text-muted-foreground text-xs">
                  <span className="text-foreground">{v.brand}:</span> {v.apiNote}.
                  Zugangsdaten in den <span className="text-primary">Einstellungen</span> konfigurieren.
                </p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
