"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { Session, Profile, FavoriteEntityType } from "@/lib/api/types";
import {
  fetchFavorites,
  removeFavorite,
  type FavoriteRecord,
  FAVORITES_FETCH_TIMEOUT_MS,
} from "@/lib/favorites/client";
import {
  fetchMeasurements,
  removeMeasurement,
  type MeasurementRecord,
  MEASUREMENTS_FETCH_TIMEOUT_MS,
} from "@/lib/measurements/client";
import {
  fetchBookProgress,
  type BookProgressValue,
  VIDEO_PROGRESS_FETCH_TIMEOUT_MS,
} from "@/lib/video-progress/client";
import {
  fetchGameRounds,
  type GameRoundRecord,
  GAME_ROUNDS_FETCH_TIMEOUT_MS,
} from "@/lib/game-rounds/client";
import { submitAuth } from "@/lib/auth/submit.client";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { CONTINENT_META } from "@/lib/map/continent-theme";
import {
  EDUCATION_LEVEL_LABELS,
  GRADE_LEVEL_LABELS,
  STUDY_STREAM_LABELS,
} from "@/lib/auth/profile-labels";
import { V2GameHistoryStats } from "@/components/v2/v2-game-history-stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User,
  GraduationCap,
  Heart,
  PlayCircle,
  Trophy,
  Ruler,
  LogOut,
  ChevronRight,
  ExternalLink,
  Trash2,
  MapPin,
  Globe,
  Compass,
  Layers,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  BookOpen,
} from "lucide-react";

export interface MemberHubProvince {
  readonly plateCode: string;
  readonly nameTr: string;
  readonly slugTr: string;
}

export interface MemberHubCountry {
  readonly isoCode: string;
  readonly nameTr: string;
  readonly slugTr: string;
}

export interface MemberHubRegion {
  readonly slug: string;
  readonly nameTr: string;
}

export interface MemberHubBook {
  readonly titleTr: string;
  readonly slugTr: string;
}

export interface V2MemberHubProps {
  readonly session: Session;
  readonly profile: Profile | null;
  readonly provinces: readonly MemberHubProvince[];
  readonly countries: readonly MemberHubCountry[];
  readonly regions: readonly MemberHubRegion[];
  readonly books: readonly MemberHubBook[];
}

type TabKey = "favorites" | "videos" | "games" | "measurements" | "profile";
type AppNavigationHref = React.ComponentProps<typeof Link>["href"];

export function V2MemberHub({
  session,
  profile,
  provinces,
  countries,
  regions,
  books,
}: V2MemberHubProps) {
  const router = useRouter();
  const [, setAuthState] = useAuthSession();
  const [activeTab, setActiveTab] = React.useState<TabKey>("favorites");
  const [signingOut, setSigningOut] = React.useState(false);

  // Status announcement for screen readers
  const [announcement, setAnnouncement] = React.useState<string>("");

  // Favorites state
  const [favorites, setFavorites] = React.useState<readonly FavoriteRecord[] | null>(null);
  const [favoritesStatus, setFavoritesStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [favoriteFilter, setFavoriteFilter] = React.useState<FavoriteEntityType | "all">("all");

  // Measurements state
  const [measurements, setMeasurements] = React.useState<readonly MeasurementRecord[] | null>(null);
  const [measurementsStatus, setMeasurementsStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );

  // Game rounds state
  const [gameRounds, setGameRounds] = React.useState<readonly GameRoundRecord[] | null>(null);
  const [gameRoundsStatus, setGameRoundsStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );

  // Video progress state (keyed by book slugTr)
  const [bookProgressMap, setBookProgressMap] = React.useState<
    Record<string, BookProgressValue | null>
  >({});
  const [videosStatus, setVideosStatus] = React.useState<"loading" | "ready">("loading");

  // Initial data loading on mount
  React.useEffect(() => {
    let cancelled = false;

    // 1. Fetch Favorites
    const favController = new AbortController();
    const favTimeout = setTimeout(() => favController.abort(), FAVORITES_FETCH_TIMEOUT_MS);
    fetchFavorites(favController.signal)
      .then((data) => {
        if (cancelled) return;
        setFavorites(data);
        setFavoritesStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setFavorites(null);
        setFavoritesStatus("error");
      })
      .finally(() => clearTimeout(favTimeout));

    // 2. Fetch Measurements
    const measController = new AbortController();
    const measTimeout = setTimeout(() => measController.abort(), MEASUREMENTS_FETCH_TIMEOUT_MS);
    fetchMeasurements(measController.signal)
      .then((data) => {
        if (cancelled) return;
        setMeasurements(data);
        setMeasurementsStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setMeasurements(null);
        setMeasurementsStatus("error");
      })
      .finally(() => clearTimeout(measTimeout));

    // 3. Fetch Game Rounds (page size at the transport's max, so the stat box reflects the
    // caller's real round count rather than an arbitrary small page)
    const roundsController = new AbortController();
    const roundsTimeout = setTimeout(() => roundsController.abort(), GAME_ROUNDS_FETCH_TIMEOUT_MS);
    fetchGameRounds(1, 100, roundsController.signal)
      .then((data) => {
        if (cancelled) return;
        setGameRounds(data);
        setGameRoundsStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setGameRounds(null);
        setGameRoundsStatus("error");
      })
      .finally(() => clearTimeout(roundsTimeout));

    // 4. Fetch Video Progress for all provided books
    const videoController = new AbortController();
    const videoTimeout = setTimeout(() => videoController.abort(), VIDEO_PROGRESS_FETCH_TIMEOUT_MS);
    const progressPromises = books.map((book) =>
      fetchBookProgress(book.slugTr, videoController.signal).then((val) => ({
        slug: book.slugTr,
        val,
      })),
    );

    Promise.all(progressPromises)
      .then((results) => {
        if (cancelled) return;
        const nextMap: Record<string, BookProgressValue | null> = {};
        for (const item of results) {
          nextMap[item.slug] = item.val;
        }
        setBookProgressMap(nextMap);
        setVideosStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setVideosStatus("ready");
      })
      .finally(() => clearTimeout(videoTimeout));

    return () => {
      cancelled = true;
      favController.abort();
      measController.abort();
      roundsController.abort();
      videoController.abort();
      clearTimeout(favTimeout);
      clearTimeout(measTimeout);
      clearTimeout(roundsTimeout);
      clearTimeout(videoTimeout);
    };
  }, [books]);

  // Sign out handler
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await submitAuth("logout", {});
      setAuthState("anonymous");
      router.push("/v2");
    } finally {
      setSigningOut(false);
    }
  };

  // Remove favorite handler
  const handleRemoveFavorite = async (item: FavoriteRecord) => {
    const prev = favorites;
    // Optimistic removal
    setFavorites((current) => (current ? current.filter((f) => f !== item) : null));
    const result = await removeFavorite(item);
    if (!result.ok) {
      // Revert if failed
      setFavorites(prev);
      setAnnouncement("Favori kaldırılamadı. Lütfen tekrar deneyin.");
    } else {
      setAnnouncement("Favori başarıyla kaldırıldı.");
    }
  };

  // Remove measurement handler
  const handleRemoveMeasurement = async (id: string) => {
    const prev = measurements;
    // Optimistic removal
    setMeasurements((current) => (current ? current.filter((m) => m.id !== id) : null));
    const result = await removeMeasurement(id);
    if (!result.ok) {
      // Revert if failed
      setMeasurements(prev);
      setAnnouncement("Ölçüm silinemedi. Lütfen tekrar deneyin.");
    } else {
      setAnnouncement("Kayıtlı ölçüm başarıyla silindi.");
    }
  };

  // Resolve entity details for polymorphic favorites
  const resolveFavoriteMeta = (item: FavoriteRecord) => {
    switch (item.entityType) {
      case "province": {
        const found = provinces.find((p) => p.plateCode === item.entityId);
        return {
          title: found ? found.nameTr : `İl (Plaka ${item.entityId})`,
          subtitle: `Türkiye İli · Plaka ${item.entityId}`,
          href: found ? `/v2/turkiye/${found.slugTr}` : `/v2/turkiye`,
          badge: "İl",
          icon: <MapPin className="size-4 text-primary" />,
        };
      }
      case "country": {
        const found = countries.find(
          (c) => c.isoCode.toUpperCase() === item.entityId.toUpperCase(),
        );
        return {
          title: found ? found.nameTr : `Ülke (${item.entityId})`,
          subtitle: `Dünya Ülkesi · ISO ${item.entityId}`,
          href: found ? `/v2/dunya/${found.slugTr}` : `/v2/dunya`,
          badge: "Ülke",
          icon: <Globe className="size-4 text-sky-500" />,
        };
      }
      case "region": {
        const found = regions.find((r) => r.slug === item.entityId);
        return {
          title: found ? found.nameTr : `Bölge (${item.entityId})`,
          subtitle: "Türkiye Coğrafi Bölgesi",
          href: `/v2/turkiye/bolge/${item.entityId}`,
          badge: "Bölge",
          icon: <Compass className="size-4 text-emerald-500" />,
        };
      }
      case "continent": {
        const meta = CONTINENT_META[item.entityId];
        return {
          title: meta ? meta.name : item.entityId,
          subtitle: "Kıta Rehberi",
          href: `/v2/dunya`,
          badge: "Kıta",
          icon: <Layers className="size-4 text-amber-500" />,
        };
      }
    }
  };

  const filteredFavorites = (favorites || []).filter((item) => {
    if (favoriteFilter === "all") return true;
    return item.entityType === favoriteFilter;
  });

  const totalFavoritesCount = favorites ? favorites.length : 0;
  const totalMeasurementsCount = measurements ? measurements.length : 0;
  const totalGameRoundsCount = gameRounds ? gameRounds.length : 0;
  const totalWatchedVideos = Object.values(bookProgressMap).reduce(
    (acc, cur) => acc + (cur?.watchedCount ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      {/* Live status announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Hero / Identity Banner */}
      <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 size-60 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="size-16 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary/20 shrink-0">
              {session.firstName.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Merhaba, {session.firstName}!
                </h1>
                <Badge
                  variant={session.accountRole === "TEACHER" ? "secondary" : "primary"}
                  size="sm"
                  className="gap-1"
                >
                  {session.accountRole === "TEACHER" ? (
                    <>
                      <GraduationCap className="size-3.5" />
                      Öğretmen
                    </>
                  ) : (
                    <>
                      <User className="size-3.5" />
                      Öğrenci
                    </>
                  )}
                </Badge>

                {session.accountRole === "STUDENT" && (
                  <>
                    {profile?.isComplete ? (
                      <Badge variant="success" size="sm" dot>
                        Profil Tamamlandı
                      </Badge>
                    ) : (
                      <Link href="/v2/profil">
                        <Badge
                          variant="warning"
                          size="sm"
                          className="hover:opacity-80 transition-opacity cursor-pointer"
                        >
                          <AlertCircle className="size-3 mr-1" />
                          Profili Tamamla (%50)
                        </Badge>
                      </Link>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                Coğrafya Gurmesi kişisel üyelik merkezin. Favori lokasyonlarını yönetebilir, soru
                çözümlerinde kaldığın yerden devam edebilir, sınav geçmişini ve ölçümlerini
                inceleyebilirsin.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/v2/profil"
              className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl h-10 px-4 py-2 text-xs border border-border bg-card hover:bg-muted text-foreground shadow-xs cursor-pointer"
            >
              Profili Düzenle
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
              className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30 rounded-xl h-10"
              aria-label="Güvenli Çıkış Yap"
            >
              {signingOut ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Çıkış Yapılıyor…
                </>
              ) : (
                <>
                  <LogOut className="size-3.5" />
                  Güvenli Çıkış
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/80">
          <div className="p-3 rounded-2xl bg-background/60 border border-border/60">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
              <Heart className="size-3.5 text-rose-500" />
              Favorilerim
            </div>
            <div className="font-heading font-bold text-xl text-foreground mt-0.5">
              {favoritesStatus === "loading" ? "…" : totalFavoritesCount}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-background/60 border border-border/60">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
              <PlayCircle className="size-3.5 text-primary" />
              İzlenen Video
            </div>
            <div className="font-heading font-bold text-xl text-foreground mt-0.5">
              {videosStatus === "loading" ? "…" : totalWatchedVideos}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-background/60 border border-border/60">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
              <Trophy className="size-3.5 text-amber-500" />
              Sınav Turları
            </div>
            <div className="font-heading font-bold text-xl text-foreground mt-0.5">
              {gameRoundsStatus === "loading" ? "…" : totalGameRoundsCount}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-background/60 border border-border/60">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
              <Ruler className="size-3.5 text-indigo-500" />
              Kayıtlı Ölçüm
            </div>
            <div className="font-heading font-bold text-xl text-foreground mt-0.5">
              {measurementsStatus === "loading" ? "…" : totalMeasurementsCount}
            </div>
          </div>
        </div>
      </div>

      {/* Accessible Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Üyelik Panelleri"
        className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-border"
      >
        <button
          role="tab"
          type="button"
          id="tab-favorites"
          aria-selected={activeTab === "favorites"}
          aria-controls="panel-favorites"
          onClick={() => setActiveTab("favorites")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer ${
            activeTab === "favorites"
              ? "bg-primary text-white shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Heart className="size-3.5" />
          <span>Favorilerim</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "favorites"
                ? "bg-white/20 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {favorites ? favorites.length : 0}
          </span>
        </button>

        <button
          role="tab"
          type="button"
          id="tab-videos"
          aria-selected={activeTab === "videos"}
          aria-controls="panel-videos"
          onClick={() => setActiveTab("videos")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer ${
            activeTab === "videos"
              ? "bg-primary text-white shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <PlayCircle className="size-3.5" />
          <span>Video İlerlemem</span>
        </button>

        <button
          role="tab"
          type="button"
          id="tab-games"
          aria-selected={activeTab === "games"}
          aria-controls="panel-games"
          onClick={() => setActiveTab("games")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer ${
            activeTab === "games"
              ? "bg-primary text-white shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Trophy className="size-3.5" />
          <span>Sınav &amp; Skor Geçmişim</span>
        </button>

        <button
          role="tab"
          type="button"
          id="tab-measurements"
          aria-selected={activeTab === "measurements"}
          aria-controls="panel-measurements"
          onClick={() => setActiveTab("measurements")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer ${
            activeTab === "measurements"
              ? "bg-primary text-white shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Ruler className="size-3.5" />
          <span>Kayıtlı Ölçümlerim</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "measurements"
                ? "bg-white/20 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {measurements ? measurements.length : 0}
          </span>
        </button>

        <button
          role="tab"
          type="button"
          id="tab-profile"
          aria-selected={activeTab === "profile"}
          aria-controls="panel-profile"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer ${
            activeTab === "profile"
              ? "bg-primary text-white shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <User className="size-3.5" />
          <span>Hesap &amp; Profil</span>
        </button>
      </div>

      {/* Tab 1: Favorilerim Panel */}
      <div
        role="tabpanel"
        id="panel-favorites"
        aria-labelledby="tab-favorites"
        hidden={activeTab !== "favorites"}
        className="space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-foreground">
              Kayıtlı Coğrafi Favorilerim
            </h2>
            <p className="text-xs text-muted-foreground">
              İl, ülke, bölge ve kıtaları favorilerine ekleyerek hızlı erişim listeni oluştur.
            </p>
          </div>

          {/* Sub-filters for 4 types */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setFavoriteFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                favoriteFilter === "all"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tümü ({favorites?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setFavoriteFilter("province")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                favoriteFilter === "province"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              İller
            </button>
            <button
              type="button"
              onClick={() => setFavoriteFilter("country")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                favoriteFilter === "country"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ülkeler
            </button>
            <button
              type="button"
              onClick={() => setFavoriteFilter("region")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                favoriteFilter === "region"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bölgeler
            </button>
            <button
              type="button"
              onClick={() => setFavoriteFilter("continent")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                favoriteFilter === "continent"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Kıtalar
            </button>
          </div>
        </div>

        {favoritesStatus === "loading" ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span>Favorileriniz yükleniyor...</span>
          </div>
        ) : filteredFavorites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFavorites.map((item) => {
              const meta = resolveFavoriteMeta(item);
              return (
                <div
                  key={`${item.entityType}-${item.entityId}`}
                  className="rounded-2xl border border-border bg-card p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-muted/60 border border-border">
                        {meta.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-heading font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                            {meta.title}
                          </span>
                          <Badge variant="outline" size="sm" className="text-[10px]">
                            {meta.badge}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          {meta.subtitle}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFavorite(item)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      aria-label={`${meta.title} favorilerden kaldır`}
                      title="Favorilerden kaldır"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <Link
                      href={meta.href as unknown as AppNavigationHref}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Sayfayı Ziyaret Et
                      <ArrowRight className="size-3" />
                    </Link>
                    <span className="text-[10px] text-muted-foreground">Sabitlendi</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center space-y-4 max-w-xl mx-auto bg-muted/20">
            <div className="size-12 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto text-muted-foreground">
              <Heart className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-base text-foreground">
                Henüz kayıtlı favorin bulunmuyor
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Türkiye ve Dünya atlas sayfalarındaki &quot;Favoriye Ekle&quot; butonuna basarak
                dilediğin il, ülke, bölge veya kıtayı bu alana sabitleyebilirsin.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Link
                href="/v2/turkiye"
                className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl h-9 px-3.5 py-1.5 text-xs bg-primary text-white hover:bg-primary shadow-xs"
              >
                Türkiye Haritası
              </Link>
              <Link
                href="/v2/dunya"
                className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl h-9 px-3.5 py-1.5 text-xs border border-border bg-card hover:bg-muted text-foreground shadow-xs"
              >
                Dünya Atlası
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Tab 2: Video İlerlemem Panel */}
      <div
        role="tabpanel"
        id="panel-videos"
        aria-labelledby="tab-videos"
        hidden={activeTab !== "videos"}
        className="space-y-6"
      >
        <div>
          <h2 className="font-heading text-lg sm:text-xl font-bold text-foreground">
            Kitap Video Çözüm İlerleme Durumu
          </h2>
          <p className="text-xs text-muted-foreground">
            İzlediğin coğrafya soru çözüm videoları, izleme süren ve kaldığın yer otomatik olarak
            hesabına kaydedilir.
          </p>
        </div>

        {videosStatus === "loading" ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span>Video ilerlemeniz kontrol ediliyor...</span>
          </div>
        ) : books.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {books.map((book) => {
              const progress = bookProgressMap[book.slugTr];
              const total = progress?.videoCount ?? 0;
              const watched = progress?.watchedCount ?? 0;
              const started = progress?.startedCount ?? 0;
              const percentage = total > 0 ? Math.round((watched / total) * 100) : 0;
              const resume = progress?.resume;

              return (
                <div
                  key={book.slugTr}
                  className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                          <BookOpen className="size-5" />
                        </div>
                        <div>
                          <h3 className="font-heading font-bold text-base text-foreground">
                            {book.titleTr}
                          </h3>
                          <span className="text-[11px] text-muted-foreground block">
                            Müfredat Uyumlu Video Soru Bankası
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" size="sm">
                        %{percentage}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500 rounded-full"
                          style={{ width: `${Math.max(percentage, 2)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {watched} / {total > 0 ? total : "—"} Video Çözümü Tamamlandı
                        </span>
                        {started > watched && <span>{started - watched} videoda devam ediyor</span>}
                      </div>
                    </div>
                  </div>

                  {/* Resume Box or Empty Prompt */}
                  <div className="pt-4 border-t border-border">
                    {resume ? (
                      <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-primary" />
                            Kaldığın Yer: Soru #{resume.orderNo}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {Math.floor(resume.lastPositionSeconds / 60)}:
                            {(resume.lastPositionSeconds % 60).toString().padStart(2, "0")}
                          </span>
                        </div>
                        <Link
                          href={
                            `/v2/kitaplar/${book.slugTr}?v=${resume.bookVideoId}` as unknown as AppNavigationHref
                          }
                          className="w-full inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl h-9 px-3.5 py-1.5 text-xs bg-primary text-white hover:bg-primary shadow-xs gap-1.5 cursor-pointer"
                        >
                          <PlayCircle className="size-3.5" />
                          Kaldığın Yerden Devam Et
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Henüz bu kitaptan bir soru izlemedin.
                        </span>
                        <Link
                          href={`/v2/kitaplar/${book.slugTr}` as unknown as AppNavigationHref}
                          className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl h-8 px-3 text-xs border border-border bg-card hover:bg-muted text-foreground shadow-xs gap-1 cursor-pointer"
                        >
                          Kitabı Aç
                          <ExternalLink className="size-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center space-y-4 max-w-xl mx-auto bg-muted/20">
            <div className="size-12 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto text-muted-foreground">
              <PlayCircle className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-base text-foreground">
                Kayıtlı video ilerlemeniz bulunmuyor
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Coğrafya kitaplarımızın soru çözüm videolarını izlemeye başladığında kaldığın saniye
                ve tamamlanma oranı burada listelenir.
              </p>
            </div>
            <Link
              href="/v2/kitaplar"
              className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl h-9 px-3.5 py-1.5 text-xs bg-primary text-white hover:bg-primary shadow-xs"
            >
              Kitap Video Çözümlerini İncele
            </Link>
          </div>
        )}
      </div>

      {/* Tab 3: Sınav & Skor Geçmişim Panel */}
      <div
        role="tabpanel"
        id="panel-games"
        aria-labelledby="tab-games"
        hidden={activeTab !== "games"}
        className="space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-foreground">
              Harita Oyunları &amp; Başarı İstatistikleri
            </h2>
            <p className="text-xs text-muted-foreground">
              Türkiye 81 il, 7 bölge ve dünya harita sınavlarında tamamladığın tüm turlar ve
              unvanlar.
            </p>
          </div>

          <Link
            href="/v2/oyun"
            className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl h-9 px-3.5 py-1.5 text-xs bg-primary text-white hover:bg-primary shadow-xs gap-1.5 cursor-pointer"
          >
            <Trophy className="size-3.5" />
            Yeni Harita Sınavı Başlat
          </Link>
        </div>

        {/* Reuses rich stats component with badge unlocking and history table */}
        <V2GameHistoryStats />
      </div>

      {/* Tab 4: Kayıtlı Ölçümlerim Panel */}
      <div
        role="tabpanel"
        id="panel-measurements"
        aria-labelledby="tab-measurements"
        hidden={activeTab !== "measurements"}
        className="space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-foreground">
              Harita Araçları Bulut Arşivi
            </h2>
            <p className="text-xs text-muted-foreground">
              Harita araçları laboratuvarında çizdiğin mesafe, alan ve koordinat ölçümleri.
            </p>
          </div>

          <Link
            href="/v2/araclar"
            className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl h-9 px-3.5 py-1.5 text-xs bg-primary text-white hover:bg-primary shadow-xs gap-1.5 cursor-pointer"
          >
            <Ruler className="size-3.5" />
            Harita Araçlarını Aç
          </Link>
        </div>

        {measurementsStatus === "loading" ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span>Kayıtlı ölçümleriniz yükleniyor...</span>
          </div>
        ) : measurements && measurements.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {measurements.map((meas) => {
              const typeLabel =
                meas.type === "distance"
                  ? "Mesafe Ölçümü"
                  : meas.type === "area"
                    ? "Alan Ölçümü"
                    : "Koordinat Noktası";

              const typeIcon =
                meas.type === "distance" ? (
                  <Ruler className="size-4 text-primary" />
                ) : meas.type === "area" ? (
                  <Layers className="size-4 text-emerald-500" />
                ) : (
                  <MapPin className="size-4 text-sky-500" />
                );

              return (
                <div
                  key={meas.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-muted/60 border border-border">
                        {typeIcon}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-heading font-bold text-sm text-foreground">
                            {meas.title || "İsimsiz Ölçüm"}
                          </span>
                          <Badge variant="outline" size="sm" className="text-[10px]">
                            {typeLabel}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          {meas.points.length} Coğrafi Nokta
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMeasurement(meas.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      aria-label="Ölçümü sil"
                      title="Ölçümü sil"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(meas.createdAt).toLocaleDateString("tr-TR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <Link
                      href="/v2/araclar"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Haritada Aç
                      <ChevronRight className="size-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center space-y-4 max-w-xl mx-auto bg-muted/20">
            <div className="size-12 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto text-muted-foreground">
              <Ruler className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-base text-foreground">
                Kayıtlı ölçümünüz bulunmuyor
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Harita araçlarında iki nokta arası mesafe hesaplayabilir, göl veya bölge alanı
                ölçebilir ve &quot;Bulut Arşivine Kaydet&quot; seçeneğiyle profilinize
                sabitleyebilirsiniz.
              </p>
            </div>
            <Link
              href="/v2/araclar"
              className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl h-9 px-3.5 py-1.5 text-xs bg-primary text-white hover:bg-primary shadow-xs"
            >
              Harita Araçlarını Başlat
            </Link>
          </div>
        )}
      </div>

      {/* Tab 5: Profil & Hesap Özeti Panel */}
      <div
        role="tabpanel"
        id="panel-profile"
        aria-labelledby="tab-profile"
        hidden={activeTab !== "profile"}
        className="space-y-6"
      >
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6 max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                <User className="size-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground">
                  Hesap ve Eğitim Bilgileri
                </h3>
                <span className="text-xs text-muted-foreground">
                  Kişisel üyelik detayların ve profil durumun
                </span>
              </div>
            </div>

            {session.accountRole === "TEACHER" ? (
              <Badge variant="success" size="default">
                Öğretmen Hesabı
              </Badge>
            ) : profile?.isComplete ? (
              <Badge variant="success" size="default" dot>
                Profil Tamam
              </Badge>
            ) : (
              <Badge variant="warning" size="default">
                Eksik Alanlar Var
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
              <span className="text-muted-foreground font-medium block">Ad</span>
              <span className="font-semibold text-foreground text-sm block">
                {session.firstName}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
              <span className="text-muted-foreground font-medium block">Hesap Rolü</span>
              <span className="font-semibold text-foreground text-sm block">
                {session.accountRole === "TEACHER"
                  ? "Öğretmen"
                  : session.accountRole === "PARENT"
                    ? "Veli"
                    : "Öğrenci"}
              </span>
            </div>

            {session.accountRole === "STUDENT" && (
              <>
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
                  <span className="text-muted-foreground font-medium block">Eğitim Seviyesi</span>
                  <span className="font-semibold text-foreground text-sm block">
                    {profile?.educationLevel
                      ? EDUCATION_LEVEL_LABELS[profile.educationLevel]?.tr
                      : "Belirtilmedi"}
                  </span>
                </div>

                {profile?.educationLevel === "SECONDARY" && (
                  <>
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
                      <span className="text-muted-foreground font-medium block">Sınıf</span>
                      <span className="font-semibold text-foreground text-sm block">
                        {profile?.gradeLevel
                          ? GRADE_LEVEL_LABELS[profile.gradeLevel]?.tr
                          : "Belirtilmedi"}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
                      <span className="text-muted-foreground font-medium block">Alan</span>
                      <span className="font-semibold text-foreground text-sm block">
                        {profile?.studyStream
                          ? STUDY_STREAM_LABELS[profile.studyStream]?.tr
                          : "Belirtilmedi"}
                      </span>
                    </div>
                  </>
                )}

                {(profile?.educationLevel === "UNDERGRADUATE" ||
                  profile?.educationLevel === "GRADUATE") && (
                  <>
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
                      <span className="text-muted-foreground font-medium block">Üniversite</span>
                      <span className="font-semibold text-foreground text-sm block">
                        {profile?.universityName || "Belirtilmedi"}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
                      <span className="text-muted-foreground font-medium block">Bölüm</span>
                      <span className="font-semibold text-foreground text-sm block">
                        {profile?.departmentName || "Belirtilmedi"}
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
            <Link
              href="/v2/profil"
              className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl h-10 px-4 py-2 text-xs bg-primary text-white hover:bg-primary shadow-xs gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="size-3.5" />
              Profil Formuna Git
            </Link>

            <Link
              href="/sifre-sifirlama"
              className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl h-10 px-4 py-2 text-xs border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground shadow-xs cursor-pointer"
            >
              Şifre Değiştir
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
