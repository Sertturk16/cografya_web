"use client";

import * as React from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Compass,
  Map,
  Globe,
  Waves,
  Gamepad2,
  Flame,
  Layers,
  Sparkles,
  BookOpen,
  User,
  LogIn,
  UserPlus,
  ChevronDown,
  Menu,
  ArrowRight,
  ShieldCheck,
  Search,
  ExternalLink,
} from "lucide-react";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { requestAuth, setAuthModalMode } from "@/lib/auth/auth-modal.client";
import { V2AuthDialog } from "./v2-auth-dialog";

export function V2Header() {
  const pathname = usePathname();
  const pathStr = (pathname as string) || "";
  const [authState] = useAuthSession();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [activeDropdown, setActiveDropdown] = React.useState<"atlas" | "telemetry" | "interactive" | null>(null);
  const navContainerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on route change
  React.useEffect(() => {
    setActiveDropdown(null);
  }, [pathStr]);

  // Close dropdown on outside click or Escape key
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const isHome = pathStr === "/v2";
  const isAtlasActive =
    pathStr.startsWith("/v2/turkiye") ||
    pathStr.startsWith("/turkiye") ||
    pathStr.startsWith("/v2/dunya") ||
    pathStr.startsWith("/dunya");
  const isTelemetryActive =
    pathStr.startsWith("/v2/deniz") ||
    pathStr.startsWith("/deniz") ||
    pathStr.startsWith("/v2/deprem") ||
    pathStr.startsWith("/deprem");
  const isInteractiveActive =
    pathStr.startsWith("/v2/oyun") ||
    pathStr.startsWith("/oyun") ||
    pathStr.startsWith("/v2/araclar") ||
    pathStr.startsWith("/araclar");
  const isKitaplarActive =
    pathStr.startsWith("/v2/kitaplar") || pathStr.startsWith("/kitaplar");

  const toggleDropdown = (name: "atlas" | "telemetry" | "interactive") => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-xl transition-all shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/v2" className="flex items-center gap-2.5 group">
            <div className="size-9 rounded-xl bg-gradient-to-br from-[var(--color-primary,#b0522e)] to-[var(--color-primary-dark,#7e3a1e)] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <Compass className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-lg font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-none">
                Coğrafya<span className="text-primary font-normal">.v2</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                Yeni Nesil Coğrafya Portalı
              </span>
            </div>
          </Link>
          <Badge
            variant="outline"
            size="sm"
            className="hidden xl:inline-flex text-[10px] font-mono border-primary/30 text-primary"
          >
            v2.0 Beta
          </Badge>
        </div>

        {/* Desktop Grouped Navigation Menu */}
        <div ref={navContainerRef} className="hidden lg:flex items-center gap-1.5 relative">
          {/* Ana Sayfa */}
          <Link
            href="/v2"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isHome
                ? "bg-[var(--color-primary,#b0522e)] text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <Sparkles className="size-3.5" />
            <span>Ana Sayfa</span>
          </Link>

          {/* Atlas & Haritalar Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown("atlas")}
              aria-expanded={activeDropdown === "atlas"}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all outline-none cursor-pointer ${
                isAtlasActive && !isHome
                  ? "bg-primary/10 text-primary font-bold border border-primary/20"
                  : activeDropdown === "atlas"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <Map className="size-3.5 text-primary" />
              <span>Atlas & Harita</span>
              <ChevronDown className={`size-3 opacity-60 ml-0.5 transition-transform duration-200 ${activeDropdown === "atlas" ? "rotate-180" : ""}`} />
            </button>

            {activeDropdown === "atlas" && (
              <div className="absolute top-full left-0 mt-2 w-56 p-2 rounded-2xl shadow-xl border border-border bg-card z-50 animate-in fade-in-50 zoom-in-95 duration-100 space-y-1">
                <div className="text-[11px] font-bold text-muted-foreground px-2 py-1">
                  Coğrafi Atlaslar
                </div>
                <Link
                  href="/v2/turkiye"
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
                      81 İl & 7 Coğrafi Bölge
                    </span>
                  </div>
                </Link>
                <Link
                  href="/v2/dunya"
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
                      199 Ülke, Kıtalar & Bayraklar
                    </span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Canlı Telemetri Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown("telemetry")}
              aria-expanded={activeDropdown === "telemetry"}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all outline-none cursor-pointer ${
                isTelemetryActive
                  ? "bg-accent/10 text-accent font-bold border border-accent/20"
                  : activeDropdown === "telemetry"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <Waves className="size-3.5 text-accent" />
              <span>Canlı Telemetri</span>
              <ChevronDown className={`size-3 opacity-60 ml-0.5 transition-transform duration-200 ${activeDropdown === "telemetry" ? "rotate-180" : ""}`} />
            </button>

            {activeDropdown === "telemetry" && (
              <div className="absolute top-full left-0 mt-2 w-64 p-2 rounded-2xl shadow-xl border border-border bg-card z-50 animate-in fade-in-50 zoom-in-95 duration-100 space-y-1">
                <div className="text-[11px] font-bold text-muted-foreground px-2 py-1">
                  Gerçek Zamanlı Gözlemler
                </div>
                <Link
                  href="/v2/deniz"
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
                  href="/v2/deprem"
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
              type="button"
              onClick={() => toggleDropdown("interactive")}
              aria-expanded={activeDropdown === "interactive"}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all outline-none cursor-pointer ${
                isInteractiveActive
                  ? "bg-secondary/10 text-secondary font-bold border border-secondary/20"
                  : activeDropdown === "interactive"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <Gamepad2 className="size-3.5 text-secondary" />
              <span>Etkileşim & Araçlar</span>
              <ChevronDown className={`size-3 opacity-60 ml-0.5 transition-transform duration-200 ${activeDropdown === "interactive" ? "rotate-180" : ""}`} />
            </button>

            {activeDropdown === "interactive" && (
              <div className="absolute top-full left-0 mt-2 w-64 p-2 rounded-2xl shadow-xl border border-border bg-card z-50 animate-in fade-in-50 zoom-in-95 duration-100 space-y-1">
                <div className="text-[11px] font-bold text-muted-foreground px-2 py-1">
                  Oyunlar & CBS Laboratuvarı
                </div>
                <Link
                  href="/v2/oyun"
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
                  href="/v2/araclar"
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
            href="/v2/kitaplar"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isKitaplarActive
                ? "bg-amber-600/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <BookOpen className="size-3.5 text-amber-600 dark:text-amber-400" />
            <span>Kitaplar</span>
            <Badge variant="outline" className="text-[9px] py-0 px-1 font-bold bg-amber-500/10 text-amber-600 border-amber-500/20">
              Video Çözümlü
            </Badge>
          </Link>
        </div>

        {/* Right Side Actions & Mobile Trigger */}
        <div className="flex items-center gap-2">
          {authState === "authenticated" ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold shadow-2xs">
              <span className="size-2 rounded-full bg-emerald-500" />
              <User className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Hesabım</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground font-semibold"
                leftIcon={<LogIn className="size-3.5" />}
                onClick={() => {
                  requestAuth("generic");
                  setAuthModalMode("login");
                }}
              >
                Giriş Yap
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="text-xs h-8 px-3 font-semibold shadow-xs"
                leftIcon={<UserPlus className="size-3.5" />}
                onClick={() => {
                  requestAuth("generic");
                  setAuthModalMode("register");
                }}
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
              <SheetContent side="right" className="w-[85vw] sm:w-96 p-0 flex flex-col justify-between">
                <SheetHeader className="p-5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary flex items-center justify-center text-white">
                        <Compass className="size-4.5" />
                      </div>
                      <SheetTitle className="text-base font-bold text-foreground">
                        Coğrafya<span className="text-primary font-normal">.v2</span>
                      </SheetTitle>
                    </div>
                  </div>
                </SheetHeader>

                <div className="p-4 space-y-6 overflow-y-auto flex-1">
                  {/* Category 1: Atlas */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">
                      Atlas & Harita
                    </span>
                    <div className="space-y-1">
                      <Link
                        href="/v2/turkiye"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Map className="size-4 text-primary" />
                          <span className="text-sm font-semibold text-foreground">Türkiye İlleri</span>
                        </div>
                        <span className="text-xs text-muted-foreground">81 İl</span>
                      </Link>
                      <Link
                        href="/v2/dunya"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Globe className="size-4 text-secondary" />
                          <span className="text-sm font-semibold text-foreground">Dünya Atlası</span>
                        </div>
                        <span className="text-xs text-muted-foreground">199 Ülke</span>
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
                        href="/v2/deniz"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Waves className="size-4 text-accent" />
                          <span className="text-sm font-semibold text-foreground">Deniz Telemetrisi</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Canlı Dalga/Isı</span>
                      </Link>
                      <Link
                        href="/v2/deprem"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Flame className="size-4 text-destructive" />
                          <span className="text-sm font-semibold text-foreground">Canlı Deprem</span>
                        </div>
                        <span className="text-xs text-muted-foreground">AFAD TDVMS</span>
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
                        href="/v2/oyun"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Gamepad2 className="size-4 text-secondary" />
                          <span className="text-sm font-semibold text-foreground">Harita Oyunu</span>
                        </div>
                        <span className="text-xs text-muted-foreground">İl Bulma</span>
                      </Link>
                      <Link
                        href="/v2/araclar"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Layers className="size-4 text-primary" />
                          <span className="text-sm font-semibold text-foreground">CBS Araçları</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Mesafe/Alan</span>
                      </Link>
                      <Link
                        href="/v2/kitaplar"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold"
                      >
                        <div className="flex items-center gap-2.5">
                          <BookOpen className="size-4 text-amber-600" />
                          <span className="text-sm">Video Çözümlü Kitaplar</span>
                        </div>
                        <Badge variant="primary" size="sm">20 Deneme</Badge>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Mobile Drawer Auth Footer */}
                <div className="p-4 border-t border-border bg-muted/30 space-y-2">
                  {authState !== "authenticated" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setMobileOpen(false);
                          setAuthModalMode("login");
                          requestAuth("generic");
                        }}
                      >
                        Giriş Yap
                      </Button>
                      <Button
                        variant="primary"
                        className="w-full"
                        onClick={() => {
                          setMobileOpen(false);
                          setAuthModalMode("register");
                          requestAuth("generic");
                        }}
                      >
                        Üye Ol
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                      <div className="flex items-center gap-2">
                        <User className="size-4 text-primary" />
                        <span className="text-xs font-bold text-foreground">Oturum Açık</span>
                      </div>
                      <Badge variant="outline" size="sm" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        Aktif
                      </Badge>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* V2 Integrated Auth Modal */}
      <V2AuthDialog />
    </nav>
  );
}
