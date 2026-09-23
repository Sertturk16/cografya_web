"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { requestAuth, useAuthModalState, consumeResolved } from "@/lib/auth/auth-modal.client";
import {
  fetchFavorites,
  saveFavorite,
  removeFavorite,
  isFavoriteMatch,
  FAVORITES_FETCH_TIMEOUT_MS,
  type FavoriteMutationErrorCode,
  type FavoriteTargetParam,
} from "@/lib/favorites/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Heart, Sparkles, Lock } from "lucide-react";

/**
 * The copy for a failed toggle. An expired session links to the login page; the login page has no
 * return-path parameter today (it always lands on `/`), so the link carries none.
 */
export function FavoriteFailureText({ code }: { readonly code: FavoriteMutationErrorCode }) {
  const t = useTranslations("Favorites");
  if (code === "session-expired") {
    return t.rich("sessionExpired", {
      link: (chunks) => (
        <Link href="/giris" className="font-semibold underline underline-offset-2">
          {chunks}
        </Link>
      ),
    });
  }
  return t("saveError");
}

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
  const t = useTranslations("Favorites");
  const [authState] = useAuthSession();
  const modal = useAuthModalState();
  const [favorited, setFavorited] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  // Why the last toggle failed, or null. An expired session gets its own copy with a login link:
  // clicking again cannot fix it, and "try again" would say it can.
  const [failure, setFailure] = React.useState<FavoriteMutationErrorCode | null>(null);
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
        const match = favorites.some((favorite) => isFavoriteMatch(currentTarget, favorite));
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
    setFailure(null);
    const next = !favorited;
    setFavorited(next); // optimistic update
    setPending(true);
    setJustToggled(true);

    const result = next ? await saveFavorite(target) : await removeFavorite(target);
    setPending(false);

    if (!result.ok) {
      setFavorited(!next); // rollback
      setFailure(result.code);
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
            ? t("removeAria")
            : authState === "authenticated"
              ? t("addAria")
              : t("signInRequiredAria")
        }
        disabled={pending}
        onClick={() => void handleClick()}
        className={`rounded-full transition-all duration-300 ${
          favorited
            ? "hover:bg-primary-strong shadow-sm scale-105"
            : "text-muted-foreground hover:text-foreground"
        } ${className}`}
      >
        {pending ? (
          <Spinner size="default" label={t("savingLabel")} className="text-muted-foreground" />
        ) : (
          <Heart
            className={`size-4 transition-transform duration-200 ${
              favorited ? "fill-current scale-110" : "text-muted-foreground"
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
            ? t("removeAria")
            : authState === "authenticated"
              ? t("addAria")
              : t("signInRequiredAria")
        }
        disabled={pending}
        onClick={() => void handleClick()}
        className={`rounded-xl h-9 px-3 text-xs font-semibold gap-2 transition-all duration-300 shadow-2xs ${
          favorited
            ? "hover:bg-primary-strong shadow-md scale-[1.02]"
            : "bg-card/80 hover:bg-card border-border text-foreground"
        } ${className}`}
      >
        {pending ? (
          <Spinner size="sm" label={t("savingLabel")} className="text-muted-foreground" />
        ) : favorited ? (
          <Heart className="size-3.5 fill-current animate-in zoom-in-50 duration-200" />
        ) : authState === "authenticated" ? (
          <Heart className="size-3.5 hover:scale-110 transition-transform" />
        ) : (
          <div className="flex items-center gap-1">
            <Heart className="size-3.5" />
            <Lock className="size-2.5 text-muted-foreground" />
          </div>
        )}

        <span>{favorited ? t("addedLabel") : t("addLabel")}</span>

        {justToggled && favorited && <Sparkles className="size-3 animate-spin-slow" />}
      </Button>

      {failure && (
        <span
          role="alert"
          className="absolute -bottom-5 left-0 text-[10px] text-destructive whitespace-nowrap"
        >
          <FavoriteFailureText code={failure} />
        </span>
      )}
    </div>
  );
}
