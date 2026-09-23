"use client";

import * as React from "react";
import {
  useAuthModalState,
  dismissAuth,
  resolveAuth,
  setAuthModalMode,
  type AuthMode,
} from "@/lib/auth/auth-modal.client";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
        {/*
          A control switching between two forms, not page-level navigation, so `pills`
          (T-034 rationale, components/ui/tabs.tsx). The dialog's flex column continues
          through Tabs so the panel below keeps its scroll behaviour.
        */}
        <Tabs
          value={modal.mode}
          onValueChange={(value) => setAuthModalMode(value as AuthMode)}
          variant="pills"
          className="flex flex-col flex-1 min-h-0"
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
                Giriş yap ya da yeni hesap oluştur.
              </DialogDescription>
            </div>

            {/* Segmented Tab Switcher (Giriş Yap <-> Üye Ol) */}
            <TabsList
              aria-label="Kimlik Doğrulama Seçenekleri"
              className="grid grid-cols-2 h-auto p-1 gap-1 text-xs"
            >
              <TabsTrigger value="login" className="gap-1.5">
                <LogIn className="size-3.5" />
                <span>Giriş Yap</span>
              </TabsTrigger>
              <TabsTrigger value="register" className="gap-1.5">
                <UserPlus className="size-3.5" />
                <span>Üye Ol</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Form Body Area with Perfect Scroll (flex-1 min-h-0 overflow-y-auto) */}
          <TabsContent
            value="login"
            className="mt-0 px-5 pt-3 pb-5 sm:px-5.5 sm:pt-3 sm:pb-6 bg-card flex-1 min-h-0 overflow-y-auto"
          >
            <V2LoginCard
              inModal={true}
              onAuthenticated={handleAuthenticated}
              onSwitchToRegister={() => setAuthModalMode("register")}
            />
          </TabsContent>
          <TabsContent
            value="register"
            className="mt-0 px-5 pt-3 pb-5 sm:px-5.5 sm:pt-3 sm:pb-6 bg-card flex-1 min-h-0 overflow-y-auto"
          >
            <V2RegisterCard
              inModal={true}
              provinces={provinces}
              onAuthenticated={handleAuthenticated}
              onSwitchToLogin={() => setAuthModalMode("login")}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
