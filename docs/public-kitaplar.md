# `public/kitaplar/` — book cover assets, and the route this directory can shadow

Files under `public/kitaplar/` are served from the site root, so
`public/kitaplar/x.webp` answers `/kitaplar/x.webp`. This is the repo's first `public/`
directory.

**This file lives in `docs/` and not beside the assets it describes, on purpose.**
Everything under `public/` is served verbatim, so a README kept there answered
`/kitaplar/README.md` — a crawlable 200 sitting inside an indexable route family, reachable
by anyone who guessed the address (PR #61 review `FENER61-M4`; Atlas ruled it could stay for
W0 and move at W1). There is no way to keep a note inside that directory without publishing
it, so it moved out and `next.config.ts`'s `next/image` note points here.

---

## The trap: this directory shares its URL prefix with a real route

`/kitaplar` (the book hub) and `/kitaplar/[slug]` (the book detail page) are declared
routes (`i18n/routing.ts`). Static files under `public/` are served **ahead of** the
router, so a file placed here can answer a URL the router was meant to answer — with a
200 and the wrong body. Nothing catches that: it is not a type error, not a lint error,
and not a failing test. The page simply becomes an image.

**Every file in this directory MUST carry a file extension.** Book slugs never do
(`ayt-cografya-konu-ozetli-brans-denemeleri` — `GLOSSARY.md` §5 keeps slugs to
`[a-z0-9-]`), so the extension is the whole reason the two namespaces stay disjoint.

Two rules follow, and neither is a style preference:

1. **Never add an extensionless file here.**
2. **Never name a file exactly like a book slug with nothing after it.**

If a cover ever needs a name that is not `{slug}.{ext}`, change the name — not the rule.

## Naming

`{slug_tr}.{ext}`. The api stores the same string in `books.cover_image_path` and serves
it as `coverImagePath`, and the page renders whatever that column says. The two sides must
agree **byte for byte**: a single character of drift renders no cover at all, silently,
because a missing image is not an error condition anywhere in the chain.

## Files

| File                                             | Dimensions |
| ------------------------------------------------ | ---------- |
| `ayt-cografya-konu-ozetli-brans-denemeleri.webp` | 480 × 758  |

WebP with an alpha channel (transparent background), so it sits on whatever surface the
card gives it rather than carrying its own backdrop.

**Provenance is recorded outside this repository.** Every asset there has a row naming its
origin and the terms it may be used under, kept with the project's other source records.
**Ask before adding, replacing or re-using a file** — the row is written first, and it is
not written from here. Do not mirror any of it into this page either: a second copy of a
provenance status drifts from the first, and the ledger is the only home for one.

> **Every FILE under `public/kitaplar/` is public, and this note no longer is.** Moving it
> to `docs/` removed the published address, not the discipline that address demanded: what
> goes into that directory is still served verbatim at the site root, so an asset added
> there is an asset published. Facts that nothing verifies do not belong in this page for
> a separate reason — a byte count in a table is a claim that rots the first time the file
> is re-encoded, wherever the table lives.

## Rendering

Local images go through `next/image` (`ENGINEERING.md` §4 #9). The exception in that item
covers a REMOTE image whose provider forbids byte copies — the YouTube thumbnail — and
explicitly does not reach our own files. A cover here is our file.
