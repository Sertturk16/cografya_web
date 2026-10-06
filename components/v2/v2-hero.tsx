"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Gamepad2,
  Search,
  Sparkles,
  ArrowRight,
  Compass,
  MapPin,
  Map as MapIcon,
  Earth,
  Waves,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchCombobox } from "@/components/site-search/use-search-combobox";
import { useSearchIndex } from "@/components/site-search/use-search-index";
import { KIND_LABEL_KEY } from "@/lib/search/kind-label";
import { searchPrepared } from "@/lib/search/match";
import { searchPanelState } from "@/lib/search/panel-state";
import type { SearchEntityKind } from "@/lib/search/types";

interface V2HeroProps {
  /** The `<h1>`. `Home.heading`, resolved on the server — see this file's hero docblock. */
  title: string;
  /** The value proposition under it. `Home.lede`, same source. */
  lede: string;
  /** The stat trio under the lede, rendered by the server (it waits on two fetches). */
  stats: React.ReactNode;
}

/** Rows the hero's suggestion panel shows; the header box shows eight in a taller dialog. */
const RESULT_LIMIT = 6;

/** Same tie-break as the header box: province names are Turkish in both locales. */
const COLLATION_LOCALE = "tr";

/** Badge colour per result kind. The label text, not the colour, carries the meaning. */
const KIND_BADGE = {
  p: "primary",
  c: "secondary",
  r: "default",
  k: "chip",
  s: "info",
  t: "outline",
  g: "outline",
} as const satisfies Record<SearchEntityKind, React.ComponentProps<typeof Badge>["variant"]>;

function KindIcon({ kind }: { kind: SearchEntityKind }) {
  switch (kind) {
    case "p":
      return <MapPin className="size-4 text-primary" />;
    case "c":
      return <Globe className="size-4 text-secondary" />;
    case "r":
      return <MapIcon className="size-4 text-primary" />;
    case "k":
      return <Earth className="size-4 text-secondary" />;
    case "s":
      return <Waves className="size-4 text-accent" />;
    case "t":
      return <Compass className="size-4 text-primary" />;
    case "g":
      return <Sparkles className="size-4 text-accent" />;
  }
}

/**
 * The homepage hero, with the site's second search box.
 *
 * ONE INDEX, ONE MATCHER (T-164). This box used to fetch the Turkish index on every mount,
 * filter it with a plain substring test and append nine hard-coded shortcuts, so "Asya" found
 * Amasya and the header box could not find a tool at all. It now reads the same
 * `/api/search-index/{locale}` through the same loader as the header, on the reader's first
 * focus rather than on mount, and ranks with the same `searchPrepared`. The shortcuts moved
 * into the server index as tools and pages.
 *
 * ONE COMBOBOX BEHAVIOUR (T-168). The box is the header's ARIA combobox with a listbox of
 * options, through the shared `useSearchCombobox`: the same keys, ids, active option and
 * debounced result announcement. Only the markup is the hero's own (inline panel, kind icons
 * and badges), and Escape is handled here because the hero has no dialog to own it.
 */
export function V2Hero({ title, lede, stats }: V2HeroProps) {
  const t = useTranslations("Search");
  const locale = useLocale();
  const [query, setQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);
  const { entries, loadFailed, incomplete, ensureIndex } = useSearchIndex(
    `/api/search-index/${locale}`,
  );

  const hits = React.useMemo(
    () =>
      entries === null
        ? []
        : searchPrepared(entries, query, {
            limit: RESULT_LIMIT,
            collationLocale: COLLATION_LOCALE,
          }),
    [entries, query],
  );
  const hasQuery = query.trim().length > 0;
  const panelState = searchPanelState({
    entryCount: entries === null ? null : entries.length,
    loadFailed,
    incomplete,
    hasQuery,
    hitCount: hits.length,
  });
  // Options exist only while the results panel shows; `aria-expanded` follows that.
  const panelShown = isOpen && panelState !== "idle" && panelState !== "loading";
  const combobox = useSearchCombobox({
    open: panelShown,
    hasQuery,
    panelState,
    optionCount: panelShown && panelState === "results" ? hits.length : 0,
    onSelect: (index) => {
      const hit = hits[index];
      if (hit) handleNavigate(hit.path, hit.name);
    },
  });

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
    toast.success(t("opening", { name }));
    // The index carries FINAL localized paths (`getPathname` on the server), so they are
    // followed as they are, the way the header box follows them. Handing one to next-intl's
    // router would treat it as a route key and prefix the locale a second time on `/en`.
    window.location.assign(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      combobox.resetActive();
      return;
    }
    // A closed panel opens on ArrowDown first, the way a native combobox does.
    if (e.key === "ArrowDown" && !isOpen && hits.length > 0) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }
    if (combobox.handleKey(e)) return;
    if (e.key === "Enter") {
      // No option to open: the form's submit says why (or asks for a query) and shows the panel.
      e.preventDefault();
      if (hasQuery) setIsOpen(true);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = hits[0];
    if (target) {
      handleNavigate(target.path, target.name);
    } else if (query.trim()) {
      setIsOpen(true);
    } else {
      toast.info(t("emptyQuery"));
    }
  };

  // Curated top quick access targets
  const QUICK_TAGS = [
    { label: "📍 İstanbul", path: "/turkiye/istanbul" },
    { label: "🌍 Japonya", path: "/dunya/japonya" },
    { label: "🌊 Marmara Denizi", path: "/deniz/marmara" },
    { label: "🎮 81 İl Oyunu", path: "/oyun" },
    { label: "📐 Mesafe Ölçme", path: "/araclar/mesafe-olcme" },
  ];

  return (
    <section className="relative rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card to-muted/20 p-8 sm:p-12 lg:p-16 shadow-lg text-center">
      {/* Background mesh glows. The CLIP lives on this layer, not on the section: a clipping
          section also cut off the search suggestions, which hang below the hero's bottom
          edge once there are more than two of them. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-32 size-[640px] rounded-full bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-10 -mb-28 size-72 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute bottom-0 left-10 -mb-28 size-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

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
          {stats}
        </div>

        {/* Central Omni-Search Bar (Interactive & Integrated) */}
        <div ref={searchContainerRef} className="pt-2 max-w-2xl mx-auto relative text-left">
          <form onSubmit={handleSearchSubmit} className="relative group">
            <div className="relative flex items-center rounded-2xl border border-border/90 bg-card/95 shadow-md backdrop-blur-md transition-all duration-200 group-hover:border-primary/40 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 focus-within:shadow-xl">
              <div className="pl-4.5 pr-2 flex items-center pointer-events-none text-primary shrink-0">
                <Search className="size-5" />
              </div>
              <input
                {...combobox.inputProps}
                type="text"
                autoComplete="off"
                enterKeyHint="search"
                // The visible text is examples, so the accessible name says what is searchable.
                aria-label={t("label")}
                placeholder={t("heroPlaceholder")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                  combobox.resetActive();
                  void ensureIndex();
                }}
                onFocus={() => {
                  // The index loads on the reader's first focus, not on every homepage visit.
                  void ensureIndex();
                  if (query.trim()) setIsOpen(true);
                }}
                onKeyDown={handleKeyDown}
                className="h-14 bg-transparent text-foreground placeholder:text-muted-foreground text-sm sm:text-base outline-none min-w-0 flex-1 pr-2 pl-1"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setIsOpen(false);
                    combobox.resetActive();
                  }}
                  className="p-1.5 mr-2 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg hover:bg-muted transition-colors"
                  aria-label={t("clearLabel")}
                >
                  <X className="size-4" />
                </button>
              )}
              {/* In the row, not laid over the input: the overlay version reserved 112px of the
                  input for itself and hid the clear button under it. Below `sm` the keyboard's
                  own search key submits, and the input gets the width back. */}
              <div className="hidden sm:flex shrink-0 items-center mr-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="h-10 px-5 rounded-xl shadow-xs text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  {t("triggerLabel")}
                </Button>
              </div>
            </div>
          </form>

          {/* Suggestion panel. Nothing while the index is still loading: an empty "0 sonuç"
              header would be a false answer for a query the index may well match. The count row
              sits OUTSIDE the listbox (a listbox owns only options); screen readers hear the
              count from the status region below instead. */}
          {panelShown && (
            <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl shadow-2xl border border-border bg-card/95 backdrop-blur-md z-50 animate-in fade-in-50 zoom-in-95 duration-100 space-y-1 max-h-80 overflow-y-auto">
              {panelState === "results" ? (
                <>
                  <div
                    aria-hidden="true"
                    className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border/60"
                  >
                    <span>{t("resultCount", { count: hits.length })}</span>
                    <span className="font-mono text-[10px]">{t("enterHint")}</span>
                  </div>
                  <ul {...combobox.listboxProps} aria-label={t("label")} className="space-y-1">
                    {hits.map((hit, index) => (
                      <li key={hit.path} role="presentation">
                        <a
                          {...combobox.optionProps(index, hit)}
                          href={hit.path}
                          onClick={(e) => {
                            e.preventDefault();
                            handleNavigate(hit.path, hit.name);
                          }}
                          className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                            combobox.activeIndex === index
                              ? "bg-primary/10 text-primary-strong font-bold"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="size-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <KindIcon kind={hit.kind} />
                            </div>
                            <div className="min-w-0 font-bold text-xs">{hit.name}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Badge variant={KIND_BADGE[hit.kind]} size="sm">
                              {t(KIND_LABEL_KEY[hit.kind])}
                            </Badge>
                            <ArrowRight className="size-3 text-muted-foreground" />
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {panelState === "noResults" ? t("noResults") : t("loadFailed")}
                </div>
              )}
            </div>
          )}

          <div role="status" aria-live="polite" className="sr-only">
            {combobox.announcement}
          </div>

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
