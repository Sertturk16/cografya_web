"use client";

import * as React from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Gamepad2, Search, Sparkles, ArrowRight, Compass, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { foldForSearch } from "@/lib/search/normalize";

interface V2HeroProps {
  provinceCount: number;
  countryCount: number;
  /** The `<h1>`. `Home.heading`, resolved on the server — see this file's hero docblock. */
  title: string;
  /** The value proposition under it. `Home.lede`, same source. */
  lede: string;
  /** "İl" / "Provinces" — reuses the Home namespace's existing bilingual stat labels. */
  provinceStatLabel: string;
  /** "Ülke" / "Countries" — same source of truth as the country-count fallback below. */
  countryStatLabel: string;
  modeCount: number;
  /** "Oyun Modu" / "Modes". */
  modeStatLabel: string;
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
    name: "Türkiye İlleri",
    path: "/turkiye",
    kind: "module",
    subtitle: "81 il ve 7 coğrafi bölge",
    folded: "turkiye iller haritasi",
  },
  {
    name: "Dünya Atlası",
    path: "/dunya",
    kind: "module",
    subtitle: "199 ülke ve kıtalar",
    folded: "dunya ulkeleri atlasi",
  },
  {
    name: "Denizler ve Kıyılar",
    path: "/deniz",
    kind: "module",
    subtitle: "Dört deniz ve kıyı tipleri",
    folded: "denizler ve kiyilar deniz durumu su sicakligi dalga",
  },
  {
    name: "Harita Oyunları",
    path: "/oyun",
    kind: "module",
    subtitle: "İlleri ve bölgeleri dilsiz haritada bul",
    folded: "harita oyunlari oyunu 81 il bolge dilsiz",
  },
  {
    name: "Son Depremler",
    path: "/deprem",
    kind: "module",
    subtitle: "AFAD'ın kaydettiği depremler",
    folded: "son depremler deprem afad",
  },
  {
    name: "Kuş Uçuşu Mesafe Ölçme",
    path: "/araclar/mesafe-olcme",
    kind: "tool",
    subtitle: "İki nokta arasını haritada ölç",
    folded: "kus ucusu mesafe olcme",
  },
  {
    name: "Koordinat Bulma",
    path: "/araclar/koordinat-bulma",
    kind: "tool",
    subtitle: "Bir noktanın enlemi ve boylamı",
    folded: "koordinat bulma donusturme",
  },
  {
    name: "Alan Hesaplama",
    path: "/araclar/alan-hesaplama",
    kind: "tool",
    subtitle: "Çizdiğin alan kaç km²",
    folded: "alan yuzolcumu hesaplama",
  },
  {
    name: "Kitaplar",
    path: "/kitaplar",
    kind: "module",
    subtitle: "Denemeler ve çözüm videoları",
    folded: "kitaplar cografya kitaplari denemeler",
  },
];

export function V2Hero({
  provinceCount,
  countryCount,
  title,
  lede,
  provinceStatLabel,
  countryStatLabel,
  modeCount,
  modeStatLabel,
}: V2HeroProps) {
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
              path: item[1],
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
    toast.success(`${name} açılıyor…`);
    // `@/i18n/navigation`'s router, not `next/navigation`'s: these are UNPREFIXED route keys
    // (`/turkiye`, `/dunya`), the same ones the tag links below hand to `Link`. A raw push sent
    // an `/en` reader to `/turkiye`, a path that does not exist under that locale. The cast is
    // this repo's documented spelling for a computed href (`CLAUDE.md`, "Href typing"), read
    // off `push` itself rather than off `Link` — the two href types differ in their query shape.
    router.push(path as unknown as Parameters<typeof router.push>[0]);
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
        toast.info(`"${query}" için sonuç yok. Bir il, ülke ya da araç adı yaz.`);
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
      toast.info("Aramak istediğin ili ya da ülkeyi yaz.");
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
            Araç
          </Badge>
        );
      case "module":
        return (
          <Badge variant="info" size="sm">
            Sayfa
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
    { label: "📍 İstanbul", path: "/turkiye/istanbul" },
    { label: "🌍 Japonya", path: "/dunya/japonya" },
    { label: "🌊 Marmara Denizi", path: "/deniz" },
    { label: "🎮 81 İl Oyunu", path: "/oyun" },
    { label: "📐 Mesafe Ölçme", path: "/araclar/mesafe-olcme" },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card to-muted/20 p-8 sm:p-12 lg:p-16 shadow-lg text-center">
      {/* Background Mesh Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-32 size-[640px] rounded-full bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-10 -mb-28 size-72 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 -mb-28 size-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto space-y-6">
        {/* Heading & Value Proposition */}
        <div className="space-y-3">
          {/* THE PROMISE IS THE WHOLE PLATFORM NOW, NOT THE MAP (T-068). "Coğrafyayı
              Ezberleme, Haritada Keşfet." named one of the six things behind it, and a reader
              arriving for the video-solved practice exams, the live telemetry or the GIS tools
              read a map site. The line no longer carries a hand-placed `<br>` either: the old
              one split a two-clause slogan at its comma, and a single sentence of this length
              has no such seam — `text-balance` evens the lines the browser chooses at every
              width instead. */}
          <h1 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-primary leading-[1.12] text-balance">
            {title}
          </h1>
          {/* The counts left this line with T-068 and the copy came off the two inline
              locale branches onto `Home.lede`. The counts are not lost: the stat trio right
              below still prints all three, live, and a sentence that lists six product areas
              has no room to spell two of them out again. */}
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl mx-auto text-pretty">
            {lede}
          </p>
          {/* Hero stat trio (T-026): reuses the Home namespace's existing bilingual
              statProvincesLabel/statCountriesLabel/statGameModesLabel copy (already correct in
              both messages/tr.json and messages/en.json, same pattern as the V1 homepage's stat
              strip) so EN renders real English numbers instead of showing nothing. */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground font-medium flex-wrap">
            <span>
              <strong className="font-heading text-foreground">{totalProvinces}</strong>{" "}
              {provinceStatLabel}
            </span>
            <span aria-hidden="true" className="text-border">
              &bull;
            </span>
            <span>
              <strong className="font-heading text-foreground">{totalCountries}</strong>{" "}
              {countryStatLabel}
            </span>
            <span aria-hidden="true" className="text-border">
              &bull;
            </span>
            <span>
              <strong className="font-heading text-foreground">{modeCount}</strong> {modeStatLabel}
            </span>
          </div>
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
                placeholder="İl, ülke, deniz ya da araç ara (ör. Balıkesir, Japonya, mesafe)"
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
                  Ara
                </Button>
              </div>
            </div>
          </form>

          {/* Auto-suggest Search Dropdown (Popover with safe z-index & backdrop) */}
          {isOpen && query.trim().length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl shadow-2xl border border-border bg-card/95 backdrop-blur-md z-50 animate-in fade-in-50 zoom-in-95 duration-100 space-y-1 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border/60">
                <span>{filteredResults.length} sonuç</span>
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
                        ? "bg-primary/10 text-primary-strong font-bold"
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
            <span className="text-muted-foreground text-[11px] font-medium">Kısayollar:</span>
            {QUICK_TAGS.map((tag) => (
              <Link
                key={tag.path}
                href={tag.path as unknown as React.ComponentProps<typeof Link>["href"]}
                // These five pills sit above the fold, so Next's default viewport
                // prefetch fires for all of them on every home page load, pulling in
                // each target's CSS/image preloads (e.g. the locator map + flag SVG on
                // /v2/dunya/japonya) even though a visitor clicks at most one — the
                // browser then warns the rest were "preloaded but not used" (T-029).
                // Prefetch on hover/focus instead, which only warms the one the
                // visitor is actually about to click.
                prefetch={false}
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
          <Link href="/turkiye">
            <Button
              variant="primary"
              size="lg"
              className="h-12 px-6 rounded-2xl shadow-md text-sm font-semibold cursor-pointer"
              rightIcon={<ArrowRight className="size-4" />}
            >
              Türkiye Haritası
            </Button>
          </Link>
          <Link href="/dunya">
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-6 rounded-2xl text-sm font-semibold bg-card/80 hover:bg-card border-border hover:border-primary/40 cursor-pointer"
              leftIcon={<Globe className="size-4 text-secondary" />}
            >
              Dünya Atlası
            </Button>
          </Link>
          <Link href="/oyun">
            <Button
              variant="secondary"
              size="lg"
              className="h-12 px-6 rounded-2xl text-sm font-semibold shadow-xs cursor-pointer"
              leftIcon={<Gamepad2 className="size-4" />}
            >
              Harita Oyunları
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
