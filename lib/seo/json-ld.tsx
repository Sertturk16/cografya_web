import type { Locale } from "@/i18n/routing";
import { absoluteUrl, getSiteUrl, siteConfig } from "./site";

// Minimal JSON-LD value typing — avoids `any` while staying schema-agnostic.
type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[];
interface JsonLdObject {
  [key: string]: JsonLdValue;
}
export interface JsonLdSchema extends JsonLdObject {
  "@context": "https://schema.org";
  "@type": string;
}

/**
 * Server-renders a JSON-LD <script> (CONVENTIONS §6 #5 — never client-injected).
 * `<` is escaped to `<` so structured data can never break out of the
 * <script> element (XSS-safe serialization).
 */
export function JsonLd({ schema }: { schema: JsonLdSchema | JsonLdSchema[] }) {
  const json = JSON.stringify(schema).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

// ---- Builders (per the founding schema map, CONVENTIONS §6) -----------------

export function websiteJsonLd(locale: Locale): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: getSiteUrl(),
    inLanguage: locale,
  };
}

export function organizationJsonLd(): JsonLdSchema {
  // EducationalOrganization author/E-E-A-T identity is deferred (CONVENTIONS §5 K8);
  // this is the minimal publisher entity until that lands.
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: getSiteUrl(),
  };
}

export interface BreadcrumbItem {
  name: string;
  /** Root-relative path, e.g. "/turkiye/istanbul". */
  path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** One enumerated entry in an ItemList (a province in the /turkiye hub). */
export interface ItemListEntry {
  name: string;
  /** Root-relative path to the item's canonical page, e.g. "/turkiye/istanbul". */
  path: string;
}

/**
 * `schema.org/ItemList` for a hub page that enumerates concrete child pages
 * (CONVENTIONS §6 #5 schema map — the list layer for a collection). Only pages that
 * actually exist are passed in (never a soft-404 URL, §6 #6). Positions are 1-based.
 */
export function itemListJsonLd(args: { name: string; items: ItemListEntry[] }): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: args.name,
    numberOfItems: args.items.length,
    itemListElement: args.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function collectionPageJsonLd(args: {
  name: string;
  description: string;
  path: string;
  locale: Locale;
}): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: args.name,
    description: args.description,
    url: absoluteUrl(args.path),
    inLanguage: args.locale,
  };
}

/** One visible question/answer pair from a page's FAQ block. */
export interface FaqEntry {
  question: string;
  /** Plain text — must be the SAME text the page renders visibly. */
  answer: string;
}

/**
 * `schema.org/FAQPage` (CONVENTIONS §6 #5 schema map — the FAQ layer).
 *
 * The caller MUST pass the exact question/answer text the page renders visibly: Google's
 * FAQPage documentation requires the content to be visible to the user, and
 * `SEO-POLICY.md` §B5 5.7 bans structured data that is not on the page. So the visible
 * `<details>` block and this markup are built from ONE source of message keys, never two.
 * Answers are plain text (no embedded markup) so the two representations are compared
 * character-for-character rather than approximately.
 */
export function faqPageJsonLd(entries: FaqEntry[]): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}

/**
 * `schema.org/LearningResource` — the education layer of the schema map
 * (CONVENTIONS §6 #5), used by learn-by-doing surfaces such as the map game.
 *
 * Deliberately small: only fields whose value is actually true of the page are emitted.
 * `isAccessibleForFree: true` is a statement of fact about this platform (no paywall, no
 * sign-up), and `learningResourceType` + `teaches` describe what the page IS and what it
 * teaches. No `Game`/`VideoGame`/`SoftwareApplication` node is added on purpose (SPEC
 * §10.2): they produce no rich result here and would only add markup that describes the
 * page less accurately (`SEO-POLICY.md` §B5 5.7/5.8).
 */
export function learningResourceJsonLd(args: {
  name: string;
  description: string;
  path: string;
  locale: Locale;
  /** e.g. "Game" — the shape of the resource. */
  learningResourceType: string;
  /** What the resource teaches, in the page's language. */
  teaches: string;
}): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: args.name,
    description: args.description,
    url: absoluteUrl(args.path),
    inLanguage: args.locale,
    learningResourceType: args.learningResourceType,
    teaches: args.teaches,
    isAccessibleForFree: true,
  };
}

/** A single `schema.org/PropertyValue` fact (population, area, …). */
export interface GeoPropertyValue {
  name: string;
  value: string | number;
  /** Human-readable unit, e.g. "km²". Omit for unit-less counts. */
  unitText?: string;
  /** UN/CEFACT unit code, e.g. "KMK" for square kilometre. Optional. */
  unitCode?: string;
}

export function administrativeAreaJsonLd(args: {
  name: string;
  path: string;
  locale: Locale;
  /** Il-merkez coordinates (decimal degrees). Omitted when the api has no value. */
  geo?: { latitude: number; longitude: number } | null;
  /** Structured facts (nüfus, yüzölçümü, …) as schema.org PropertyValue nodes. */
  additionalProperty?: GeoPropertyValue[];
  /** The containing country (Türkiye) as a schema.org Country node. */
  containedInPlace?: { name: string } | null;
  /** ISO date-time of the last data change (api `updated_at`). */
  dateModified?: string;
}): JsonLdSchema {
  const schema: JsonLdSchema = {
    "@context": "https://schema.org",
    "@type": "AdministrativeArea",
    name: args.name,
    url: absoluteUrl(args.path),
    inLanguage: args.locale,
  };

  if (args.geo) {
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: args.geo.latitude,
      longitude: args.geo.longitude,
    };
  }

  if (args.containedInPlace) {
    schema.containedInPlace = {
      "@type": "Country",
      name: args.containedInPlace.name,
    };
  }

  if (args.additionalProperty && args.additionalProperty.length > 0) {
    schema.additionalProperty = args.additionalProperty.map((property) => {
      const node: JsonLdObject = {
        "@type": "PropertyValue",
        name: property.name,
        value: property.value,
      };
      if (property.unitText !== undefined) node.unitText = property.unitText;
      if (property.unitCode !== undefined) node.unitCode = property.unitCode;
      return node;
    });
  }

  if (args.dateModified) {
    schema.dateModified = args.dateModified;
  }

  return schema;
}

/**
 * `schema.org/Book` for a `/kitaplar/{slug}` book detail page — the book layer of the
 * schema map (`SEO-POLICY.md` §B5 5.2, book surface table).
 *
 * The emitted field set is exactly the one §B5 names — `name`, `author`, `publisher`,
 * `isbn`, `numberOfPages`, `inLanguage` — plus the `url` every builder in this file
 * carries. Three deliberate absences, each with a rule behind it:
 *
 * · **No `Product`, no `offers`.** We publish a purchase link and no price (DEC
 *   2026-08-15c), and a priceless `Offer` is precisely §B5 5.8's invented field. §B5 states
 *   this ban in the book table itself.
 * · **No `hasPart` / video nodes.** Declaring the solution videos as parts of the BOOK
 *   would assert a relationship nobody has established — misleading markup under Google's
 *   structured-data general guidelines. The videos carry their own `VideoObject` nodes.
 * · **No `image`.** The cover is rendered and would be legitimate, but §B5's book field
 *   list does not name it, and extending that list is a policy decision rather than an
 *   implementation one (open with Atlas/FENER, to be ruled when the page is built).
 *
 * `inLanguage` is a PARAMETER and is not derived from the page locale. On a `CreativeWork`
 * this field describes the WORK's language, not the chrome around it — and the contract
 * carries no language column, so the builder asserts nothing and the caller supplies the
 * value (`"tr"`: the book is printed in Turkish, which is also why `titleEn` is null).
 *
 * `authorNames` is emitted IN THE ORDER GIVEN and is never sorted: a credit order is
 * published data, and re-ordering it to look tidy would rewrite it. The array's fidelity to
 * the printed cover is the api's business, not this builder's — so this comment states what
 * the builder does with the order, and deliberately makes no claim about what the book
 * prints. Every optional field is emitted only when the api actually has a value.
 */
export function bookJsonLd(args: {
  name: string;
  /** Root-relative path to the book's canonical page, e.g. "/kitaplar/{slug}". */
  path: string;
  /** The language of the BOOK, supplied by the caller — never the page locale. */
  inLanguage: string;
  /** Authors in the order the contract supplies them. Never sorted. */
  authorNames: readonly string[];
  publisherName: string;
  /** ISBN-13, digits only. Omitted when the api has no value. */
  isbn?: string | null;
  /** Printed page count. Omitted when the api has no value. */
  numberOfPages?: number | null;
  /** ISO date-time of the last data change (api `updated_at`) — §B5 5.9. */
  dateModified?: string;
}): JsonLdSchema {
  const schema: JsonLdSchema = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: args.name,
    url: absoluteUrl(args.path),
    inLanguage: args.inLanguage,
    author: args.authorNames.map((authorName) => ({
      "@type": "Person",
      name: authorName,
    })),
    publisher: {
      "@type": "Organization",
      name: args.publisherName,
    },
  };

  if (args.isbn) {
    schema.isbn = args.isbn;
  }

  if (args.numberOfPages !== undefined && args.numberOfPages !== null) {
    schema.numberOfPages = args.numberOfPages;
  }

  if (args.dateModified) {
    schema.dateModified = args.dateModified;
  }

  return schema;
}

/**
 * `schema.org/VideoObject` for one video solution on a book detail page
 * (`ENGINEERING.md` §4 #5 — "`VideoObject` for video solutions"; `SEO-POLICY.md` §B5 5.2).
 *
 * ## The four required arguments are required ON PURPOSE
 *
 * `name`, `thumbnailUrl`, `uploadDate` and `duration` are non-optional in this signature,
 * and that is this builder's main safety property rather than an accident of style. Three
 * of the four can only come from the api's provider-snapshot object, which is nullable and
 * is null on the normal path today — so when there is no snapshot, a `VideoObject` cannot
 * be constructed here **without inventing data**, and inventing it is exactly what §B5 5.8
 * rates BLOCKER. The rule "emit `VideoObject` only when the provider data exists" is
 * therefore enforced by the type, not by a comment somebody has to remember.
 *
 * (Google's own required set is `name` + `thumbnailUrl` + `uploadDate`, and it additionally
 * requires that the markup sit on a page where the video can actually be watched — so a
 * block that cannot be played on this page emits nothing at all. `duration` is required
 * here rather than optional because §B5 5.7 pairs it with visible page content: if it is in
 * the markup it is on the page, and the page shows it whenever the snapshot exists.)
 *
 * ## Two values that pass through untouched, and why
 *
 * · **`thumbnailUrl` is used exactly as the provider returned it.** It is never built from
 *   the video id, normalised, resized or given a different host. YouTube Developer Policies
 *   III.E.5 bars replacing API Data with independently computed data, and III.E.1 bars
 *   producing byte copies — which is also why this image never reaches `next/image`
 *   (`ENGINEERING.md` §4 #9, second exception).
 * · **`duration` is the provider's raw ISO 8601 string**, not a value re-derived from the
 *   parsed seconds. The contract publishes both precisely because a parser that reads
 *   "PT6M8S" as 68 seconds satisfies every range check and is still wrong on the page.
 *
 * ## Two fields that are never emitted
 *
 * · **`description`** — recommended by Google, not required, and this surface has no
 *   visible per-video summary. §B5 5.7 rates structured data that is not on the page a
 *   BLOCKER, so emitting one would trade a nice-to-have for a violation.
 * · **`hasPart` / `Clip`** — ruled: not emitted (Atlas, 2026-08-15, closing web SPEC E4).
 *   Google defines a clip URL as the video's own URL plus a time QUERY PARAMETER; our ruled
 *   deep link is a fragment (`#deneme-12-soru-3`), which does not satisfy that definition,
 *   and generating query-parameter variants was rejected separately under §B12 12.2.c. A
 *   `url` the page does not honour is a structured-data claim about a page behaviour that
 *   does not exist. `json-ld.test.ts` asserts the ABSENCE of both keys, which is what stops
 *   either being reintroduced later as an enhancement.
 */
export function videoObjectJsonLd(args: {
  /** The video's visible title on our page. */
  name: string;
  /** The provider's thumbnail address, verbatim. NEVER constructed from the video id. */
  thumbnailUrl: string;
  /** ISO date-time the video was published (contract `publishedAtUtc`). */
  uploadDate: string;
  /** ISO 8601 duration, the provider's raw string (contract `durationIso`). */
  duration: string;
  /** The player address this page actually loads. Omitted when the caller has none. */
  embedUrl?: string | null;
}): JsonLdSchema {
  const schema: JsonLdSchema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: args.name,
    thumbnailUrl: args.thumbnailUrl,
    uploadDate: args.uploadDate,
    duration: args.duration,
  };

  if (args.embedUrl) {
    schema.embedUrl = args.embedUrl;
  }

  return schema;
}

/**
 * `schema.org/Country` for a `/dunya/{slug}` country detail page (CONVENTIONS §6 #5 schema
 * map — the geo layer at country scale). `Country` is a subtype of `AdministrativeArea`, so
 * this mirrors `administrativeAreaJsonLd` field-for-field, with three country-scale nuances
 * (SPEC §6): `geo` is the CAPITAL's coordinates (the il-merkez analogue); `identifier`
 * carries the ISO 3166-1 code (the generic schema.org identifier, a truer fit than a
 * PropertyValue); and `containedInPlace` is the continent as a generic `Place` — schema.org
 * has no `Continent` type, so a `Place` node is the honest mapping (validators accept it).
 * Every field is emitted only when the api actually has the value (null → skipped, never
 * invented).
 */
export function countryJsonLd(args: {
  name: string;
  path: string;
  locale: Locale;
  /** Capital coordinates (decimal degrees). Omitted when the api has no value. */
  geo?: { latitude: number; longitude: number } | null;
  /** Structured facts (nüfus, yüzölçümü, komşu ülke sayısı, …) as PropertyValue nodes. */
  additionalProperty?: GeoPropertyValue[];
  /** ISO 3166-1 code (alpha-2, or alpha-3 when present) → schema.org `identifier`. */
  isoCode?: string | null;
  /** The containing continent as a generic `Place` (no schema.org `Continent` type exists). */
  containedInPlace?: { name: string } | null;
  /** ISO date-time of the last data change (api `updated_at`). */
  dateModified?: string;
}): JsonLdSchema {
  const schema: JsonLdSchema = {
    "@context": "https://schema.org",
    "@type": "Country",
    name: args.name,
    url: absoluteUrl(args.path),
    inLanguage: args.locale,
  };

  if (args.isoCode) {
    schema.identifier = args.isoCode;
  }

  if (args.geo) {
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: args.geo.latitude,
      longitude: args.geo.longitude,
    };
  }

  if (args.containedInPlace) {
    schema.containedInPlace = {
      "@type": "Place",
      name: args.containedInPlace.name,
    };
  }

  if (args.additionalProperty && args.additionalProperty.length > 0) {
    schema.additionalProperty = args.additionalProperty.map((property) => {
      const node: JsonLdObject = {
        "@type": "PropertyValue",
        name: property.name,
        value: property.value,
      };
      if (property.unitText !== undefined) node.unitText = property.unitText;
      if (property.unitCode !== undefined) node.unitCode = property.unitCode;
      return node;
    });
  }

  if (args.dateModified) {
    schema.dateModified = args.dateModified;
  }

  return schema;
}
