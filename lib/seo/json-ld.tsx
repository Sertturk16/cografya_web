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
  /** Root-relative path, e.g. "/il/istanbul". */
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

export function administrativeAreaJsonLd(args: {
  name: string;
  path: string;
  locale: Locale;
}): JsonLdSchema {
  // Structural only for now (name + url + language). GeoCoordinates / PropertyValue
  // (population, area) + FAQPage + LearningResource layers land with real API data.
  return {
    "@context": "https://schema.org",
    "@type": "AdministrativeArea",
    name: args.name,
    url: absoluteUrl(args.path),
    inLanguage: args.locale,
  };
}
