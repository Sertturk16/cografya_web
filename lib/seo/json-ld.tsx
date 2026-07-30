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
