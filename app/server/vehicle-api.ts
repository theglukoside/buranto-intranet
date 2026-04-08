/**
 * Vehicle API Service
 * Integrates Porsche Connect API (Taycan, Cayenne) and BMW Connected Drive (Mini JCW)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VehicleApiData {
  vin: string;
  model: string;
  brand: "PORSCHE" | "BMW" | "MINI";
  year?: number;
  color?: string;
  mileage?: number;           // km
  fuelLevel?: number;         // % (combustion/hybrid)
  batteryLevel?: number;      // % (EV/hybrid electric)
  electricRange?: number;     // km
  combustionRange?: number;   // km
  isCharging?: boolean;
  chargingStatus?: string;
  remainingChargingTime?: number; // minutes
  chargingPower?: number;     // kW
  doors?: {
    locked: boolean;
    frontLeft?: string;
    frontRight?: string;
    rearLeft?: string;
    rearRight?: string;
    trunk?: string;
    hood?: string;
  };
  windows?: {
    frontLeft?: string;
    frontRight?: string;
  };
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  tirePressure?: {
    frontLeft?: number;
    frontRight?: number;
    rearLeft?: number;
    rearRight?: number;
  };
  serviceAlerts?: string[];
  nextService?: string;
  lastUpdated: Date;
  error?: string;
}

export interface VehicleCache {
  data: VehicleApiData[];
  lastFetch: Date | null;
  error: string | null;
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

const porscheCache: VehicleCache = { data: [], lastFetch: null, error: null };
const bmwCache: VehicleCache = { data: [], lastFetch: null, error: null };

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Porsche Connect ─────────────────────────────────────────────────────────

export async function fetchPorscheData(
  username: string,
  password: string,
  forceRefresh = false
): Promise<VehicleCache> {
  const now = new Date();

  // Return cached if fresh enough
  if (
    !forceRefresh &&
    porscheCache.lastFetch &&
    now.getTime() - porscheCache.lastFetch.getTime() < CACHE_TTL_MS &&
    porscheCache.data.length > 0
  ) {
    return porscheCache;
  }

  try {
    // Dynamic import to avoid startup errors if package is missing
    const { default: PorscheConnect } = await import("porsche-connect");
    const client = new PorscheConnect({ username, password });

    const vehicles = await client.getVehicles();
    const results: VehicleApiData[] = [];

    for (const vehicle of vehicles) {
      try {
        const overview = await vehicle.getStoredOverview().catch(() => null);
        let emobility = null;
        try {
          emobility = await vehicle.getEmobilityInfo();
        } catch {
          // Not available for non-EV/PHEV
        }

        let position = null;
        try {
          position = await vehicle.getPosition();
        } catch {
          // Not always available
        }

        const data: VehicleApiData = {
          vin: vehicle.vin,
          model: vehicle.modelDescription || vehicle.modelType?.split("_").join(" ") || "Unknown",
          brand: "PORSCHE",
          lastUpdated: now,
        };

        if (overview) {
          // Mileage
          if (overview.odometerStatus?.value) {
            data.mileage = Math.round(overview.odometerStatus.value);
          }

          // Fuel level (combustion/hybrid)
          if (overview.fuelLevel?.value !== undefined) {
            data.fuelLevel = Math.round(overview.fuelLevel.value);
          }

          // Battery level (EV/PHEV)
          if (overview.batteryLevel?.value !== undefined) {
            data.batteryLevel = Math.round(overview.batteryLevel.value);
          }

          // Doors
          const d = overview.doors;
          if (d) {
            data.doors = {
              locked: d.overallLockStatus?.value === "CLOSED_LOCKED",
              frontLeft: d.frontLeftDoor?.value,
              frontRight: d.frontRightDoor?.value,
              rearLeft: d.rearLeftDoor?.value,
              rearRight: d.rearRightDoor?.value,
              trunk: d.trunk?.value,
              hood: d.hood?.value,
            };
          }

          // Windows
          const w = overview.windows;
          if (w) {
            data.windows = {
              frontLeft: w.frontLeft?.value,
              frontRight: w.frontRight?.value,
            };
          }

          // Service alerts
          if (overview.serviceIntervals) {
            data.serviceAlerts = overview.serviceIntervals
              .filter((si: any) => si.km?.value !== undefined || si.time?.value !== undefined)
              .map((si: any) => `${si.description?.shortName}: ${si.km?.value ? si.km.value + " km" : ""} ${si.time?.value ? "/ " + si.time.value + " Tage" : ""}`.trim());
          }
        }

        // E-Mobility (EV + PHEV)
        if (emobility) {
          const cs = emobility.batteryChargeStatus;
          if (cs) {
            data.batteryLevel = cs.stateOfChargeInPercent;
            data.isCharging = cs.plugState === "CONNECTED" && cs.lockState === "LOCKED_CHARGING";
            data.chargingStatus = cs.chargingStatus;
            data.remainingChargingTime = cs.remainingChargeTimeUntil100PercentInMinutes;
            if (cs.chargingPower !== undefined) {
              data.chargingPower = cs.chargingPower;
            }
          }
          if (emobility.remainingRanges?.electricalRange?.distance?.value) {
            data.electricRange = Math.round(emobility.remainingRanges.electricalRange.distance.value);
          }
          if (emobility.remainingRanges?.conventionalRange?.distance?.value) {
            data.combustionRange = Math.round(emobility.remainingRanges.conventionalRange.distance.value);
          }
        }

        // Position
        if (position?.carCoordinate) {
          data.location = {
            lat: position.carCoordinate.latitude,
            lng: position.carCoordinate.longitude,
          };
        }

        results.push(data);
      } catch (vehicleError: any) {
        results.push({
          vin: vehicle.vin,
          model: vehicle.modelDescription || "Porsche",
          brand: "PORSCHE",
          lastUpdated: now,
          error: vehicleError?.message || "Fehler beim Laden",
        });
      }
    }

    porscheCache.data = results;
    porscheCache.lastFetch = now;
    porscheCache.error = null;
    return porscheCache;
  } catch (err: any) {
    porscheCache.error = err?.message || "Verbindung zu Porsche Connect fehlgeschlagen";
    porscheCache.lastFetch = now;
    return porscheCache;
  }
}

// ─── BMW / Mini Connected Drive ───────────────────────────────────────────────
// Uses the unofficial BMW Connected Drive API (v4)
// Note: Initial login requires hCaptcha — token must be provided once

export async function fetchBmwData(
  username: string,
  password: string,
  region = "rest_of_world",
  forceRefresh = false
): Promise<VehicleCache> {
  const now = new Date();

  if (
    !forceRefresh &&
    bmwCache.lastFetch &&
    now.getTime() - bmwCache.lastFetch.getTime() < CACHE_TTL_MS &&
    bmwCache.data.length > 0
  ) {
    return bmwCache;
  }

  try {
    const { ConnectedDrive } = await import("nodejs-connected-drive");
    const api = new ConnectedDrive(username, password);
    const vehicles = await api.getVehicles();
    const results: VehicleApiData[] = [];

    for (const v of vehicles) {
      try {
        const status = await api.getStatusOfAllVehicles();
        const vehicleStatus = status.find((s: any) => s.vin === v.vin);

        const data: VehicleApiData = {
          vin: v.vin,
          model: v.attributes?.model || "Unknown",
          brand: (v.attributes?.brand === "MINI" ? "MINI" : "BMW") as "BMW" | "MINI",
          year: v.attributes?.year,
          lastUpdated: now,
        };

        if (vehicleStatus?.state) {
          const state = vehicleStatus.state;
          data.mileage = state.currentMileage;

          // Fuel
          if (state.combustionFuelLevel?.remainingFuelPercent !== undefined) {
            data.fuelLevel = state.combustionFuelLevel.remainingFuelPercent;
          }
          if (state.combustionFuelLevel?.range !== undefined) {
            data.combustionRange = state.combustionFuelLevel.range;
          }

          // EV
          if (state.electricChargingState?.chargingLevelHv !== undefined) {
            data.batteryLevel = state.electricChargingState.chargingLevelHv;
            data.isCharging = state.electricChargingState.chargingStatus === "CHARGING";
          }

          // Doors
          if (state.doorsState) {
            data.doors = {
              locked: state.doorsState.combinedSecurityState === "SECURED",
              frontLeft: state.doorsState.leftFront,
              frontRight: state.doorsState.rightFront,
              trunk: state.doorsState.trunk,
            };
          }

          // Location
          if (state.location?.coordinates) {
            data.location = {
              lat: state.location.coordinates.latitude,
              lng: state.location.coordinates.longitude,
              address: state.location.address?.formatted,
            };
          }
        }

        results.push(data);
      } catch (vehicleError: any) {
        results.push({
          vin: v.vin,
          model: v.attributes?.model || "Mini",
          brand: "MINI",
          lastUpdated: now,
          error: vehicleError?.message || "Fehler beim Laden",
        });
      }
    }

    bmwCache.data = results;
    bmwCache.lastFetch = now;
    bmwCache.error = null;
    return bmwCache;
  } catch (err: any) {
    bmwCache.error = err?.message || "Verbindung zu BMW Connected Drive fehlgeschlagen";
    bmwCache.lastFetch = now;
    return bmwCache;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export function getPorscheCache(): VehicleCache {
  return porscheCache;
}

export function getBmwCache(): VehicleCache {
  return bmwCache;
}
