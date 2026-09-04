"use client";

import * as React from "react";
import {
  useAuthModalState,
  dismissAuth,
  resolveAuth,
  setAuthModalMode,
  type AuthIntent,
} from "@/lib/auth/auth-modal.client";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { V2LoginCard } from "./v2-login-card";
import { V2RegisterCard } from "./v2-register-card";
import { Badge } from "@/components/ui/badge";
import {
  Compass,
  Star,
  Trophy,
  Video,
  Layers,
  ShieldCheck,
  X,
  LogIn,
  UserPlus,
} from "lucide-react";

interface IntentConfig {
  icon: React.ReactNode;
  badgeText: string;
  title: string;
  desc: string;
}

const INTENT_CONFIGS: Record<AuthIntent, IntentConfig> = {
  favorite: {
    icon: <Star className="size-4 text-amber-500" />,
    badgeText: "Favorilere Ekleme",
    title: "Bu Sayfayı Favorilerine Kaydet",
    desc: "İl ve ülke verilerini hızlı erişim listene eklemek ve güncel telemetrileri takip etmek için giriş yap.",
  },
  video: {
    icon: <Video className="size-4 text-rose-500" />,
    badgeText: "Soru Çözüm Takibi",
    title: "Video İlerlemeni Kaydet",
    desc: "Hangi deneme sorularını çözdüğünü ve izlediğini soru soru takip etmek için giriş yap.",
  },
  gameRound: {
    icon: <Trophy className="size-4 text-emerald-500" />,
    badgeText: "Lider Tablosu & Skor",
    title: "Harita Sınavı Skorunu Kaydet",
    desc: "Kazandığın puanları profiline işlemek ve başarı rozetlerini açmak için hesabına giriş yap.",
  },
  measurement: {
    icon: <Layers className="size-4 text-primary" />,
    badgeText: "CBS Ölçüm Arşivi",
    title: "CBS Harita Ölçümünü Kaydet",
    desc: "Haversine mesafe ve küresel alan ölçümlerini bulut arşivine kaydetmek için giriş yap.",
  },
  generic: {
    icon: <Compass className="size-4 text-primary" />,
    badgeText: "Coğrafya Gurmesi",
    title: "Coğrafya Hesabına Eriş",
    desc: "Tüm harita testleri, video çözümleri ve CBS araçlarına sınırsız erişim sağla.",
  },
};

export function V2AuthDialog() {
  const modal = useAuthModalState();
  const [, setAuthState] = useAuthSession();
  const [provinces, setProvinces] = React.useState<Array<{ plateCode: string; nameTr: string }>>(
    [],
  );

  // Fetch province list lazily when modal opens in register mode
  React.useEffect(() => {
    if (modal.open && modal.mode === "register" && provinces.length === 0) {
      fetch("/api/reference/provinces")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setProvinces(data);
          }
        })
        .catch(() => {});
    }
  }, [modal.open, modal.mode, provinces.length]);

  const handleAuthenticated = () => {
    setAuthState("authenticated");
    resolveAuth();
  };

  const intentInfo = INTENT_CONFIGS[modal.intent] || INTENT_CONFIGS.generic;

  return (
    <Dialog
      open={modal.open}
      onOpenChange={(open) => {
        if (!open) dismissAuth();
      }}
    >
      <DialogContent
        size="md"
        showCloseButton={false}
        className="p-0 overflow-hidden sm:max-w-[480px] max-h-[min(90vh,680px)] flex flex-col rounded-3xl border border-border/80 shadow-2xl bg-card"
      >
        {/* Custom Header Bar with Clean Terra Styling & Close Button (shrink-0) */}
        <div className="relative p-5 sm:p-6 bg-card border-b border-border/80 space-y-3.5 shrink-0">
          <button
            type="button"
            onClick={dismissAuth}
            className="absolute right-4 top-4 size-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>

          {/* Brand & Intent Badge */}
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm text-[var(--color-primary-dark,#7e3a1e)]">
              Coğrafya<span className="text-primary font-normal">.v2</span>
            </span>
            <span className="text-muted-foreground">&bull;</span>
            <Badge
              variant="secondary"
              size="sm"
              icon={intentInfo.icon}
              className="text-[11px] py-0"
            >
              {intentInfo.badgeText}
            </Badge>
          </div>

          {/* Heading and Intent Message */}
          <div className="space-y-1">
            <DialogTitle className="font-heading text-lg sm:text-xl font-bold text-foreground">
              {intentInfo.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {intentInfo.desc}
            </DialogDescription>
          </div>

          {/* Segmented Tab Switcher (Giriş Yap <-> Üye Ol) */}
          <div
            className="grid grid-cols-2 p-1 rounded-xl bg-muted/70 border border-border text-xs font-semibold gap-1"
            role="tablist"
            aria-label="Kimlik Doğrulama Seçenekleri"
          >
            <button
              id="v2-auth-tab-login"
              type="button"
              role="tab"
              aria-selected={modal.mode === "login"}
              aria-controls="v2-auth-tabpanel-login"
              onClick={() => setAuthModalMode("login")}
              className={`py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                modal.mode === "login"
                  ? "bg-card text-primary font-bold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LogIn className="size-3.5" />
              <span>Giriş Yap</span>
            </button>
            <button
              id="v2-auth-tab-register"
              type="button"
              role="tab"
              aria-selected={modal.mode === "register"}
              aria-controls="v2-auth-tabpanel-register"
              onClick={() => setAuthModalMode("register")}
              className={`py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                modal.mode === "register"
                  ? "bg-card text-primary font-bold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="size-3.5" />
              <span>Üye Ol</span>
            </button>
          </div>
        </div>

        {/* Form Body Area with Perfect Scroll (flex-1 min-h-0 overflow-y-auto) */}
        <div
          id={`v2-auth-tabpanel-${modal.mode}`}
          role="tabpanel"
          aria-labelledby={`v2-auth-tab-${modal.mode}`}
          tabIndex={0}
          className="p-5 sm:p-6 bg-card flex-1 min-h-0 overflow-y-auto"
        >
          {modal.mode === "login" ? (
            <V2LoginCard
              inModal={true}
              onAuthenticated={handleAuthenticated}
              onSwitchToRegister={() => setAuthModalMode("register")}
            />
          ) : (
            <V2RegisterCard
              inModal={true}
              provinces={provinces}
              onAuthenticated={handleAuthenticated}
              onSwitchToLogin={() => setAuthModalMode("login")}
            />
          )}
        </div>

        {/* Footer Security Badges (shrink-0) */}
        <div className="px-5 sm:px-6 py-2.5 bg-muted/30 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
          <div className="flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span>256-Bit SSL Güvenli Bağlantı</span>
          </div>
          <span className="font-mono text-[10px]">Coğrafya Gurmesi</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
