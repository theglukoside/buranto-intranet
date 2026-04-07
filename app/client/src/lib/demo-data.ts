// Realistic demo data for the Buranto Intranet

export const solarData = {
  currentProduction: 4280,
  currentConsumption: 2150,
  batteryLevel: 72,
  gridFeedIn: 1830,
  gridImport: 0,
  dailyProduction: 28.4,
  dailyConsumption: 18.7,
  dailySelfConsumption: 65,
};

export const solarHourlyData = [
  { time: "06:00", production: 120, consumption: 380 },
  { time: "07:00", production: 540, consumption: 820 },
  { time: "08:00", production: 1280, consumption: 1450 },
  { time: "09:00", production: 2640, consumption: 1200 },
  { time: "10:00", production: 3890, consumption: 1580 },
  { time: "11:00", production: 4520, consumption: 2100 },
  { time: "12:00", production: 4800, consumption: 2850 },
  { time: "13:00", production: 4650, consumption: 1920 },
  { time: "14:00", production: 4280, consumption: 2150 },
  { time: "15:00", production: 3600, consumption: 1800 },
  { time: "16:00", production: 2400, consumption: 2200 },
  { time: "17:00", production: 1200, consumption: 2800 },
  { time: "18:00", production: 450, consumption: 3200 },
  { time: "19:00", production: 80, consumption: 2600 },
  { time: "20:00", production: 0, consumption: 1800 },
];

export const weatherData = {
  location: "Sissach, BL",
  temperature: 18,
  condition: "Teilweise bewölkt",
  humidity: 62,
  wind: 12,
  forecast: [
    { day: "Di", temp: 18, icon: "cloud-sun" },
    { day: "Mi", temp: 21, icon: "sun" },
    { day: "Do", temp: 19, icon: "cloud" },
    { day: "Fr", temp: 16, icon: "cloud-rain" },
    { day: "Sa", temp: 20, icon: "sun" },
  ],
};

export const digitalstromRooms = [
  { id: 1, name: "Wohnzimmer", lights: true, blindsOpen: 80, temperature: 22.4, consumption: 320, scenes: ["Abend", "Film", "Hell"] },
  { id: 2, name: "Küche", lights: true, blindsOpen: 100, temperature: 21.8, consumption: 580, scenes: ["Kochen", "Essen", "Nacht"] },
  { id: 3, name: "Schlafzimmer", lights: false, blindsOpen: 30, temperature: 19.5, consumption: 45, scenes: ["Nacht", "Morgen", "Lesen"] },
  { id: 4, name: "Büro", lights: true, blindsOpen: 60, temperature: 23.1, consumption: 280, scenes: ["Arbeiten", "Meeting", "Pause"] },
  { id: 5, name: "Bad", lights: false, blindsOpen: 50, temperature: 24.2, consumption: 120, scenes: ["Morgen", "Baden", "Nacht"] },
  { id: 6, name: "Terrasse", lights: false, blindsOpen: 100, temperature: 17.8, consumption: 15, scenes: ["Abend", "Party", "Aus"] },
];

export const stromData = {
  todayConsumption: 18.7,
  monthConsumption: 412,
  yearConsumption: 5840,
  hochtarif: { today: 12.3, month: 275, rate: 0.2186 },
  niedertarif: { today: 6.4, month: 137, rate: 0.1532 },
  smartMeter: { model: "Landis+Gyr E450", serialNumber: "LGE450-2024-8847", obisCode: "1-0:1.8.0" },
};

export const stromWeeklyData = [
  { day: "Mo", hochtarif: 14.2, niedertarif: 6.8 },
  { day: "Di", hochtarif: 12.3, niedertarif: 6.4 },
  { day: "Mi", hochtarif: 15.1, niedertarif: 7.2 },
  { day: "Do", hochtarif: 11.8, niedertarif: 5.9 },
  { day: "Fr", hochtarif: 13.5, niedertarif: 6.1 },
  { day: "Sa", hochtarif: 9.2, niedertarif: 8.4 },
  { day: "So", hochtarif: 8.1, niedertarif: 9.7 },
];

export const wasserData = {
  poolTemperature: 26.8,
  poolPH: 7.2,
  features: [
    { id: 1, name: "Gegenstromanlage", status: false, power: 2200, icon: "waves" },
    { id: 2, name: "Massagedüsen", status: false, power: 1500, icon: "sparkles" },
    { id: 3, name: "Beleuchtung", status: true, power: 120, icon: "lamp" },
    { id: 4, name: "Heizung", status: true, power: 3000, icon: "thermometer" },
    { id: 5, name: "Filterpumpe", status: true, power: 750, icon: "filter" },
    { id: 6, name: "Abdeckung", status: false, power: 200, icon: "square" },
  ],
  usageHistory: [
    { month: "Jan", liters: 2400 },
    { month: "Feb", liters: 2100 },
    { month: "Mär", liters: 2800 },
    { month: "Apr", liters: 3200 },
    { month: "Mai", liters: 4500 },
    { month: "Jun", liters: 6200 },
    { month: "Jul", liters: 7800 },
    { month: "Aug", liters: 7200 },
    { month: "Sep", liters: 5100 },
    { month: "Okt", liters: 3400 },
    { month: "Nov", liters: 2600 },
    { month: "Dez", liters: 2200 },
  ],
};

export const fahrzeugeData = [
  {
    id: 1,
    brand: "Porsche",
    model: "Taycan 4S",
    year: 2024,
    color: "Dolomitsilber",
    mileage: 12480,
    fuelLevel: 78,
    fuelType: "Elektro",
    range: 340,
    tirePressure: { fl: 2.5, fr: 2.5, rl: 2.8, rr: 2.8 },
    serviceDate: "2025-03-15",
    nextService: "2026-09-15",
    location: "Garage Buranto, Sissach",
    locked: true,
    apiNote: "Porsche Connect API (pyporscheconnectapi)",
  },
  {
    id: 2,
    brand: "Mini",
    model: "Cooper SE",
    year: 2023,
    color: "British Racing Green",
    mileage: 24650,
    fuelLevel: 54,
    fuelType: "Elektro",
    range: 185,
    tirePressure: { fl: 2.3, fr: 2.3, rl: 2.5, rr: 2.5 },
    serviceDate: "2025-01-20",
    nextService: "2026-07-20",
    location: "Garage Buranto, Sissach",
    locked: true,
    apiNote: "BMW/Mini Connected (bimmer_connected)",
  },
];
