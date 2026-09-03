import type { AlphabetBucket } from "@/lib/geo/alphabet";
import type { ItemListEntry } from "@/lib/seo/json-ld";
import styles from "./entity-index.module.css";

interface EntityIndexProps {
  /** Stable, locale-independent same-page anchor for the whole section ("iller"/"ulkeler"). */
  readonly sectionId: string;
  /** Id of the section's `<h2>`, referenced by `aria-labelledby`. */
  readonly headingId: string;
  readonly heading: string;
  /**
   * OPTIONAL (→ owner report, turkiye-editor-notlari md.4 — `/turkiye` dropped its own count
   * restatement here as a third repeat of a number the meta description and the map→index
   * bridge already stated, with the "Alfabetik" heading already carrying the "alphabetical"
   * fact). `/dunya` still passes one (`Dunya.indexDescription`, unaffected) — this component
   * stays shared, the caller decides whether it has anything non-redundant to say.
   */
  readonly description?: string;
  /** Accessible name of the letter-jump `<nav>` (two navs on a page need distinct names). */
  readonly letterNavLabel: string;
  readonly buckets: readonly AlphabetBucket<ItemListEntry>[];
}

/**
 * The alphabetical A→Z index section of a hub page (`/turkiye#iller`, `/dunya#ulkeler`,
 * → DEC 2026-08-04i §2). A **server component with zero client JavaScript**: the whole list
 * is in the first HTML response, which is what makes it both a real answer for a reader who
 * cannot hunt shapes on a map and a real set of crawlable internal links
 * (`SEO-POLICY.md` §B8.1/§B8.2, CONVENTIONS §6 #1/#10).
 *
 * ## No new URL
 *
 * The owner ruled the list is a SECTION on the existing hubs, not a new route
 * (→ DEC 2026-08-04i §2, plan Q1). `#iller` is a fragment, not a URL: canonical, hreflang,
 * the sitemap and `notFound()` behaviour are all untouched by this component, and the
 * retired `/iller` pattern (`SEO-POLICY.md` §B4) stays retired.
 *
 * ## It also repairs the hub's structured data
 *
 * Both hubs already emit an `ItemList` enumerating every published entity, but until now
 * those names existed on the page only inside the SVG map's `aria-label` / `data-*`
 * attributes — never as visible text. §B5.7 ("is there data in the JSON-LD that is not
 * visible on the page") was defensible but thin. Because the caller feeds THE SAME
 * `ItemListEntry[]`, in the same order, to both this component and `itemListJsonLd`, the
 * visible list and the structured data cannot disagree.
 *
 * ## Plain `<a>`, not next-intl `<Link>`
 *
 * `path` is already the final localized path resolved through `getPathname` by the caller.
 * The map sections next to this one use the same plain-anchor pattern for the same reason:
 * these are up to 196 links, and handing that many hrefs to the client router's prefetch
 * machinery costs far more than the client-side transition is worth here.
 */
export function EntityIndex({
  sectionId,
  headingId,
  heading,
  description,
  letterNavLabel,
  buckets,
}: EntityIndexProps) {
  // Nothing published (or a transient api failure upstream) renders no section at all,
  // rather than a heading over an empty list promising content that is not there.
  if (buckets.length === 0) return null;

  return (
    // `tabIndex={-1}` on every fragment target (this section and each letter heading below):
    // a plain `id` scrolls the page but does NOT move keyboard/AT focus, so a letter jump
    // would be a no-op for non-mouse users — the next Tab would resume from the letter strip
    // at the top. Same fix the repo already applies to the skip-link target (PR #2) and to
    // the marine deep-link rows. `:focus-visible` keeps the ring off for pointer users.
    <section
      id={sectionId}
      tabIndex={-1}
      className={`section ${styles.index}`}
      aria-labelledby={headingId}
    >
      <h2 id={headingId}>{heading}</h2>
      {description && <p className={styles.intro}>{description}</p>}

      <nav aria-label={letterNavLabel} className={styles.letterNav}>
        {buckets.map((bucket) => (
          <a key={bucket.id} href={`#${bucket.id}`}>
            {bucket.letter}
          </a>
        ))}
      </nav>

      {buckets.map((bucket) => (
        <div key={bucket.id} className={styles.group}>
          <h3 id={bucket.id} tabIndex={-1} className={styles.groupHeading}>
            {bucket.letter}
          </h3>
          {/* `role="list"` is REQUIRED here, not redundant: Safari/VoiceOver strip implicit
              list semantics from a `<ul>` styled `list-style: none`, which would turn the
              277 links this section exists to expose back into unstructured link soup. */}
          <ul role="list" className={styles.list}>
            {bucket.items.map((item) => (
              <li key={item.path}>
                <a href={item.path} className={styles.link}>
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
