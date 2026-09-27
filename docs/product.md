# Product

<!-- impeccable:product-schema 1 -->

Coğrafya Gurmesi (cografyagurmesi.com): a free Turkish geography platform from the publishing
brand Coğrafya Gurmesi Yayınları, founded by two geography teachers, Murat Çakır and Murat
Karagöz. Voice and copy rules live in `docs/copy.md`; the visual system (Terra) lives in
`docs/design.md`. This file holds neither.

## Platform

web

## Users

- **Primary:** Turkish high-school students preparing for YKS (TYT/AYT geography). Many are
  under 18.
- **Secondary:** curious adults looking something up (a province, a recent earthquake, sea
  conditions), teachers and parents. Account types record Öğrenci / Öğretmen / Veli / Coğrafya
  meraklısı only so the owners know their audience; the type grants nothing.
- The owners ("hocalar") are the two teachers; they are not a user surface.

## Product Purpose

Make geography study free and reachable for everyone. Success, as the owners define it: the
Coğrafya Gurmesi name becomes a known, trusted geography source among students and teachers;
the books and the YouTube channel draw on that trust.

## Positioning

Everything a geography student needs in one place, and all of it free, membership included:
province, region, country and continent atlases, live earthquake and sea data, the authors'
own AYT practice exams with question-by-question video solutions, measuring tools, and
blank-map games.

## Operating Context

- Turkish only. English exists in code but is switched off (`ENGLISH_ENABLED = false`);
  `/en/*` redirects to Turkish.
- Sections: `/turkiye` (81 provinces, 7 regions), `/dunya` (countries, continents), `/deniz`
  (sea conditions, 4 basins, coast types), `/deprem` (AFAD earthquakes, fault lines,
  preparedness), `/kitaplar` (books, video solutions), `/araclar` (distance, coordinate, area;
  no sign-up), `/oyun` (map games, sub-brand "Kâşif"), accounts, legal.
- An account adds favourites, saved game rounds, saved measurements and video progress.
  Watching a video solution requires an account; everything else is open.

## Capabilities and Constraints

- No prices, premium tier or subscription anywhere. Books are the publisher's product; the
  site shows an outbound purchase link and never a price.
- Strictly necessary cookies only: no analytics, advertising or tracking.
- Earthquake, marine and air data can be delayed or incomplete; the site is not a source for
  navigation, disaster response, engineering or legal use.
- Open decision: the legal data controller's identity, address and phone (T-104, blocked on
  the owners).

## Brand Commitments

- Name "Coğrafya Gurmesi"; publisher "Coğrafya Gurmesi Yayınları"; logo
  `public/brand/logo.png`; footer line "Ücretsiz, açık coğrafya eğitim platformu."
- Teaching approach the owners stand behind: real-life examples and interpretive questions
  over memorised patterns, focus on the map and region questions students find hardest,
  ÖSYM-style questions without needless detail.
- Removed claims that must not return: "KVKK ve GDPR uyumlu", MEB curriculum alignment,
  "doğrulanmış"/"bilimsel" as praise, invented precision.

## Evidence on Hand

- Data sources credited on the site: AFAD, TÜİK, HGM, MGM, İçişleri, OpenStreetMap (ODbL),
  Natural Earth, JRC Global Surface Water, Copernicus Marine, ECMWF, C3S ERA5-Land, ACAG
  PM2.5 (with the WHO 2021 guideline), flag-icons.
- The authors' books and YouTube video solutions.
- None: testimonials, user or traffic numbers, press, awards, partner logos. Do not invent
  them.

## Product Principles

1. Free means free: no paywall, no teaser of paid content, no price on the page.
2. The YKS student comes first; when a surface must choose, it serves them before anyone else.
3. One platform: a student in one section should find the related map, data, exam or game
   without leaving the site.
4. Trust is the product: every figure traces to an official or open source, and no claim goes
   on the page that the product cannot prove.

## Accessibility & Inclusion

WCAG 2.1 AA, light and dark themes, usable from 320 px; the concrete floor is in
`docs/design.md`. The audience includes minors.
