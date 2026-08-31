"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Map,
  Globe,
  Waves,
  Gamepad2,
  Search,
  Sparkles,
  ArrowRight,
  Compass,
  MapPin,
  Flame,
  Layers,
  X,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { foldForSearch } from "@/lib/search/normalize";

interface V2HeroProps {
  provinceCount: number;
  countryCount: number;
}

interface SearchEntry {
  name: string;
  path: string;
  kind: "p" | "c" | "tool" | "module";
  subtitle?: string;
  folded: string;
}

// Built-in module shortcuts in addition to API search index
const STATIC_SHORTCUTS: SearchEntry[] = [
  { name: "Türkiye İller Haritası", path: "/v2/turkiye", kind: "module", subtitle: "81 İl ve 7 Coğrafi Bölge", folded: "turkiye iller haritasi" },
  { name: "Dünya Ülkeleri Atlası", path: "/v2/dunya", kind: "module", subtitle: "199 Ülke ve Kıtalar", folded: "dunya ulkeleri atlasi" },
  { name: "Canlı Deniz Telemetrisi", path: "/v2/deniz", kind: "module", subtitle: "Copernicus & ECMWF 4 Deniz", folded: "canli deniz telemetrisi" },
  { name: "Harita Oyunu (81 İl & Dünya)", path: "/v2/oyun", kind: "module", subtitle: "3 İnteraktif Oyun Modu", folded: "harita oyunu 81 il dunya" },
  { name: "Canlı Deprem Takip Portalı", path: "/v2/deprem", kind: "module", subtitle: "AFAD TDVMS Son Sarsıntılar", folded: "canli deprem takip portali" },
  { name: "Kuş Uçuşu Mesafe Ölçme", path: "/v2/araclar/mesafe-olcme", kind: "tool", subtitle: "CBS Jeodezik Mesafe Aracı", folded: "kus ucusu mesafe olcme" },
  { name: "Koordinat Bulma & Dönüştürme", path: "/v2/araclar/koordinat-bulma", kind: "tool", subtitle: "WGS84 Enlem / Boylam Aracı", folded: "koordinat bulma donusturme" },
  { name: "Alan & Yüzölçümü Hesaplama", path: "/v2/araclar/alan-hesaplama", kind: "tool", subtitle: "Poligon Jeodezik Alan Aracı", folded: "alan yuzolcumu hesaplama" },
  { name: "Coğrafya Kitapları & Denemeler", path: "/v2/kitaplar", kind: "module", subtitle: "Soru Bankası & Video Çözümler", folded: "cografya kitaplari denemeler" },
];

export function V2Hero({ provinceCount, countryCount }: V2HeroProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [allEntries, setAllEntries] = React.useState<SearchEntry[]>(STATIC_SHORTCUTS);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  const totalCountries = countryCount > 0 ? countryCount : 199;
  const totalProvinces = provinceCount > 0 ? provinceCount : 81;

  // Fetch search index from API on mount
  React.useEffect(() => {
    let isMounted = true;
    async function loadIndex() {
      try {
        const res = await fetch("/api/search-index/tr");
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.entries) && isMounted) {
          const apiEntries: SearchEntry[] = data.entries.map((item: [string, string, "p" | "c"]) => ({
            name: item[0],
            path: `/v2${item[1]}`,
            kind: item[2],
            subtitle: item[2] === "p" ? "Türkiye İli" : "Dünya Ülkesi",
            folded: foldForSearch(item[0]),
          }));
          setAllEntries([...STATIC_SHORTCUTS, ...apiEntries]);
        }
      } catch {
        // Fallback to static shortcuts if offline
      }
    }
    loadIndex();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter matching results
  const filteredResults = React.useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const foldedQuery = foldForSearch(trimmed);

    return allEntries
      .filter((entry) => entry.folded.includes(foldedQuery) || foldForSearch(entry.name).includes(foldedQuery))
      .slice(0, 6);
  }, [query, allEntries]);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavigate = (path: string, name: string) => {
    setIsOpen(false);
    setQuery("");
    toast.success(`${name} sayfasına yönlendiriliyorsunuz...`);
    router.push(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen && filteredResults.length > 0) {
        setIsOpen(true);
        return;
      }
      setActiveIndex((prev) => (prev + 1) % (filteredResults.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredResults.length) % (filteredResults.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredResults.length > 0) {
        const target = filteredResults[activeIndex] || filteredResults[0];
        if (target) {
          handleNavigate(target.path, target.name);
        }
      } else if (query.trim()) {
        toast.info(`"${query}" için sonuç bulunamadı. Lütfen bir il, ülke veya araç adı deneyin.`);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filteredResults.length > 0) {
      const target = filteredResults[0];
      if (target) {
        handleNavigate(target.path, target.name);
      }
    } else if (query.trim()) {
      toast.info(`"${query}" için sonuç bulunamadı. Listeden bir il veya ülke seçebilirsiniz.`);
    } else {
      toast.info("Lütfen aramak istediğiniz ili veya ülkeyi yazın.");
    }
  };

  const getKindBadge = (kind: SearchEntry["kind"]) => {
    switch (kind) {
      case "p":
        return <Badge variant="primary" size="sm">İl</Badge>;
      case "c":
        return <Badge variant="secondary" size="sm">Ülke</Badge>;
      case "tool":
        return <Badge variant="outline" size="sm">CBS</Badge>;
      case "module":
        return <Badge variant="info" size="sm">Modül</Badge>;
    }
  };

  const getKindIcon = (kind: SearchEntry["kind"]) => {
    switch (kind) {
      case "p":
        return <MapPin className="size-4 text-primary" />;
      case "c":
        return <Globe className="size-4 text-secondary" />;
      case "tool":
        return <Compass className="size-4 text-primary" />;
      case "module":
        return <Sparkles className="size-4 text-accent" />;
    }
  };

  // Curated 4 top quick access targets
  const QUICK_TAGS = [
    { label: "📍 İstanbul", path: "/v2/turkiye/istanbul" },
    { label: "🌍 Japonya", path: "/v2/dunya/japonya" },
    { label: "🌊 Marmara Denizi", path: "/v2/deniz" },
    { label: "🎮 81 İl Oyunu", path: "/v2/oyun" },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 lg:p-14 shadow-lg">
      {/* Background Mesh Glow */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 size-96 rounded-full bg-gradient-to-bl from-primary/20 via-primary/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 size-96 rounded-full bg-gradient-to-tr from-accent/20 via-secondary/10 to-transparent blur-3xl pointer-events-none" />

      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Column: Heading & Value Proposition */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary" size="sm" icon={<Sparkles className="size-3.5" />}>
              Coğrafya Platformu v2.0
            </Badge>
            <Badge variant="secondary" size="sm" dot>
              Canlı Telemetri Aktif
            </Badge>
            <Badge variant="outline" size="sm" className="font-mono text-[10px]">
              Açık &amp; Bilimsel Atlas
            </Badge>
          </div>

          <div className="space-y-3">
            <h1 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-[1.12]">
              Coğrafyayı Ezberleme, <br />
              <span className="text-primary bg-gradient-to-r from-primary to-[var(--color-primary-dark,#7e3a1e)] bg-clip-text text-transparent">
                Haritada Yaşa &amp; Keşfet.
              </span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl">
              Türkiye'nin 81 ili, {totalCountries} dünya ülkesi, saatlik güncellenen Copernicus deniz telemetrisi
              ve interaktif harita araçları tek ekranda.
            </p>
          </div>

          {/* REAL FUNCTIONAL LIVE SEARCH EXPLORER */}
          <div ref={searchContainerRef} className="space-y-2.5 max-w-xl relative">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Input
                placeholder="Örn: 'Bursa', 'Japonya', 'Mesafe ölçme' veya 'Deprem'..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                  setActiveIndex(0);
                }}
                onFocus={() => {
                  if (query.trim()) setIsOpen(true);
                }}
                onKeyDown={handleKeyDown}
                leftIcon={<Search className="size-4 text-primary" />}
                rightIcon={
                  query ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setIsOpen(false);
                      }}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  ) : undefined
                }
                className="h-13 text-sm pr-24 bg-card/90 border-primary/40 focus-visible:border-primary shadow-xs rounded-2xl"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-xl shadow-xs"
              >
                Keşfet
              </Button>
            </form>

            {/* Auto-suggest Search Dropdown (Popover with safe z-index & backdrop) */}
            {isOpen && query.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 p-2 rounded-2xl shadow-2xl border border-border bg-card/95 backdrop-blur-md z-40 animate-in fade-in-50 zoom-in-95 duration-100 space-y-1 max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between px-3 py-1 text-[11px] text-muted-foreground border-b border-border/60">
                  <span>Arama Sonuçları ({filteredResults.length})</span>
                  <span className="font-mono">Enter ↵ ile aç</span>
                </div>

                {filteredResults.length > 0 ? (
                  filteredResults.map((entry, index) => (
                    <button
                      key={`${entry.path}-${index}`}
                      type="button"
                      onClick={() => handleNavigate(entry.path, entry.name)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                        activeIndex === index ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {getKindIcon(entry.kind)}
                        </div>
                        <div>
                          <div className="font-bold text-xs">{entry.name}</div>
                          {entry.subtitle && (
                            <div className="text-[10px] text-muted-foreground font-normal">{entry.subtitle}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getKindBadge(entry.kind)}
                        <ArrowRight className="size-3 text-muted-foreground" />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    <span>"{query}" ile eşleşen il, ülke veya araç bulunamadı.</span>
                  </div>
                )}
              </div>
            )}

            {/* Quick 4 Destination Pills */}
            <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
              <span className="text-muted-foreground text-[11px] font-medium">Hızlı Erişim:</span>
              {QUICK_TAGS.map((tag) => (
                <Link key={tag.path} href={tag.path as any}>
                  <Badge
                    variant="outline"
                    size="sm"
                    className="hover:border-primary/60 hover:text-primary transition-colors cursor-pointer bg-card/60"
                  >
                    {tag.label}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>

          {/* Direct CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/v2/turkiye">
              <Button
                variant="primary"
                size="lg"
                className="h-12 px-6 rounded-2xl shadow-md text-sm font-semibold"
                rightIcon={<ArrowRight className="size-4" />}
              >
                Türkiye Haritasını Aç
              </Button>
            </Link>
            <Link href="/v2/dunya">
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-6 rounded-2xl text-sm font-semibold bg-card/80"
                leftIcon={<Globe className="size-4 text-secondary" />}
              >
                Dünya Atlası
              </Button>
            </Link>
            <Link href="/v2/oyun">
              <Button
                variant="secondary"
                size="lg"
                className="h-12 px-6 rounded-2xl text-sm font-semibold shadow-xs"
                leftIcon={<Gamepad2 className="size-4" />}
              >
                Harita Oyunu Oyna
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Column: Live Telemetry Spotlight Showcase */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-md p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-heading font-bold text-sm text-foreground">
                  Canlı Coğrafya Telemetrisi
                </h3>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">ECMWF / AFAD / MTA</span>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/v2/turkiye" className="group block">
                <div className="p-4 rounded-2xl border border-border bg-muted/30 group-hover:border-primary/60 group-hover:bg-muted/50 transition-all">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <MapPin className="size-3.5 text-primary" />
                    <span>Türkiye İlleri</span>
                  </div>
                  <div className="font-heading font-bold text-2xl text-primary">{totalProvinces} İl</div>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">81 İlçe ve Bölge</span>
                </div>
              </Link>

              <Link href="/v2/dunya" className="group block">
                <div className="p-4 rounded-2xl border border-border bg-muted/30 group-hover:border-secondary/60 group-hover:bg-muted/50 transition-all">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Globe className="size-3.5 text-secondary" />
                    <span>Dünya Ülkeleri</span>
                  </div>
                  <div className="font-heading font-bold text-2xl text-secondary">{totalCountries} Ülke</div>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">6 Kıta ve Başkent</span>
                </div>
              </Link>

              <Link href="/v2/deniz" className="group block">
                <div className="p-4 rounded-2xl border border-border bg-muted/30 group-hover:border-accent/60 group-hover:bg-muted/50 transition-all">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Waves className="size-3.5 text-accent" />
                    <span>Deniz Havzaları</span>
                  </div>
                  <div className="font-heading font-bold text-2xl text-foreground">4 Havza</div>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">30 Kıyı İstasyonu</span>
                </div>
              </Link>

              <Link href="/v2/deprem" className="group block">
                <div className="p-4 rounded-2xl border border-border bg-muted/30 group-hover:border-destructive/60 group-hover:bg-muted/50 transition-all">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Flame className="size-3.5 text-destructive" />
                    <span>Sismik İzleme</span>
                  </div>
                  <div className="font-heading font-bold text-2xl text-destructive">7/24 Aktif</div>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">AFAD Entegrasyonu</span>
                </div>
              </Link>
            </div>

            {/* Books & Solutions Quick Link Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent border border-amber-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-amber-600 dark:text-amber-400" />
                <div>
                  <span className="font-bold text-foreground block">Video Çözümlü Denemeler</span>
                  <span className="text-[10px] text-muted-foreground">ÖSYM Tarzı Coğrafya Yayınları</span>
                </div>
              </div>
              <Link href="/v2/kitaplar">
                <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-amber-700 dark:text-amber-300" rightIcon={<ArrowRight className="size-3" />}>
                  İncele
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
