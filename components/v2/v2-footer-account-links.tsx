"use client";

import { Link } from "@/i18n/navigation";
import { type AuthSessionState, useAuthSession } from "@/lib/auth/use-session.client";

/**
 * The footer's two account rows, by session state (T-163). The footer is a server component
 * rendered by the `(site)` layout, and its pages are ISR, so it cannot read the session itself;
 * this island reads the shared session store instead.
 *
 * - A guest keeps the two links the footer always had.
 * - A signed-in reader gets the hub and its settings. No sign-out: the header's account menu is
 *   the one place to sign out (`v2-header-account-menu.test.ts`).
 * - While the check runs (and on the server), two hidden rows of the link rows' height hold the
 *   place, so neither set flashes and the column does not jump when the state settles.
 */
export function V2FooterAccountLinksView({ state }: { readonly state: AuthSessionState }) {
  if (state === "checking") {
    return (
      <>
        <li aria-hidden="true" className="h-4" />
        <li aria-hidden="true" className="h-4" />
      </>
    );
  }
  if (state === "authenticated") {
    return (
      <>
        <li>
          <Link href="/hesabim" className="hover:text-accent transition-colors block">
            Hesabım
          </Link>
        </li>
        <li>
          <Link href="/hesabim/ayarlar" className="hover:text-accent transition-colors block">
            Ayarlar
          </Link>
        </li>
      </>
    );
  }
  return (
    <>
      <li>
        <Link href="/giris" className="hover:text-accent transition-colors block">
          Giriş Yap
        </Link>
      </li>
      <li>
        <Link href="/kayit" className="hover:text-accent transition-colors block">
          Ücretsiz Kayıt Ol
        </Link>
      </li>
    </>
  );
}

export function V2FooterAccountLinks() {
  const [state] = useAuthSession();
  return <V2FooterAccountLinksView state={state} />;
}
