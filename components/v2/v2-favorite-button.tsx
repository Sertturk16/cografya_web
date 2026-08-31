"use client";

import * as React from "react";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { requestAuth, useAuthModalState, consumeResolved } from "@/lib/auth/auth-modal.client";
import {
  fetchFavorites,
  saveFavorite,
  removeFavorite,
  FAVORITES_FETCH_TIMEOUT_MS,
  type FavoriteTargetParam,
} from "@/lib/favorites/client";
import { Button } from "@/components/ui/button";
import { Heart, Star, Loader2, Sparkles, Check, Lock } from "lucide-react";

interface V2FavoriteButtonProps {
  readonly target: FavoriteTargetParam;
  variant?: "default" | "compact" | "iconOnly";
  className?: string;
}

export function V2FavoriteButton({
  target,
  variant = "default",
  className = "",
}: V2FavoriteButtonProps) {
  const [authState] = useAuthSession();
  const modal = useAuthModalState();
  const [favorited, setFavorited] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [saveFailed, setSaveFailed] = React.useState(false);
  const [justToggled, setJustToggled] = React.useState(false);

  const targetRef = React.useRef(target);
  const hasClickedRef = React.useRef(false);
  const authRequestId = React.useRef<string | null>(null);

  // Fetch initial favorite state when authenticated
  React.useEffect(() => {
    if (authState !== "authenticated") return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FAVORITES_FETCH_TIMEOUT_MS);
    let cancelled = false;

    fetchFavorites(controller.signal)
      .then((favorites) => {
        if (cancelled || favorites === null || hasClickedRef.current) return;
        const currentTarget = targetRef.current;
        const match = favorites.some((favorite) =>
          currentTarget.kind === "province"
            ? favorite.type === "province" && favorite.plateCode === currentTarget.plateCode
            : favorite.type === "country" && favorite.isoCode === currentTarget.isoCode
        );
        setFavorited(match);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [authState]);

  const performToggle = React.useCallback(async () => {
    setSaveFailed(false);
    const next = !favorited;
    setFavorited(next); // optimistic update
    setPending(true);
    setJustToggled(true);

    const result = next ? await saveFavorite(target) : await removeFavorite(target);
    setPending(false);

    if (!result.ok) {
      setFavorited(!next); // rollback
      setSaveFailed(true);
    } else {
      setTimeout(() => setJustToggled(false), 1500);
    }
  }, [favorited, target]);

  const handleClick = async () => {
    if (pending) return;
    hasClickedRef.current = true;

    if (authState !== "authenticated") {
      authRequestId.current = requestAuth("favorite");
      return;
    }

    await performToggle();
  };

  // Resume after authentication
  React.useEffect(() => {
    const id = authRequestId.current;
    if (id === null || modal.resolvedRequestId !== id) return;
    if (!consumeResolved(id)) return;
    authRequestId.current = null;
    hasClickedRef.current = true;
    void performToggle();
  }, [modal.resolvedRequestId, performToggle]);

  if (variant === "iconOnly") {
    return (
      <Button
        type="button"
        variant={favorited ? "primary" : "outline"}
        size="icon-sm"
        role={authState === "authenticated" ? "switch" : undefined}
        aria-checked={authState === "authenticated" ? favorited : undefined}
        aria-label={
          favorited
            ? "Favorilerden çıkar"
            : authState === "authenticated"
            ? "Favorilere ekle"
            : "Favorilere eklemek için giriş yapın"
        }
        disabled={pending}
        onClick={() => void handleClick()}
        className={`rounded-full transition-all duration-300 ${
          favorited
            ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm ring-2 ring-rose-500/30 scale-105"
            : "text-muted-foreground hover:text-foreground hover:border-rose-400"
        } ${className}`}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <Heart
            className={`size-4 transition-transform duration-200 ${
              favorited ? "fill-white text-white scale-110" : "text-muted-foreground"
            }`}
          />
        )}
      </Button>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <Button
        type="button"
        variant={favorited ? "primary" : "outline"}
        size="sm"
        role={authState === "authenticated" ? "switch" : undefined}
        aria-checked={authState === "authenticated" ? favorited : undefined}
        aria-label={
          favorited
            ? "Favorilerden çıkar"
            : authState === "authenticated"
            ? "Favorilere ekle"
            : "Favorilere eklemek için giriş yapın"
        }
        disabled={pending}
        onClick={() => void handleClick()}
        className={`rounded-xl h-9 px-3 text-xs font-semibold gap-2 transition-all duration-300 shadow-2xs ${
          favorited
            ? "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white shadow-md ring-2 ring-rose-500/30 scale-[1.02]"
            : "bg-card/80 hover:bg-card border-border hover:border-rose-400/60 text-foreground"
        } ${className}`}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : favorited ? (
          <Heart className="size-3.5 fill-white text-white animate-in zoom-in-50 duration-200" />
        ) : authState === "authenticated" ? (
          <Heart className="size-3.5 text-rose-500 hover:scale-110 transition-transform" />
        ) : (
          <div className="flex items-center gap-1">
            <Heart className="size-3.5 text-rose-500" />
            <Lock className="size-2.5 text-muted-foreground" />
          </div>
        )}

        <span>
          {favorited ? "Favorilerde" : authState === "authenticated" ? "Favoriye Ekle" : "Favoriye Kaydet"}
        </span>

        {justToggled && favorited && (
          <Sparkles className="size-3 text-amber-300 animate-spin-slow" />
        )}
      </Button>

      {saveFailed && (
        <span className="absolute -bottom-5 left-0 text-[10px] text-destructive whitespace-nowrap">
          Kaydedilemedi, tekrar deneyin.
        </span>
      )}
    </div>
  );
}
