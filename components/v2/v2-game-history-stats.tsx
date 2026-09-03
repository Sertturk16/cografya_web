"use client";

import * as React from "react";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { requestAuth } from "@/lib/auth/auth-modal.client";
import {
  fetchGameRounds,
  type GameRoundRecord,
  GAME_ROUNDS_FETCH_TIMEOUT_MS,
} from "@/lib/game-rounds/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Award, Flame, Zap, ShieldCheck, Lock, Loader2, Calendar } from "lucide-react";

export function V2GameHistoryStats() {
  const [authState] = useAuthSession();
  const [fetchedRecords, setFetchedRecords] = React.useState<readonly GameRoundRecord[] | null>(
    null,
  );
  const [status, setStatus] = React.useState<"pending" | "settled">("pending");

  React.useEffect(() => {
    if (authState !== "authenticated") return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GAME_ROUNDS_FETCH_TIMEOUT_MS);
    let cancelled = false;

    fetchGameRounds(1, 20, controller.signal)
      .then((data) => {
        if (cancelled) return;
        setFetchedRecords(data);
        setStatus("settled");
      })
      .catch(() => {
        if (cancelled) return;
        setFetchedRecords(null);
        setStatus("settled");
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [authState]);

  const records = authState === "authenticated" ? fetchedRecords : null;
  const loading = authState === "authenticated" && status === "pending";

  const totalRounds = records ? records.length : 0;
  const bestScore = records && records.length > 0 ? Math.max(...records.map((r) => r.score)) : 0;

  // Dynamic achievement unlocks based on real round data
  const achievements = [
    {
      id: "first-round",
      title: "İlk Adım",
      desc: "Platformda ilk harita sınavını başarıyla tamamla.",
      icon: <Award className="size-5" />,
      unlocked: totalRounds >= 1,
      color: "bg-primary/10 text-primary border-primary/30",
    },
    {
      id: "pro-explorer",
      title: "Usta Kâşif",
      desc: "Herhangi bir sınav turunda %85 ve üzeri başarı skoru elde et.",
      icon: <Zap className="size-5" />,
      unlocked: bestScore >= 85,
      color: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    },
    {
      id: "map-veteran",
      title: "Harita Gazisi",
      desc: "Toplam 5 veya daha fazla sınav turu bitirerek profilini güçlendir.",
      icon: <ShieldCheck className="size-5" />,
      unlocked: totalRounds >= 5,
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    },
    {
      id: "perfect-streak",
      title: "Kusursuz Seri",
      desc: "Tek bir sınavda %100 tam puan alarak coğrafya şampiyonu ol.",
      icon: <Flame className="size-5" />,
      unlocked: bestScore === 100,
      color: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    },
  ];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-6 sm:p-8 shadow-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" size="sm" icon={<Trophy className="size-3.5" />}>
              Başarılar &amp; Skor Geçmişi
            </Badge>
            <span className="text-xs text-muted-foreground">Kişisel Gelişim ve Rozet Vitrini</span>
          </div>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground mt-1">
            Kazanılan Rozetler ve Unvanlar
          </h3>
        </div>

        {authState === "authenticated" ? (
          <Badge
            variant="outline"
            size="sm"
            className="bg-primary/5 text-primary border-primary/20"
          >
            {unlockedCount} / {achievements.length} Rozet Açık
          </Badge>
        ) : (
          <Badge variant="outline" size="sm" className="bg-muted text-muted-foreground">
            Giriş Yapılmadı
          </Badge>
        )}
      </div>

      {/* Guest Lock Banner */}
      {authState !== "authenticated" && (
        <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground">
              <Lock className="size-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-sm text-foreground">
                Skorlarını ve Rozetlerini Profiline Kaydet
              </h4>
              <p className="text-xs text-muted-foreground">
                Oturum açarak bitirdiğin tüm sınav turlarını geçmişine kaydedebilir ve başarı
                rozetlerini açabilirsin.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => requestAuth("gameRound")}>
            Giriş Yap veya Üye Ol
          </Button>
        </div>
      )}

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {achievements.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-2xl border transition-all duration-300 ${
              item.unlocked
                ? `${item.color} shadow-xs hover:-translate-y-0.5`
                : "border-dashed border-border bg-muted/20 text-muted-foreground opacity-60"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="size-10 rounded-xl bg-background/80 flex items-center justify-center shadow-xs">
                {item.icon}
              </div>
              <Badge
                variant={item.unlocked ? "primary" : "outline"}
                size="sm"
                className="text-[10px]"
              >
                {item.unlocked ? "Kazanıldı" : "Kilitli"}
              </Badge>
            </div>
            <h4 className="font-heading font-bold text-base text-foreground mb-1">{item.title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Recent Games History Table (When Authenticated) */}
      {authState === "authenticated" && (
        <div className="pt-2 space-y-3">
          <h4 className="font-heading font-bold text-base text-foreground flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <span>Son Oynanan Sınav Turları</span>
          </h4>

          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Skor geçmişiniz yükleniyor...</span>
            </div>
          ) : records && records.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {records.slice(0, 6).map((rec) => (
                <div
                  key={rec.clientRoundId}
                  className="p-3.5 rounded-2xl bg-card border border-border space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" size="sm" className="text-[10px]">
                      {rec.mode === "81-il"
                        ? "81 İl"
                        : rec.mode === "bolge-bulma"
                          ? "7 Bölge"
                          : rec.mode}
                    </Badge>
                    <span className="font-heading font-bold text-base text-primary">
                      %{rec.score}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Doğru: {rec.found} / {rec.total}
                    </span>
                    <span>Hata: {rec.totalWrongs}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(rec.createdAt).toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
              Henüz kayıtlı sınav turun bulunmuyor. Bir sınav başlatıp bitirerek ilk skorunu kaydet!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
