import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ExternalLink, Zap, ArrowDownToLine, Sun, Clock } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ─── Tariff Data (Elektra Sissach 2026, exkl. MwSt) ──────────────────────────

const TARIFE = {
  sissastrom: {
    name: "sissastrom",
    ht: { energie: 10.75, netz: 11.35, abgaben: 3.03, total: 25.13 },
    nt: { energie: 10.75, netz: 7.90, abgaben: 3.03, total: 21.68 },
  },
  basismix: {
    name: "BasisMix",
    ht: { energie: 12.25, netz: 11.35, abgaben: 3.03, total: 26.63 },
    nt: { energie: 12.25, netz: 7.90, abgaben: 3.03, total: 23.18 },
  },
};

const GRUNDPREIS = { energie: 4.0, netz: 4.0, mess: 8.0, total: 16.0 };

const ABGABEN = [
  { name: "KEV + SGF", wert: 2.30 },
  { name: "SRB", wert: 0.41 },
  { name: "SDL", wert: 0.27 },
  { name: "Solidar. Netzkosten", wert: 0.05 },
];

const EINSPEISEVERGUETUNG = [
  { tarif: "EV3", produkt: "sissastrom (mit HKN, PVA <100kWp)", verguetung: 11.0 },
  { tarif: "EV2", produkt: "BasisMix (mit HKN)", verguetung: 9.5 },
  { tarif: "—", produkt: "Ohne HKN", verguetung: 8.5 },
];

// ─── Tarifzeiten-Visualisierung ────────────────────────────────────────────────

const STUNDEN = Array.from({ length: 24 }, (_, i) => i);

function TarifzeitenBar({ label, isWeekend }: { label: string; isWeekend: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex flex-1 h-7 rounded overflow-hidden gap-px">
        {STUNDEN.map((h) => {
          const isHT = !isWeekend && h >= 6 && h < 21;
          return (
            <div
              key={h}
              className={`flex-1 ${isHT ? "bg-amber-500/80" : "bg-blue-600/70"}`}
              title={`${String(h).padStart(2, "0")}:00 – ${isHT ? "HT" : "NT"}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Custom Tooltip for Abgaben Chart ─────────────────────────────────────────

function AbgabenTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; wert: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs">
      <p className="font-medium">{d.name}</p>
      <p className="text-amber-400">{d.wert.toFixed(2)} Rp/kWh</p>
    </div>
  );
}

// ─── Kostenrechner ─────────────────────────────────────────────────────────────

function Kostenrechner() {
  const [kwh, setKwh] = useState<number>(300);
  const [htProzent, setHtProzent] = useState<number>(60);
  const produkt = TARIFE.sissastrom;

  const htKwh = kwh * (htProzent / 100);
  const ntKwh = kwh * ((100 - htProzent) / 100);
  const energiekosten = (htKwh * produkt.ht.total + ntKwh * produkt.nt.total) / 100; // CHF
  const gesamt = energiekosten + GRUNDPREIS.total;

  return (
    <Card className="border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" />
          Kostenrechner — sissastrom 2026
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Inputs */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Verbrauch pro Monat (kWh)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={5000}
                  value={kwh}
                  onChange={(e) => setKwh(Math.max(0, Number(e.target.value)))}
                  className="w-32 h-8 text-sm bg-zinc-900 border-zinc-700"
                />
                <span className="text-xs text-muted-foreground">kWh</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Hochtarif-Anteil: <span className="text-foreground font-medium">{htProzent}%</span>{" "}
                <span className="text-muted-foreground">HT / {100 - htProzent}% NT</span>
              </Label>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[htProzent]}
                onValueChange={(v) => setHtProzent(v[0])}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0% HT</span>
                <span className="text-xs">Mo–Fr 06–21 Uhr = HT</span>
                <span>100% HT</span>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="bg-zinc-900/60 rounded-lg border border-zinc-800 p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              Monatliche Kosten
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">HT ({htKwh.toFixed(0)} kWh × {produkt.ht.total} Rp)</span>
              <span className="tabular-nums">CHF {(htKwh * produkt.ht.total / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">NT ({ntKwh.toFixed(0)} kWh × {produkt.nt.total} Rp)</span>
              <span className="tabular-nums">CHF {(ntKwh * produkt.nt.total / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Grundpreis</span>
              <span className="tabular-nums">CHF {GRUNDPREIS.total.toFixed(2)}</span>
            </div>
            <div className="border-t border-zinc-700 pt-2 mt-2 flex justify-between">
              <span className="text-sm font-semibold">Total (exkl. MwSt)</span>
              <span className="text-lg font-bold text-yellow-400 tabular-nums">
                CHF {gesamt.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Ø {(gesamt / kwh * 100).toFixed(2)} Rp/kWh effektiv
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const ABGABEN_COLORS = ["#d97706", "#b45309", "#92400e", "#78350f"];

export default function Strom() {
  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Strom</h1>
          <p className="text-sm text-muted-foreground">
            Elektra Sissach — Tarife 2026 (exkl. MwSt)
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="border-zinc-700 hover:border-yellow-400/60">
          <a
            href="https://kundenportal.encontrol.ch/Sissach"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Kundenportal
          </a>
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-zinc-800">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Hochtarif (HT)</div>
            <div className="text-2xl font-bold tabular-nums text-amber-400">
              25.13 <span className="text-sm font-normal">Rp/kWh</span>
            </div>
            <Badge
              variant="outline"
              className="mt-2 text-xs border-amber-600/40 text-amber-400 bg-amber-950/30"
            >
              Mo–Fr 06:00–21:00
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-zinc-800">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Niedertarif (NT)</div>
            <div className="text-2xl font-bold tabular-nums text-blue-400">
              21.68 <span className="text-sm font-normal">Rp/kWh</span>
            </div>
            <Badge
              variant="outline"
              className="mt-2 text-xs border-blue-600/40 text-blue-400 bg-blue-950/30"
            >
              Nächte &amp; Wochenende
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-zinc-800">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Einspeisevergütung</div>
            <div className="text-2xl font-bold tabular-nums text-green-400">
              11.0 <span className="text-sm font-normal">Rp/kWh</span>
            </div>
            <Badge
              variant="outline"
              className="mt-2 text-xs border-green-700/40 text-green-400 bg-green-950/30"
            >
              EV3 mit HKN
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-zinc-800">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Grundpreis</div>
            <div className="text-2xl font-bold tabular-nums text-zinc-100">
              16.00 <span className="text-sm font-normal">CHF/Mt</span>
            </div>
            <Badge
              variant="outline"
              className="mt-2 text-xs border-zinc-600 text-zinc-400"
            >
              Energie + Netz + Mess
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Tariff Tabs */}
      <Card className="border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tarifdetails — Aufschlüsselung</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sissastrom">
            <TabsList className="mb-4">
              <TabsTrigger value="sissastrom">sissastrom</TabsTrigger>
              <TabsTrigger value="basismix">BasisMix</TabsTrigger>
            </TabsList>

            {(["sissastrom", "basismix"] as const).map((key) => {
              const t = TARIFE[key];
              return (
                <TabsContent key={key} value={key}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-zinc-800">
                          <th className="text-left py-2 pr-4 font-medium">Komponente</th>
                          <th className="text-right py-2 px-4 font-medium text-amber-400">HT (Rp/kWh)</th>
                          <th className="text-right py-2 pl-4 font-medium text-blue-400">NT (Rp/kWh)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        <tr>
                          <td className="py-2 pr-4 text-muted-foreground">Energie</td>
                          <td className="py-2 px-4 text-right tabular-nums">{t.ht.energie.toFixed(2)}</td>
                          <td className="py-2 pl-4 text-right tabular-nums">{t.nt.energie.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-muted-foreground">Netznutzung</td>
                          <td className="py-2 px-4 text-right tabular-nums">{t.ht.netz.toFixed(2)}</td>
                          <td className="py-2 pl-4 text-right tabular-nums">{t.nt.netz.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-muted-foreground">Abgaben</td>
                          <td className="py-2 px-4 text-right tabular-nums">{t.ht.abgaben.toFixed(2)}</td>
                          <td className="py-2 pl-4 text-right tabular-nums">{t.nt.abgaben.toFixed(2)}</td>
                        </tr>
                        <tr className="border-t border-zinc-700 font-semibold">
                          <td className="py-2.5 pr-4">
                            <span className="text-yellow-400">Total</span>
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-amber-300">
                            {t.ht.total.toFixed(2)}
                          </td>
                          <td className="py-2.5 pl-4 text-right tabular-nums text-blue-300">
                            {t.nt.total.toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground border-t border-zinc-800 pt-3">
                    Grundpreise (monatlich): Energie CHF {GRUNDPREIS.energie.toFixed(2)} + Netz CHF {GRUNDPREIS.netz.toFixed(2)} + Messtarif CHF {GRUNDPREIS.mess.toFixed(2)} = <span className="text-foreground font-medium">CHF {GRUNDPREIS.total.toFixed(2)}/Monat</span>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Tarifzeiten Visual */}
      <Card className="border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            Tarifzeiten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 mb-4">
            <TarifzeitenBar label="Mo – Fr" isWeekend={false} />
            <TarifzeitenBar label="Samstag" isWeekend={true} />
            <TarifzeitenBar label="Sonntag" isWeekend={true} />
          </div>

          {/* Hour markers */}
          <div className="flex ml-[88px] text-xs text-muted-foreground">
            {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
              <span
                key={h}
                className="flex-1"
                style={{ flexBasis: `${(3 / 24) * 100}%`, minWidth: 0 }}
              >
                {String(h).padStart(2, "0")}
              </span>
            ))}
            <span>24</span>
          </div>

          <div className="flex gap-4 mt-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-500/80" />
              <span>Hochtarif (HT) — Mo–Fr 06:00–21:00</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-600/70" />
              <span>Niedertarif (NT) — Mo–Fr 21:00–06:00, Sa/So ganztags, Feiertage</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Einspeisevergütung */}
        <Card className="border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-green-400" />
              Einspeisevergütung (EV)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-zinc-800">
                  <th className="text-left py-2 pr-3 font-medium">Tarif</th>
                  <th className="text-left py-2 pr-3 font-medium">Produkt</th>
                  <th className="text-right py-2 font-medium text-green-400">Rp/kWh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {EINSPEISEVERGUETUNG.map((ev) => (
                  <tr key={ev.tarif}>
                    <td className="py-2 pr-3 font-medium">{ev.tarif}</td>
                    <td className="py-2 pr-3 text-muted-foreground text-xs">{ev.produkt}</td>
                    <td className="py-2 text-right tabular-nums text-green-400 font-semibold">
                      {ev.verguetung.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-3 border-t border-zinc-800 pt-3">
              HKN = Herkunftsnachweis. PVA = Photovoltaikanlage.
            </p>
          </CardContent>
        </Card>

        {/* Abgaben-Aufschlüsselung */}
        <Card className="border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sun className="h-4 w-4 text-zinc-400" />
              Abgaben-Aufschlüsselung (3.03 Rp/kWh)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ABGABEN} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 18%)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    stroke="hsl(215, 12%, 45%)"
                    tickFormatter={(v: number) => `${v.toFixed(2)}`}
                    domain={[0, 2.5]}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    stroke="hsl(215, 12%, 45%)"
                    width={120}
                  />
                  <Tooltip content={<AbgabenTooltip />} />
                  <Bar dataKey="wert" radius={[0, 3, 3, 0]}>
                    {ABGABEN.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={ABGABEN_COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2 border-t border-zinc-800 pt-3">
              {ABGABEN.map((a) => (
                <div key={a.name} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{a.name}</span>
                  <span className="tabular-nums">{a.wert.toFixed(2)} Rp/kWh</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-semibold border-t border-zinc-700 pt-1 mt-1">
                <span>Total Abgaben</span>
                <span className="tabular-nums text-yellow-400">3.03 Rp/kWh</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kostenrechner */}
      <Kostenrechner />

      {/* Footer Link */}
      <div className="text-xs text-muted-foreground flex flex-wrap gap-3 pb-2">
        <span>Quelle:</span>
        <a
          href="https://www.elektra-sissach.ch"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          elektra-sissach.ch
        </a>
        <span>|</span>
        <a
          href="https://kundenportal.encontrol.ch/Sissach"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Kundenportal (Encontrol AG)
        </a>
      </div>
    </div>
  );
}
