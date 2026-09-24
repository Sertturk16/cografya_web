import { env } from "@/lib/env";

/**
 * WHO the data controller (KVKK md. 10 "veri sorumlusu") and the content provider (5651 md. 3
 * künye) is — written ONCE (T-101). `/gizlilik` and `/hakkimizda` both render it through
 * `components/v2/legal-controller-identity.tsx`, which omits every `null` field, so filling a
 * field here is the whole change: no page edit, no message edit.
 *
 * TODO(owner): fill `legalName` (ticari unvan or ad-soyad), `address` and `phone`. 5651 md. 3
 * asks a content provider to publish all of them; until they are filled only the site name and
 * the e-mail address appear.
 */
export interface LegalController {
  /** The name the site is published under. */
  readonly siteName: string;
  /** Ticari unvan (şirket) or ad-soyad (şahıs). `null` until the owner provides it. */
  readonly legalName: string | null;
  /** Posta adresi. `null` until the owner provides it. */
  readonly address: string | null;
  /** Telefon, as it should be displayed. `null` until the owner provides it. */
  readonly phone: string | null;
  /** KVKK başvuru and general contact address. */
  readonly email: string;
}

export const LEGAL_CONTROLLER: LegalController = {
  siteName: "Coğrafya Gurmesi",
  legalName: null,
  address: null,
  phone: null,
  // The one contact address the site already publishes (defaults to info@cografyagurmesi.com).
  email: env.NEXT_PUBLIC_CONTACT_EMAIL,
};
