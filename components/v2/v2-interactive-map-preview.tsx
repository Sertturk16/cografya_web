"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";
import { Badge } from "@/components/ui/badge";
import {
  Compass,
  Waves,
  ArrowRight,
} from "lucide-react";

// Exact geographic context labels aligned with Natural Earth shape centers
const COUNTRY_NAMES_TR: Record<string, string> = {
  GR: "Yunanistan",
  BG: "Bulgaristan",
  GE: "Gürcistan",
  AM: "Ermenistan",
  AZ: "Azerbaycan",
  IR: "İran",
  IQ: "Irak",
  SY: "Suriye",
  RU: "Rusya",
  CY: "Kıbrıs",
  LB: "Lübnan",
};

const SEA_LABELS = [
  { name: "KARADENİZ", x: 480, y: -20, fontSize: 18 },
  { name: "MARMARA DENİZİ", x: 145, y: 108, fontSize: 9.5 },
  { name: "EGE DENİZİ", x: -25, y: 240, fontSize: 14 },
  { name: "AKDENİZ", x: 230, y: 485, fontSize: 18 },
];

const COASTAL_PLATES = new Set([
  "01", "07", "08", "09", "10", "17", "22", "28", "31", "33",
  "34", "35", "37", "39", "41", "48", "52", "53", "54", "55",
  "57", "59", "61", "67", "74", "77", "80", "81",
]);

const REGION_STYLES: Record<string, string> = {
  marmara: "fill-amber-600/80 hover:fill-amber-500",
  ege: "fill-teal-600/80 hover:fill-teal-500",
  akdeniz: "fill-emerald-600/80 hover:fill-emerald-500",
  icanadolu: "fill-yellow-600/80 hover:fill-yellow-500",
  karadeniz: "fill-cyan-700/80 hover:fill-cyan-600",
  doguanadolu: "fill-stone-600/80 hover:fill-stone-500",
  guneydogu: "fill-orange-600/80 hover:fill-orange-500",
};

const PROVINCE_REGION_MAP: Record<string, { region: string; regionId: string }> = {
  "01": { region: "Akdeniz", regionId: "akdeniz" },
  "02": { region: "Güneydoğu", regionId: "guneydogu" },
  "03": { region: "Ege", regionId: "ege" },
  "04": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "05": { region: "Karadeniz", regionId: "karadeniz" },
  "06": { region: "İç Anadolu", regionId: "icanadolu" },
  "07": { region: "Akdeniz", regionId: "akdeniz" },
  "08": { region: "Karadeniz", regionId: "karadeniz" },
  "09": { region: "Ege", regionId: "ege" },
  "10": { region: "Marmara", regionId: "marmara" },
  "11": { region: "Marmara", regionId: "marmara" },
  "12": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "13": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "14": { region: "Karadeniz", regionId: "karadeniz" },
  "15": { region: "Akdeniz", regionId: "akdeniz" },
  "16": { region: "Marmara", regionId: "marmara" },
  "17": { region: "Marmara", regionId: "marmara" },
  "18": { region: "İç Anadolu", regionId: "icanadolu" },
  "19": { region: "Karadeniz", regionId: "karadeniz" },
  "20": { region: "Ege", regionId: "ege" },
  "21": { region: "Güneydoğu", regionId: "guneydogu" },
  "22": { region: "Marmara", regionId: "marmara" },
  "23": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "24": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "25": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "26": { region: "İç Anadolu", regionId: "icanadolu" },
  "27": { region: "Güneydoğu", regionId: "guneydogu" },
  "28": { region: "Karadeniz", regionId: "karadeniz" },
  "29": { region: "Karadeniz", regionId: "karadeniz" },
  "30": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "31": { region: "Akdeniz", regionId: "akdeniz" },
  "32": { region: "Akdeniz", regionId: "akdeniz" },
  "33": { region: "Akdeniz", regionId: "akdeniz" },
  "34": { region: "Marmara", regionId: "marmara" },
  "35": { region: "Ege", regionId: "ege" },
  "36": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "37": { region: "Karadeniz", regionId: "karadeniz" },
  "38": { region: "İç Anadolu", regionId: "icanadolu" },
  "39": { region: "Marmara", regionId: "marmara" },
  "40": { region: "İç Anadolu", regionId: "icanadolu" },
  "41": { region: "Marmara", regionId: "marmara" },
  "42": { region: "İç Anadolu", regionId: "icanadolu" },
  "43": { region: "Ege", regionId: "ege" },
  "44": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "45": { region: "Ege", regionId: "ege" },
  "46": { region: "Akdeniz", regionId: "akdeniz" },
  "47": { region: "Güneydoğu", regionId: "guneydogu" },
  "48": { region: "Ege", regionId: "ege" },
  "49": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "50": { region: "İç Anadolu", regionId: "icanadolu" },
  "51": { region: "İç Anadolu", regionId: "icanadolu" },
  "52": { region: "Karadeniz", regionId: "karadeniz" },
  "53": { region: "Karadeniz", regionId: "karadeniz" },
  "54": { region: "Marmara", regionId: "marmara" },
  "55": { region: "Karadeniz", regionId: "karadeniz" },
  "56": { region: "Güneydoğu", regionId: "guneydogu" },
  "57": { region: "Karadeniz", regionId: "karadeniz" },
  "58": { region: "İç Anadolu", regionId: "icanadolu" },
  "59": { region: "Marmara", regionId: "marmara" },
  "60": { region: "Karadeniz", regionId: "karadeniz" },
  "61": { region: "Karadeniz", regionId: "karadeniz" },
  "62": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "63": { region: "Güneydoğu", regionId: "guneydogu" },
  "64": { region: "Ege", regionId: "ege" },
  "65": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "66": { region: "İç Anadolu", regionId: "icanadolu" },
  "67": { region: "Karadeniz", regionId: "karadeniz" },
  "68": { region: "İç Anadolu", regionId: "icanadolu" },
  "69": { region: "Karadeniz", regionId: "karadeniz" },
  "70": { region: "İç Anadolu", regionId: "icanadolu" },
  "71": { region: "İç Anadolu", regionId: "icanadolu" },
  "72": { region: "Güneydoğu", regionId: "guneydogu" },
  "73": { region: "Güneydoğu", regionId: "guneydogu" },
  "74": { region: "Karadeniz", regionId: "karadeniz" },
  "75": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "76": { region: "Doğu Anadolu", regionId: "doguanadolu" },
  "77": { region: "Marmara", regionId: "marmara" },
  "78": { region: "Karadeniz", regionId: "karadeniz" },
  "79": { region: "Güneydoğu", regionId: "guneydogu" },
  "80": { region: "Akdeniz", regionId: "akdeniz" },
  "81": { region: "Karadeniz", regionId: "karadeniz" },
};

export function V2InteractiveMapPreview() {
  const router = useRouter();
  const [hoveredPlate, setHoveredPlate] = React.useState<string | null>(null);
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = React.useState<"provinces" | "marine" | "regions">("provinces");

  const hoveredShape = React.useMemo(() => {
    if (!hoveredPlate) return null;
    return PROVINCE_SHAPES.find((p) => p.plateCode === hoveredPlate) || null;
  }, [hoveredPlate]);

  const hoveredMeta = hoveredPlate ? PROVINCE_REGION_MAP[hoveredPlate] : null;

  const trCasing = React.useMemo(() => {
    return CONTEXT_SHAPES.find((c) => c.iso === "TR");
  }, []);

  const getSlug = (geoName: string) => {
    return geoName
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/\s+/g, "-");
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="rounded-3xl border border-primary/30 bg-gradient-to-b from-card via-card to-muted/40 p-5 sm:p-7 shadow-xl space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-heading font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
            <Compass className="size-4 text-primary" />
            İnteraktif Türkiye & Komşu Ülkeler Coğrafi Atlası
          </h3>
        </div>

        {/* Dynamic Functional Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted border border-border text-xs">
          <button
            type="button"
            onClick={() => setMode("provinces")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              mode === "provinces" ? "bg-card text-primary font-bold shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Siyasi (81 İl)
          </button>
          <button
            type="button"
            onClick={() => setMode("marine")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              mode === "marine" ? "bg-card text-accent font-bold shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Deniz & Kıyılar (28 İl)
          </button>
          <button
            type="button"
            onClick={() => setMode("regions")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              mode === "regions" ? "bg-card text-secondary font-bold shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            7 Coğrafi Bölge
          </button>
        </div>
      </div>

      {/* Mode Status Pill */}
      {mode === "regions" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded-xl border border-border flex-wrap">
          <span className="font-semibold text-foreground">Bölge Renkleri:</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-amber-600" /> Marmara</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-teal-600" /> Ege</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-emerald-600" /> Akdeniz</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-yellow-600" /> İç Anadolu</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-cyan-700" /> Karadeniz</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-stone-600" /> Doğu Anadolu</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-orange-600" /> Güneydoğu</span>
        </div>
      )}

      {/* EDGE-TO-EDGE Map Panel with Cursor Following Floating Card */}
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setHoveredPlate(null);
          setMousePos(null);
        }}
        className="relative rounded-2xl bg-[var(--map-sea,#dbe7e8)] dark:bg-[#1a2529] border border-border overflow-hidden p-0 group aspect-[1270/580] w-full cursor-pointer"
      >
        <svg
          viewBox={TR_CONTEXT_VIEWBOX}
          className="w-full h-full select-none block"
          aria-label="Türkiye ve Komşu Ülkeler İnteraktif Haritası"
        >
          {/* 1. Surrounding Foreign Countries */}
          <g className="fill-[#f1ece3] dark:fill-[#2d2822] stroke-[#b8aea0] dark:stroke-[#50473e] stroke-[1] stroke-linejoin-round pointer-events-none">
            {CONTEXT_SHAPES.filter((c) => c.iso !== "TR").map((country) => (
              <path key={country.iso} d={country.d} />
            ))}
          </g>

          {/* 2. Türkiye Casing Base Land */}
          {trCasing && (
            <path
              d={trCasing.d}
              className="fill-card dark:fill-[#201c18] pointer-events-none"
            />
          )}

          {/* 3. Türkiye 81 Provinces Layer */}
          <g className="stroke-border/90 stroke-[0.8] transition-colors">
            {PROVINCE_SHAPES.map((shape) => {
              const isHovered = shape.plateCode === hoveredPlate;
              const meta = PROVINCE_REGION_MAP[shape.plateCode];
              const isCoastal = COASTAL_PLATES.has(shape.plateCode);

              let fillColor = "fill-card hover:fill-primary/60";

              if (mode === "regions") {
                fillColor = `${REGION_STYLES[meta?.regionId || "marmara"]} text-white`;
              } else if (mode === "marine") {
                fillColor = isCoastal ? "fill-accent/70 hover:fill-accent" : "fill-card/40 opacity-40";
              }

              if (isHovered) {
                fillColor = "fill-[var(--color-primary,#b0522e)] filter drop-shadow-md opacity-100";
              }

              return (
                <path
                  key={shape.plateCode}
                  d={shape.d}
                  onMouseEnter={() => setHoveredPlate(shape.plateCode)}
                  onMouseLeave={() => setHoveredPlate(null)}
                  onClick={() => router.push(`/v2/turkiye/${getSlug(shape.geoName)}`)}
                  className={`${fillColor} transition-all duration-150 cursor-pointer outline-none hover:stroke-foreground/60`}
                />
              );
            })}
          </g>

          {/* 4. Inland Lakes */}
          <g className="fill-[var(--map-sea,#dbe7e8)] dark:fill-[#1a2529] stroke-[var(--color-accent,#276b70)]/40 stroke-[0.5] pointer-events-none">
            {INLAND_WATER_SHAPES.map((lake) => (
              <path key={lake.id} d={lake.d} />
            ))}
          </g>

          {/* 5. Surrounding Sea Water Labels */}
          <g className="fill-[var(--color-accent,#276b70)] dark:fill-[#6ec7d1] font-heading font-bold tracking-wider pointer-events-none select-none">
            {SEA_LABELS.map((sea, i) => (
              <text
                key={i}
                x={sea.x}
                y={sea.y}
                textAnchor="middle"
                fontSize={sea.fontSize}
                className="opacity-80"
              >
                {sea.name}
              </text>
            ))}
          </g>

          {/* 6. Neighbor Country Name Labels (Placed at exact land centroids) */}
          <g className="fill-[#635a4e] dark:fill-[#a89e92] font-sans font-bold text-[12px] pointer-events-none select-none">
            {CONTEXT_SHAPES.filter((c) => c.iso !== "TR" && !["MK", "RS", "LB", "QN", "CY"].includes(c.iso)).map((country) => {
              const name = COUNTRY_NAMES_TR[country.iso] || country.geoName;
              return (
                <text
                  key={country.iso}
                  x={country.labelPoint.x}
                  y={country.labelPoint.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="tracking-tight opacity-80 select-none"
                >
                  {name}
                </text>
              );
            })}
          </g>
        </svg>

        {/* Dynamic Offset Hover Popover (Cleanly below the mouse cursor) */}
        {hoveredShape && mousePos && (
          <div
            style={{
              top: `${mousePos.y + 20}px`,
              left: `${mousePos.x}px`,
              transform: "translate(-50%, 0)",
            }}
            className="absolute z-30 pointer-events-none px-3.5 py-2 rounded-xl bg-card/95 backdrop-blur-md border border-primary/50 shadow-2xl space-y-0.5 animate-in fade-in-50 zoom-in-95 duration-75 whitespace-nowrap"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold px-1.5 py-0.2 rounded bg-primary text-white">
                TR-{hoveredShape.plateCode}
              </span>
              <span className="font-heading font-bold text-sm text-foreground">
                {hoveredShape.geoName}
              </span>
              {hoveredMeta && (
                <Badge variant="outline" size="sm" className="text-[10px] py-0 px-1.5">
                  {hoveredMeta.region}
                </Badge>
              )}
            </div>
            <div className="text-[10px] font-semibold text-primary flex items-center gap-1">
              <span>İncelemek için tıkla</span>
              <ArrowRight className="size-2.5" />
            </div>
          </div>
        )}

        {/* Live Sea Telemetry Badges */}
        <div className="absolute top-3 right-4 hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-cyan-900 dark:text-cyan-300 bg-card/90 px-2.5 py-1 rounded-lg border border-border shadow-xs pointer-events-none">
          <Waves className="size-3 text-cyan-600" /> Karadeniz: 25.2°C
        </div>
        <div className="absolute bottom-3 right-6 hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-emerald-900 dark:text-emerald-300 bg-card/90 px-2.5 py-1 rounded-lg border border-border shadow-xs pointer-events-none">
          <Waves className="size-3 text-emerald-600" /> Akdeniz: 29.5°C
        </div>
        <div className="absolute bottom-10 left-4 hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-teal-900 dark:text-teal-300 bg-card/90 px-2.5 py-1 rounded-lg border border-border shadow-xs pointer-events-none">
          <Waves className="size-3 text-teal-600" /> Ege Denizi: 25.6°C
        </div>
      </div>
    </div>
  );
}
