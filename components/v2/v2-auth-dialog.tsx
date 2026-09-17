"use client";

import * as React from "react";
import {
  useAuthModalState,
  dismissAuth,
  resolveAuth,
  setAuthModalMode,
} from "@/lib/auth/auth-modal.client";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { V2LoginCard } from "./v2-login-card";
import { V2RegisterCard } from "./v2-register-card";
import { X, LogIn, UserPlus } from "lucide-react";

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
        className="p-0 overflow-hidden sm:max-w-[450px] max-h-[min(90vh,680px)] flex flex-col gap-0 rounded-3xl border border-border/80 shadow-2xl bg-card"
      >
        {/* Custom Header Bar with Clean Terra Styling & Close Button (shrink-0) */}
        <div className="relative px-5 pt-4.5 pb-3 sm:px-5.5 sm:pt-5 sm:pb-3 bg-card border-b border-border/80 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-base text-primary">
              Coğrafya <span className="text-primary">Gurmesi</span>
            </span>
            <button
              type="button"
              onClick={dismissAuth}
              className="size-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Kapat"
            >
              <X className="size-4" />
            </button>
            <DialogTitle className="sr-only">Coğrafya Gurmesi Hesabı</DialogTitle>
            <DialogDescription className="sr-only">
              Giriş yapın veya yeni hesap oluşturun.
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
          className="px-5 pt-3 pb-5 sm:px-5.5 sm:pt-3 sm:pb-6 bg-card flex-1 min-h-0 overflow-y-auto"
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
      </DialogContent>
    </Dialog>
  );
}
