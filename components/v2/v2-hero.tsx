"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Gamepad2, Search, Sparkles, ArrowRight, Compass, MapPin, X } from "lucide-react";
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
  {
    name: "Türkiye İller Haritası",
    path: "/v2/turkiye",
    kind: "module",
    subtitle: "81 İl ve 7 Coğrafi Bölge",
    folded: "turkiye iller haritasi",
  },
  {
    name: "Dünya Ülkeleri Atlası",
    path: "/v2/dunya",
    kind: "module",
    subtitle: "199 Ülke ve Kıtalar",
    folded: "dunya ulkeleri atlasi",
  },
  {
    name: "Canlı Deniz Telemetrisi",
    path: "/v2/deniz",
    kind: "module",
    subtitle: "Copernicus & ECMWF 4 Deniz",
    folded: "canli deniz telemetrisi",
  },
  {
    name: "Harita Oyunu (81 İl & Dünya)",
    path: "/v2/oyun",
    kind: "module",
    subtitle: "3 İnteraktif Oyun Modu",
    folded: "harita oyunu 81 il dunya",
  },
  {
    name: "Canlı Deprem Takip Portalı",
    path: "/v2/deprem",
    kind: "module",
    subtitle: "AFAD TDVMS Son Sarsıntılar",
    folded: "canli deprem takip portali",
  },
  {
    name: "Kuş Uçuşu Mesafe Ölçme",
    path: "/v2/araclar/mesafe-olcme",
    kind: "tool",
    subtitle: "CBS Jeodezik Mesafe Aracı",
    folded: "kus ucusu mesafe olcme",
  },
  {
    name: "Koordinat Bulma & Dönüştürme",
    path: "/v2/araclar/koordinat-bulma",
    kind: "tool",
    subtitle: "WGS84 Enlem / Boylam Aracı",
    folded: "koordinat bulma donusturme",
  },
  {
    name: "Alan & Yüzölçümü Hesaplama",
    path: "/v2/araclar/alan-hesaplama",
    kind: "tool",
    subtitle: "Poligon Jeodezik Alan Aracı",
    folded: "alan yuzolcumu hesaplama",
  },
  {
    name: "Coğrafya Kitapları & Denemeler",
    path: "/v2/kitaplar",
    kind: "module",
    subtitle: "Soru Bankası & Video Çözümler",
    folded: "cografya kitaplari denemeler",
  },
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
          const apiEntries: SearchEntry[] = data.entries.map(
            (item: [string, string, "p" | "c"]) => ({
              name: item[0],
              path: `/v2${item[1]}`,
              kind: item[2],
              subtitle: item[2] === "p" ? "Türkiye İli" : "Dünya Ülkesi",
              folded: foldForSearch(item[0]),
            }),
          );
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
      .filter(
        (entry) =>
          entry.folded.includes(foldedQuery) || foldForSearch(entry.name).includes(foldedQuery),
      )
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
        toast.info(`"${query}" için sonuç bulunamadı. Lütfen bir il, ülke veya araç adı dene.`);
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
      toast.info(`"${query}" için sonuç bulunamadı. Listeden bir il veya ülke seçebilirsin.`);
    } else {
      toast.info("Lütfen aramak istediğin ili veya ülkeyi yaz.");
    }
  };

  const getKindBadge = (kind: SearchEntry["kind"]) => {
    switch (kind) {
      case "p":
        return (
          <Badge variant="primary" size="sm">
            İl
          </Badge>
        );
      case "c":
        return (
          <Badge variant="secondary" size="sm">
            Ülke
          </Badge>
        );
      case "tool":
        return (
          <Badge variant="outline" size="sm">
            CBS
          </Badge>
        );
      case "module":
        return (
          <Badge variant="info" size="sm">
            Modül
          </Badge>
        );
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

  // Curated top quick access targets
  const QUICK_TAGS = [
    { label: "📍 İstanbul", path: "/v2/turkiye/istanbul" },
    { label: "🌍 Japonya", path: "/v2/dunya/japonya" },
    { label: "🌊 Marmara Denizi", path: "/v2/deniz" },
    { label: "🎮 81 İl Oyunu", path: "/v2/oyun" },
    { label: "📐 Mesafe Ölçme", path: "/v2/araclar/mesafe-olcme" },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card to-muted/20 p-8 sm:p-12 lg:p-16 shadow-lg text-center">
      {/* Background Mesh Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-32 size-[640px] rounded-full bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-10 -mb-28 size-72 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 -mb-28 size-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto space-y-6">
        {/* Eyebrow Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/25 bg-primary/5 text-primary text-xs font-semibold shadow-2xs backdrop-blur-xs">
            <Sparkles className="size-3.5 text-primary animate-pulse" />
            <span>Coğrafya Gurmesi · Açık Atlas &amp; Eğitim Portalı</span>
          </div>
        </div>

        {/* Heading & Value Proposition */}
        <div className="space-y-3">
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-[1.12]">
            Coğrafyayı Ezberleme, <br className="hidden sm:inline" />
            <span className="text-primary bg-gradient-to-r from-primary via-[var(--color-primary-dark,#7e3a1e)] to-primary bg-clip-text text-transparent">
              Haritada Keşfet.
            </span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Türkiye&apos;nin {totalProvinces} ili, {totalCountries} dünya ülkesi, anlık deniz &amp;
            deprem telemetrisi ve interaktif CBS harita araçları tek ekranda.
          </p>
        </div>

        {/* Central Omni-Search Bar (Interactive & Integrated) */}
        <div ref={searchContainerRef} className="pt-2 max-w-2xl mx-auto relative text-left">
          <form onSubmit={handleSearchSubmit} className="relative group">
            <div className="relative flex items-center rounded-2xl border border-border/90 bg-card/95 shadow-md backdrop-blur-md transition-all duration-200 group-hover:border-primary/40 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 focus-within:shadow-xl">
              <div className="pl-4.5 pr-2 flex items-center pointer-events-none text-primary shrink-0">
                <Search className="size-5" />
              </div>
              <input
                type="text"
                placeholder="İl, ülke, deniz veya araç ara... (örn: 'Balıkesir', 'Japonya', 'Mesafe')"
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
                className="w-full h-14 bg-transparent text-foreground placeholder:text-muted-foreground/70 text-sm sm:text-base outline-none pr-28 pl-1"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className="p-1.5 mr-2 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg hover:bg-muted transition-colors"
                  aria-label="Aramayı temizle"
                >
                  <X className="size-4" />
                </button>
              )}
              <div className="absolute right-2 flex items-center gap-1.5">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="h-10 px-5 rounded-xl shadow-xs text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  Keşfet
                </Button>
              </div>
            </div>
          </form>

          {/* Auto-suggest Search Dropdown (Popover with safe z-index & backdrop) */}
          {isOpen && query.trim().length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl shadow-2xl border border-border bg-card/95 backdrop-blur-md z-50 animate-in fade-in-50 zoom-in-95 duration-100 space-y-1 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border/60">
                <span>Arama Sonuçları ({filteredResults.length})</span>
                <span className="font-mono text-[10px]">Enter ↵ ile aç</span>
              </div>

              {filteredResults.length > 0 ? (
                filteredResults.map((entry, index) => (
                  <button
                    key={`${entry.path}-${index}`}
                    type="button"
                    onClick={() => handleNavigate(entry.path, entry.name)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                      activeIndex === index
                        ? "bg-primary/10 text-primary font-bold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {getKindIcon(entry.kind)}
                      </div>
                      <div>
                        <div className="font-bold text-xs">{entry.name}</div>
                        {entry.subtitle && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {entry.subtitle}
                          </div>
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
                  <span>&ldquo;{query}&rdquo; ile eşleşen il, ülke veya araç bulunamadı.</span>
                </div>
              )}
            </div>
          )}

          {/* Quick Access Pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap pt-3 text-xs">
            <span className="text-muted-foreground text-[11px] font-medium">Hızlı Erişim:</span>
            {QUICK_TAGS.map((tag) => (
              <Link
                key={tag.path}
                href={tag.path as unknown as React.ComponentProps<typeof Link>["href"]}
              >
                <Badge
                  variant="outline"
                  size="sm"
                  className="hover:border-primary/60 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer bg-card/60 text-[11px] py-0.5 px-2.5"
                >
                  {tag.label}
                </Badge>
              </Link>
            ))}
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link href="/v2/turkiye">
            <Button
              variant="primary"
              size="lg"
              className="h-12 px-6 rounded-2xl shadow-md text-sm font-semibold cursor-pointer"
              rightIcon={<ArrowRight className="size-4" />}
            >
              Türkiye Haritası (81 İl)
            </Button>
          </Link>
          <Link href="/v2/dunya">
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-6 rounded-2xl text-sm font-semibold bg-card/80 hover:bg-card border-border hover:border-primary/40 cursor-pointer"
              leftIcon={<Globe className="size-4 text-secondary" />}
            >
              Dünya Atlası (199 Ülke)
            </Button>
          </Link>
          <Link href="/v2/oyun">
            <Button
              variant="secondary"
              size="lg"
              className="h-12 px-6 rounded-2xl text-sm font-semibold shadow-xs cursor-pointer"
              leftIcon={<Gamepad2 className="size-4" />}
            >
              Harita Oyunu Oyna
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
