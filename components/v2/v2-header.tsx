"use client";

import * as React from "react";
import Image from "next/image";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Map,
  Globe,
  Waves,
  Gamepad2,
  Flame,
  Layers,
  Boxes,
  Compass,
  BookOpen,
  User,
  LogIn,
  UserPlus,
  LogOut,
  ChevronDown,
  Menu,
  Settings,
  Search,
} from "lucide-react";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { SearchCombobox } from "@/components/site-search/search-combobox";
import { ThemeToggle } from "./theme-toggle";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { requestAuth } from "@/lib/auth/auth-modal.client";
import { submitAuth } from "@/lib/auth/submit.client";

export function V2Header() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const pathStr = (pathname as string) || "";
  const [authState, setAuthState] = useAuthSession();
  const [signingOut, setSigningOut] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [activeDropdown, setActiveDropdown] = React.useState<
    "atlas" | "telemetry" | "interactive" | "account" | null
  >(null);

  const navContainerRef = React.useRef<HTMLDivElement>(null);
  // T-061: the account menu sits OUTSIDE `navContainerRef`, on the other side of the header,
  // so the outside-click check needs both containers. One ref would have closed the account
  // menu the instant it opened, because its own trigger is outside the nav.
  const accountMenuRef = React.useRef<HTMLDivElement>(null);
  const accountBtnRef = React.useRef<HTMLButtonElement>(null);
  const atlasBtnRef = React.useRef<HTMLButtonElement>(null);
  const telemetryBtnRef = React.useRef<HTMLButtonElement>(null);
  const interactiveBtnRef = React.useRef<HTMLButtonElement>(null);

  const [prevPath, setPrevPath] = React.useState(pathStr);
  if (prevPath !== pathStr) {
    setPrevPath(pathStr);
    setActiveDropdown(null);
  }

  // Close dropdown on outside click or Escape key
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideNav = navContainerRef.current?.contains(target) ?? false;
      const insideAccount = accountMenuRef.current?.contains(target) ?? false;
      if (!insideNav && !insideAccount) {
        setActiveDropdown(null);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (activeDropdown === "atlas") {
          atlasBtnRef.current?.focus();
        } else if (activeDropdown === "telemetry") {
          telemetryBtnRef.current?.focus();
        } else if (activeDropdown === "interactive") {
          interactiveBtnRef.current?.focus();
        } else if (activeDropdown === "account") {
          accountBtnRef.current?.focus();
        }
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDropdown]);

  const isHome = pathStr === "/";
  const isAtlasActive =
    pathStr.startsWith("/turkiye") ||
    pathStr.startsWith("/turkiye") ||
    pathStr.startsWith("/dunya") ||
    pathStr.startsWith("/dunya");
  const isTelemetryActive =
    pathStr.startsWith("/deniz") ||
    pathStr.startsWith("/deniz") ||
    pathStr.startsWith("/deprem") ||
    pathStr.startsWith("/deprem");
  const isInteractiveActive =
    pathStr.startsWith("/oyun") ||
    pathStr.startsWith("/oyun") ||
    pathStr.startsWith("/araclar") ||
    pathStr.startsWith("/araclar");
  const isKitaplarActive = pathStr.startsWith("/kitaplar") || pathStr.startsWith("/kitaplar");

  const toggleDropdown = (name: "atlas" | "telemetry" | "interactive" | "account") => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await submitAuth("logout", {});
      setAuthState("anonymous");
      // `/hesabim` covers the settings page too, which lives under it. The old second
      // clause named `/profil`, a path that no longer renders anything (T-061).
      if (pathStr.startsWith("/hesabim")) {
        router.push("/");
      }
    } finally {
      setSigningOut(false);
      setMobileOpen(false);
    }
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-xl transition-all shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 min-w-0 lg:shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group min-w-0">
            <div className="relative size-10 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Image
                src="/brand/logo.png"
                alt="Coğrafya Gurmesi"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-heading text-lg font-bold tracking-tight text-primary dark:text-primary-strong leading-none truncate">
                Coğrafya Gurmesi
              </span>
              <span className="text-[10px] text-muted-foreground font-medium truncate">
                Atlas &amp; Eğitim Portalı
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Grouped Navigation Menu */}
        <div ref={navContainerRef} className="hidden lg:flex items-center gap-1.5 relative">
          {/* Atlas & Haritalar Dropdown */}
          <div className="relative">
            <button
              ref={atlasBtnRef}
              type="button"
              onClick={() => toggleDropdown("atlas")}
              aria-expanded={activeDropdown === "atlas"}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer ${
                isAtlasActive && !isHome
                  ? "bg-primary/10 text-primary-strong font-bold border border-primary/20"
                  : activeDropdown === "atlas"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <span>Atlas & Harita</span>
              <ChevronDown
                className={`size-3 opacity-60 ml-0.5 transition-transform duration-200 ${activeDropdown === "atlas" ? "rotate-180" : ""}`}
              />
            </button>

            {activeDropdown === "atlas" && (
              <div className="absolute top-full left-0 mt-2 w-56 p-2 rounded-2xl shadow-xl border border-border bg-card z-50 animate-in fade-in-50 zoom-in-95 duration-100 space-y-1">
                <div className="text-[11px] font-bold text-muted-foreground px-2 py-1">
                  Coğrafi Atlaslar
                </div>
                <Link
                  href="/turkiye"
                  onClick={() => setActiveDropdown(null)}
                  className="flex items-center p-2 rounded-xl hover:bg-muted transition-colors group cursor-pointer"
                >
                  <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center mr-2 shrink-0 group-hover:scale-105 transition-transform">
                    <Map className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-foreground group-hover:text-primary transition-colors">
                      Türkiye İlleri
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      81 İl &amp; Mülki İdare
                    </span>
                  </div>
                </Link>
                <Link
                  href="/turkiye/bolge"
                  onClick={() => setActiveDropdown(null)}
                  className="flex items-center p-2 rounded-xl hover:bg-muted transition-colors group cursor-pointer"
                >
                  <div className="size-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center mr-2 shrink-0 group-hover:scale-105 transition-transform">
                    <Boxes className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-foreground group-hover:text-accent transition-colors">
                      Coğrafi Bölgeler
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      7 Bölge &amp; 21 Alt Bölüm
                    </span>
                  </div>
                </Link>
                <Link
                  href="/dunya"
                  onClick={() => setActiveDropdown(null)}
                  className="flex items-center p-2 rounded-xl hover:bg-muted transition-colors group cursor-pointer"
                >
                  <div className="size-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center mr-2 shrink-0 group-hover:scale-105 transition-transform">
                    <Globe className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-foreground group-hover:text-secondary transition-colors">
                      Dünya Atlası
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      199 Ülke, Kıtalar &amp; Bayraklar
                    </span>
                  </div>
                </Link>
                <Link
                  href="/dunya/kita"
                  onClick={() => setActiveDropdown(null)}
                  className="flex items-center p-2 rounded-xl hover:bg-muted transition-colors group cursor-pointer"
                >
                  <div className="size-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center mr-2 shrink-0 group-hover:scale-105 transition-transform">
                    <Compass className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-foreground group-hover:text-secondary transition-colors">
                      Kıtalar Atlası
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      7 Kıta &amp; Karakteristikleri
                    </span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Canlı Telemetri Dropdown */}
          <div className="relative">
            <button
              ref={telemetryBtnRef}
              type="button"
              onClick={() => toggleDropdown("telemetry")}
              aria-expanded={activeDropdown === "telemetry"}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer ${
                isTelemetryActive
                  ? "bg-accent/10 text-accent font-bold border border-accent/20"
                  : activeDropdown === "telemetry"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <span>Canlı Telemetri</span>
              <ChevronDown
                className={`size-3 opacity-60 ml-0.5 transition-transform duration-200 ${activeDropdown === "telemetry" ? "rotate-180" : ""}`}
              />
            </button>

            {activeDropdown === "telemetry" && (
              <div className="absolute top-full left-0 mt-2 w-64 p-2 rounded-2xl shadow-xl border border-border bg-card z-50 animate-in fade-in-50 zoom-in-95 duration-100 space-y-1">
                <div className="text-[11px] font-bold text-muted-foreground px-2 py-1">
                  Gerçek Zamanlı Gözlemler
                </div>
                <Link
                  href="/deniz"
                  onClick={() => setActiveDropdown(null)}
                  className="flex items-center p-2 rounded-xl hover:bg-muted transition-colors group cursor-pointer"
                >
                  <div className="size-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center mr-2 shrink-0 group-hover:scale-105 transition-transform">
                    <Waves className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-foreground group-hover:text-accent transition-colors">
                      Deniz Telemetrisi
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Copernicus Su Sıcaklığı & Dalga
                    </span>
                  </div>
                </Link>
                <Link
                  href="/deprem"
                  onClick={() => setActiveDropdown(null)}
                  className="flex items-center p-2 rounded-xl hover:bg-muted transition-colors group cursor-pointer"
                >
                  <div className="size-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center mr-2 shrink-0 group-hover:scale-105 transition-transform">
                    <Flame className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-foreground group-hover:text-destructive transition-colors">
                      Canlı Deprem Radarı
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      AFAD TDVMS Sismik Ağı
                    </span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Etkileşim & Araçlar Dropdown */}
          <div className="relative">
            <button
              ref={interactiveBtnRef}
              type="button"
              onClick={() => toggleDropdown("interactive")}
              aria-expanded={activeDropdown === "interactive"}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer ${
                isInteractiveActive
                  ? "bg-secondary/10 text-secondary font-bold border border-secondary/20"
                  : activeDropdown === "interactive"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <span>Etkileşim & Araçlar</span>
              <ChevronDown
                className={`size-3 opacity-60 ml-0.5 transition-transform duration-200 ${activeDropdown === "interactive" ? "rotate-180" : ""}`}
              />
            </button>

            {activeDropdown === "interactive" && (
              <div className="absolute top-full left-0 mt-2 w-64 p-2 rounded-2xl shadow-xl border border-border bg-card z-50 animate-in fade-in-50 zoom-in-95 duration-100 space-y-1">
                <div className="text-[11px] font-bold text-muted-foreground px-2 py-1">
                  Oyunlar & CBS Laboratuvarı
                </div>
                <Link
                  href="/oyun"
                  onClick={() => setActiveDropdown(null)}
                  className="flex items-center p-2 rounded-xl hover:bg-muted transition-colors group cursor-pointer"
                >
                  <div className="size-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center mr-2 shrink-0 group-hover:scale-105 transition-transform">
                    <Gamepad2 className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-foreground group-hover:text-secondary transition-colors">
                      Harita Oyunu
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      81 İl Bulma & Hız Sınavı
                    </span>
                  </div>
                </Link>
                <Link
                  href="/araclar"
                  onClick={() => setActiveDropdown(null)}
                  className="flex items-center p-2 rounded-xl hover:bg-muted transition-colors group cursor-pointer"
                >
                  <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center mr-2 shrink-0 group-hover:scale-105 transition-transform">
                    <Layers className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-foreground group-hover:text-primary transition-colors">
                      CBS Harita Araçları
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Mesafe Ölçme & Alan Hesaplama
                    </span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Kitaplar (Kütüphane) Direct Link with Dedicated Badge */}
          <Link
            href="/kitaplar"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isKitaplarActive
                ? "bg-primary/10 text-primary-strong font-bold border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <span>Kitaplar</span>
            <Badge variant="warning" className="text-[9px] py-0 px-1 font-bold">
              Video Çözümlü
            </Badge>
          </Link>
        </div>

        {/* Right Side Actions & Mobile Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Global Search Combobox (Ctrl+K) */}
          <SearchCombobox
            variant="v2"
            pathPrefix="/"
            enableGlobalShortcut={true}
            provinceIndexHref="/turkiye"
            countryIndexHref="/dunya"
            indexUrl={`/api/search-index/${locale}`}
          />

          {/* Theme Toggle (Dark / Light) */}
          <ThemeToggle />

          {authState === "authenticated" ? (
            /* T-061: ONE account control instead of two.
               The header used to carry a "Hesabım" link and a "Çıkış Yap" button side by
               side, and the hub hero carried a third sign-out below them. Two of those three
               are gone; what remains is a single trigger holding the three things a
               signed-in member does from the chrome.

               It is the same DISCLOSURE pattern the three nav dropdowns in this file already
               use — `aria-expanded` on a button, a labelled container of links below it, Tab
               through them, Escape closes and returns focus. Deliberately not a `role="menu"`
               widget: one header with two different menu mechanisms is worse than one with a
               pattern used four times. */
            <div ref={accountMenuRef} className="hidden lg:block relative">
              <button
                ref={accountBtnRef}
                type="button"
                onClick={() => toggleDropdown("account")}
                aria-expanded={activeDropdown === "account"}
                aria-label="Hesap menüsü"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
                  activeDropdown === "account"
                    ? "bg-muted text-foreground border-border"
                    : "bg-card border-border hover:bg-muted/50"
                }`}
              >
                <span className="size-2 rounded-full bg-success" />
                <User className="size-3.5 text-primary" />
                <span>Hesabım</span>
                <ChevronDown
                  className={`size-3 opacity-60 ml-0.5 transition-transform duration-200 ${activeDropdown === "account" ? "rotate-180" : ""}`}
                />
              </button>

              {activeDropdown === "account" && (
                <div className="absolute top-full right-0 mt-2 w-52 p-2 rounded-2xl shadow-xl border border-border bg-card z-50 animate-in fade-in-50 zoom-in-95 duration-100 space-y-1">
                  <Link
                    href="/hesabim"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <User className="size-3.5 text-primary" />
                    Hesabım
                  </Link>
                  <Link
                    href="/hesabim/ayarlar"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Settings className="size-3.5 text-primary" />
                    Ayarlar
                  </Link>
                  <div className="pt-1 border-t border-border/80">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        void handleSignOut();
                      }}
                      disabled={signingOut}
                      className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {signingOut ? (
                        <Spinner size="sm" label="Çıkış yapılıyor" />
                      ) : (
                        <LogOut className="size-3.5" />
                      )}
                      Çıkış Yap
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground font-semibold"
                leftIcon={<LogIn className="size-3.5" />}
                onClick={() => requestAuth("generic", "login")}
              >
                Giriş Yap
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="text-xs h-8 px-3 font-semibold shadow-xs"
                leftIcon={<UserPlus className="size-3.5" />}
                onClick={() => requestAuth("generic", "register")}
              >
                Üye Ol
              </Button>
            </div>
          )}

          {/* Mobile Drawer Hamburger Trigger */}
          <div className="lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                aria-label="Menüyü Aç"
                className="size-9 rounded-xl border border-border/80 bg-card hover:bg-muted flex items-center justify-center text-foreground transition-colors cursor-pointer"
              >
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[85vw] sm:w-96 p-0 flex flex-col justify-between"
              >
                <SheetHeader className="p-5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Image
                        src="/brand/logo.png"
                        alt="Coğrafya Gurmesi"
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                      <SheetTitle className="text-base font-bold text-foreground">
                        Coğrafya <span className="text-primary">Gurmesi</span>
                      </SheetTitle>
                    </div>
                  </div>
                </SheetHeader>

                <div className="p-4 space-y-6 overflow-y-auto flex-1">
                  {/* Mobile Quick Search Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      const searchBtn = (document.querySelector('[data-testid="global-search"]') ||
                        document.querySelector(
                          '[data-testid="global-search-mobile"]',
                        )) as HTMLElement;
                      searchBtn?.click();
                    }}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-2xs"
                  >
                    <Search className="size-4 text-primary" />
                    <span>İl veya Ülke Ara...</span>
                  </button>

                  {/* Category 1: Atlas */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">
                      Atlas & Harita
                    </span>
                    <div className="space-y-1">
                      <Link
                        href="/turkiye"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Map className="size-4 text-primary" />
                          <span className="truncate text-sm font-semibold text-foreground">
                            Türkiye İlleri
                          </span>
                        </div>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">81 İl</span>
                      </Link>
                      <Link
                        href="/turkiye/bolge"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Boxes className="size-4 text-accent" />
                          <span className="truncate text-sm font-semibold text-foreground">
                            Coğrafi Bölgeler
                          </span>
                        </div>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">7 Bölge</span>
                      </Link>
                      <Link
                        href="/dunya"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Globe className="size-4 text-secondary" />
                          <span className="truncate text-sm font-semibold text-foreground">
                            Dünya Atlası
                          </span>
                        </div>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          199 Ülke
                        </span>
                      </Link>
                      <Link
                        href="/dunya/kita"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Compass className="size-4 text-secondary" />
                          <span className="truncate text-sm font-semibold text-foreground">
                            Kıtalar Atlası
                          </span>
                        </div>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">7 Kıta</span>
                      </Link>
                    </div>
                  </div>

                  {/* Category 2: Telemetri */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">
                      Canlı Telemetri
                    </span>
                    <div className="space-y-1">
                      <Link
                        href="/deniz"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Waves className="size-4 text-accent" />
                          <span className="truncate text-sm font-semibold text-foreground">
                            Deniz Telemetrisi
                          </span>
                        </div>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          Canlı Dalga/Isı
                        </span>
                      </Link>
                      <Link
                        href="/deprem"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Flame className="size-4 text-destructive" />
                          <span className="truncate text-sm font-semibold text-foreground">
                            Canlı Deprem
                          </span>
                        </div>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          AFAD TDVMS
                        </span>
                      </Link>
                    </div>
                  </div>

                  {/* Category 3: Etkileşim & Kitaplar */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">
                      Eğitim & Araçlar
                    </span>
                    <div className="space-y-1">
                      <Link
                        href="/oyun"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Gamepad2 className="size-4 text-secondary" />
                          <span className="truncate text-sm font-semibold text-foreground">
                            Harita Oyunu
                          </span>
                        </div>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          İl Bulma
                        </span>
                      </Link>
                      <Link
                        href="/araclar"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Layers className="size-4 text-primary" />
                          <span className="truncate text-sm font-semibold text-foreground">
                            CBS Araçları
                          </span>
                        </div>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          Mesafe/Alan
                        </span>
                      </Link>
                      <Link
                        href="/kitaplar"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <BookOpen className="size-4 text-primary" />
                          <span className="truncate text-sm font-semibold text-foreground">
                            Video Çözümlü Kitaplar
                          </span>
                        </div>
                        <Badge variant="primary" size="sm" className="ml-2 shrink-0">
                          20 Deneme
                        </Badge>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Mobile Drawer Auth Footer */}
                <div className="p-4 border-t border-border bg-muted/30 space-y-3">
                  {/* Theme Switcher Row in Mobile Drawer */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border">
                    <span className="text-xs font-semibold text-foreground">Görünüm Teması</span>
                    <ThemeToggle />
                  </div>

                  {authState !== "authenticated" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setMobileOpen(false);
                          requestAuth("generic", "login");
                        }}
                      >
                        Giriş Yap
                      </Button>
                      <Button
                        variant="primary"
                        className="w-full"
                        onClick={() => {
                          setMobileOpen(false);
                          requestAuth("generic", "register");
                        }}
                      >
                        Üye Ol
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* T-061: the same three entries the desktop menu holds, in the same
                          order. The label was "Hesabım & Profil" and pointed at the hub —
                          an ampersand promising a second destination that was never here. */}
                      <Link
                        href="/hesabim"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <User className="size-4 text-primary" />
                          <span className="text-xs font-bold text-foreground">Hesabım</span>
                        </div>
                        <Badge
                          variant="outline"
                          size="sm"
                          className="bg-success/10 text-success-strong border-success/30"
                        >
                          Aktif
                        </Badge>
                      </Link>
                      <Link
                        href="/hesabim/ayarlar"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border hover:bg-muted/50 transition-colors"
                      >
                        <Settings className="size-4 text-primary" />
                        <span className="text-xs font-bold text-foreground">Ayarlar</span>
                      </Link>
                      <Button
                        variant="outline"
                        className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 text-xs font-semibold gap-2"
                        onClick={handleSignOut}
                        disabled={signingOut}
                        leftIcon={
                          signingOut ? (
                            <Spinner size="default" label="Çıkış yapılıyor" />
                          ) : (
                            <LogOut className="size-4" />
                          )
                        }
                      >
                        Çıkış Yap
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
