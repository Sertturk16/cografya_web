"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  fetchLeaderboard,
  formatLeaderboardDisplayName,
  type LeaderboardListRecord,
} from "@/lib/game-rounds/client";
import { getGameRoundModeTitle } from "@/lib/game/round-mode-tag";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { requestAuth } from "@/lib/auth/auth-modal.client";
import { Trophy, ChevronLeft, ChevronRight, Lock, Sparkles } from "lucide-react";
import { formatDay } from "@/lib/text/format-date";

interface V2LeaderboardModalProps {
  readonly mode: string;
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function V2LeaderboardModal({ mode, isOpen, onOpenChange }: V2LeaderboardModalProps) {
  const [authState] = useAuthSession();
  const [data, setData] = React.useState<LeaderboardListRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [loadedKey, setLoadedKey] = React.useState<{ mode: string; page: number } | null>(null);

  const modeTitle = getGameRoundModeTitle(mode);
  const isUnauthenticated = authState !== "authenticated";
  const displayError = isUnauthenticated ? "unauthenticated" : error;
  const displayData = isUnauthenticated ? null : data;
  const loading =
    isOpen &&
    !isUnauthenticated &&
    (!loadedKey || loadedKey.mode !== mode || loadedKey.page !== page);

  React.useEffect(() => {
    if (!isOpen || authState !== "authenticated") return;

    let active = true;
    const controller = new AbortController();
    fetchLeaderboard(mode, page, 15, controller.signal)
      .then((res) => {
        if (!active) return;
        if (res) {
          setData(res);
          setError(null);
        } else {
          setError("failed");
        }
        setLoadedKey({ mode, page });
      })
      .catch(() => {
        if (!active) return;
        setError("failed");
        setLoadedKey({ mode, page });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isOpen, mode, page, authState]);

  const handleSignIn = () => {
    onOpenChange(false);
    requestAuth("gameRound");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="default" size="sm" className="gap-1.5">
              <Trophy className="size-3.5" />
              Lider Tablosu
            </Badge>
            {displayData?.meta?.currentUserRank && (
              <Badge
                variant="secondary"
                size="sm"
                className="bg-primary/10 text-primary border-primary/20"
              >
                Senin Sıran: #{displayData.meta.currentUserRank}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-2xl">{modeTitle}</DialogTitle>
          <DialogDescription>
            Tüm coğrafya meraklıları arasında bu modda elde edilen en yüksek skorlar ve rekor
            süreler.
          </DialogDescription>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto min-h-[320px] -mx-6 px-6 py-2">
          {displayError === "unauthenticated" ? (
            <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center p-8 space-y-4 rounded-2xl bg-muted/20 border border-dashed border-border">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <Lock className="size-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="font-heading font-bold text-lg text-foreground">
                  Giriş Yapman Gerekiyor
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Liderlik tablosunda yer alan oyuncuları incelemek ve kazandığın skorla listeye
                  adını yazdırmak için hesabına giriş yap.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={handleSignIn} className="gap-2">
                <Sparkles className="size-4" />
                Giriş Yap veya Kayıt Ol
              </Button>
            </div>
          ) : loading ? (
            <div
              role="status"
              className="h-full min-h-[280px] flex flex-col items-center justify-center gap-3 text-muted-foreground"
            >
              <Spinner size="lg" decorative className="text-primary" />
              <span className="text-sm font-medium">Liderlik tablosu yükleniyor...</span>
            </div>
          ) : displayError === "failed" ? (
            <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-2">
              <p className="text-sm font-medium text-foreground">Sıralama verisi alınamadı</p>
              <p className="text-xs">Bağlantı sırasında bir sorun oluştu. Lütfen tekrar deneyin.</p>
              <Button variant="outline" size="sm" onClick={() => setPage(1)}>
                Tekrar Dene
              </Button>
            </div>
          ) : !displayData || displayData.items.length === 0 ? (
            <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-muted/20 border border-dashed border-border space-y-3">
              <div className="p-3 rounded-full bg-muted text-muted-foreground">
                <Trophy className="size-8 opacity-40" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="font-heading font-semibold text-foreground">
                  Henüz Kayıtlı Skor Yok
                </h4>
                <p className="text-xs text-muted-foreground">
                  Bu modda henüz tamamlanmış ve kaydedilmiş bir sınav skoru bulunmuyor. İlk skoru
                  kaydeden sen ol!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3 w-16 text-center">Sıra</th>
                      <th className="py-2.5 px-3">Oyuncu</th>
                      <th className="py-2.5 px-3 text-right">Skor</th>
                      <th className="py-2.5 px-3 text-right hidden sm:table-cell">İsabet</th>
                      <th className="py-2.5 px-3 text-right hidden sm:table-cell">Süre</th>
                      <th className="py-2.5 px-3 text-right hidden md:table-cell">Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayData.items.map((entry) => {
                      const displayName = formatLeaderboardDisplayName(
                        entry.firstName,
                        entry.lastNameInitial,
                      );
                      return (
                        <tr
                          key={`${entry.rank}-${entry.firstName}-${entry.achievedAt}`}
                          className={`transition-colors ${
                            entry.isCurrentUser
                              ? "bg-primary/10 hover:bg-primary/15 font-medium"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          {/* Rank */}
                          <td className="py-2.5 px-3 text-center">
                            {entry.rank <= 3 ? (
                              <span className="inline-flex items-center justify-center size-6 rounded-full font-bold font-mono">
                                {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                              </span>
                            ) : (
                              <span className="font-mono text-muted-foreground font-medium">
                                #{entry.rank}
                              </span>
                            )}
                          </td>

                          {/* Player Name */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{displayName}</span>
                              {entry.isCurrentUser && (
                                <Badge
                                  variant="primary"
                                  size="sm"
                                  className="text-[10px] px-1.5 py-0 h-4"
                                >
                                  Sen
                                </Badge>
                              )}
                            </div>
                          </td>

                          {/* Score */}
                          <td className="py-2.5 px-3 text-right">
                            <span className="font-heading font-bold text-sm text-primary">
                              %{entry.score}
                            </span>
                          </td>

                          {/* Accuracy */}
                          <td className="py-2.5 px-3 text-right text-muted-foreground hidden sm:table-cell">
                            <span>
                              {entry.found} / {entry.found + entry.totalWrongs}
                            </span>
                          </td>

                          {/* Time */}
                          <td className="py-2.5 px-3 text-right text-muted-foreground hidden sm:table-cell">
                            {entry.completionTimeSeconds
                              ? `${entry.completionTimeSeconds} sn`
                              : "—"}
                          </td>

                          {/* Date */}
                          <td className="py-2.5 px-3 text-right text-muted-foreground hidden md:table-cell">
                            {formatDay(entry.achievedAt, "tr", "dayMonth")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls.
                  Hand-rolled on purpose (T-036). `components/ui/pagination.tsx` was built
                  around real `<a href>` anchors, "so middle-click and open-in-new-tab work" —
                  the right call for a paginated URL, and the wrong shape here: this list pages
                  CLIENT STATE inside a modal and has no URL of its own to link to. The two
                  things the primitive would have brought that this was missing are added
                  directly instead: a named landmark, and an announcement when the page
                  changes. `aria-live="polite"` sits on the page counter because that text IS
                  the change; a screen-reader user pressing "Sonraki Sayfa" otherwise heard
                  nothing at all. */}
              {(displayData.page > 1 || displayData.hasMore) && (
                <nav
                  aria-label="Sayfalama"
                  className="flex items-center justify-between pt-2 text-xs text-muted-foreground"
                >
                  <span aria-live="polite">
                    Sayfa {displayData.page} ({displayData.total} kayıt)
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={displayData.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Önceki Sayfa"
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={!displayData.hasMore}
                      onClick={() => setPage((p) => p + 1)}
                      aria-label="Sonraki Sayfa"
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </nav>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function V2LeaderboardButton({
  mode,
  className = "",
  variant = "outline",
  size = "sm",
}: {
  readonly mode: string;
  readonly className?: string;
  readonly variant?: "default" | "outline" | "secondary" | "ghost";
  readonly size?: "default" | "sm" | "lg" | "icon";
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={`gap-1.5 text-xs font-semibold ${className}`}
        aria-label="Lider tablosunu görüntüle"
      >
        <Trophy className="size-3.5" />
        <span>Lider Tablosu</span>
      </Button>
      <V2LeaderboardModal mode={mode} isOpen={open} onOpenChange={setOpen} />
    </>
  );
}
