import type { SearchEntityKind } from "./types";

/**
 * The `Search.*` message key that labels each kind of result row (İl, Ülke, Bölge, Kıta, Deniz,
 * Araç, Sayfa). One table for both search boxes, so the header and the homepage hero can never
 * name the same row differently. Keys are literal so next-intl still types every lookup.
 */
export const KIND_LABEL_KEY = {
  p: "province",
  c: "country",
  r: "region",
  k: "continent",
  s: "sea",
  t: "tool",
  g: "page",
} as const satisfies Record<SearchEntityKind, string>;
