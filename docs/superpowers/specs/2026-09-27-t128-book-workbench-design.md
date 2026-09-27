# Book page: one-screen workbench for every book kind — design (T-128)

Status: design approved by the owner 2026-09-27, refined with `frontend-design` and `impeccable`
(shape); this written spec awaits review.

Scope: `cografya_api` (contract: two new fields, one extended progress response) and
`cografya_web` (`/kitaplar/[slug]` rebuilt). Visual reference, not a pixel target: the owner's
Claude Design project "Kitap Video Sayfası" (directions 1a "oynatma listesi" and 1b "iki adım").

## 1. Goal

Today the book page stacks a one-screen hero (cover, two paragraphs, four fact cards), a
40-number jump strip and all 30 deneme rows with their 180 question links. On a phone the reader
scrolls between the player and the question list constantly; nothing shows which denemeler are
done.

After this task:

- **Desktop (`lg`, 64rem, and up):** a playlist layout. The list of videos on the left, the
  player on the right, both always visible; the list scrolls inside its own panel, never the page.
- **Mobile (below `lg`):** two steps, each fitting one screen without page scroll. Step 1 picks a
  video; step 2 watches it and picks a question, with previous/next at the bottom.
- The same page serves five book kinds (§2) from one data model.

Success: at 360×640 and 390×844 each mobile step fits between the site header and the bottom of
the viewport with zero page scroll; at 1280×800 the list, the player and the marker strip are all
visible without page scroll.

## 2. Data model: Book → Group → Video → Marker

| Kind (`contentKind`) | Group (`groupTitleTr`)            | Video label              | Markers               |
| -------------------- | --------------------------------- | ------------------------ | --------------------- |
| `deneme`             | none                              | "Deneme 11" (composed)   | "Soru 1…n" (composed) |
| `soru_bankasi`       | "1. Ünite · Doğal Sistemler"      | "Test 4" (composed)      | "Soru 1…n"            |
| `konu_anlatimi`      | "3. Ünite · Ekonomik Faaliyetler" | "Tarım" (`titleTr`)      | named (`nameTr`)      |
| `kamp`               | "1. GÜN"                          | "1. Fasikül" (`titleTr`) | "Soru 1…n"            |
| `tek_video`          | none                              | `titleTr`                | named (`nameTr`)      |

Rules (pure, in `lib/book/workbench-model.ts`):

- Video label: `titleTr` when present, else `"{Noun} {orderNo}"` with the kind's noun
  (Deneme / Test / Ders / Fasikül / Video).
- Marker label: `nameTr` when present, else `"Soru {orderNo}"`. A video is **named** when any of
  its markers has a `nameTr`.
- Groups: consecutive videos (by `orderNo`) sharing a `groupTitleTr` form one group; a null title
  is an untitled group. No group headings render when the book has a single untitled group.
- Marker layout: named → list (label + time); unnamed and ≤ 12 → cards (number + time);
  unnamed and > 12 → dense number grid (time in the accessible label and `title`).
- Single-video book: the list step does not exist; the page opens on the watch view.

### 2.1 API changes (`cografya_api`)

One migration, additive, no data loss:

- `books.content_kind varchar(16) NOT NULL` with a CHECK over the five values; the migration sets
  the existing book to `deneme`, then drops the default. DTO: `contentKind` on
  `BookListItemDto` and `BookDetailDto`, a closed enum.
- `book_videos.group_title_tr varchar(120) NULL` (and `group_title_en`, null, same EN-twin rule as
  every other field). DTO: `groupTitleTr`, `groupTitleEn` on `BookVideoDto`.
- `BookProgressDto` gains `videos: { bookVideoId, lastPositionSeconds, watched }[]` — the reader's
  rows for this book, only the videos they have started. Feeds the list's status icons (§4.6).
- The seed (`pnpm db:seed:books`) writes `content_kind` for the existing book. No sample books go
  into the committed seed; the other kinds are exercised locally (§7).

Adding enum members to `contentKind` later is a breaking contract change, same as `examTrack`.
Web copy of the spec + `pnpm codegen` land in this task (root `CLAUDE.md` contract rule).

## 3. Design direction

Settled with `frontend-design` and `impeccable` (shape, Operate mode) inside Terra;
`docs/design.md` wins wherever they differ, so palette and faces are not reopened.

- **Operate, not Persuade.** A student arrives to watch the solution of a question they just got
  wrong. The page is a tool: earned familiarity (a playlist beside a player is what YouTube,
  Udemy and Ferrum already taught them), restrained colour, no decorative motion.
- **One bold element: the marker strip.** It is the only place the page spends emphasis. The
  current marker is a filled `primary` card, and it **follows playback**: while the in-page player
  runs, the marker whose segment contains the current time becomes current (the player already
  polls its time for progress saving). Everything around it stays quiet.
- **Primary colour means "current" and "primary action" only**: the current row tint, the
  current marker, İzle, the purchase button. Status icons use `--success` for done and
  `primary` for the partial ring; nothing else is tinted.
- **Type:** Fraunces only for the book title (the page `h1`) and the video label above the
  marker strip. List rows, meta, markers and buttons are Nunito Sans. Numbers are Nunito with
  `tabular-nums` (the Fraunces subset has no `tnum`, measured in the current page's docblock).
- **No template chrome:** no all-caps eyebrows (the group title sits above the video label in
  sentence case, `text-muted-foreground`), no middle-dot meta strings (a row is label on the
  left, duration right-aligned in a tabular column, marker count under the label), no mono data
  labels, no `→` appended to button text.
- **Motion:** state only, 150–200 ms: row tint and marker fill transitions; the mobile step swap
  is instant with focus moved (below). Global reduced-motion rule stays in force.

## 4. Layout

### 4.1 Shared chrome

- `V2LiveTicker` is removed from this page (it costs a line of viewport the workbench needs).
- The hero becomes a **book bar**: small cover (40×53), title, exam badge, a summary line
  ("30 deneme, 180 soru çözümü", plus "12/30 izlendi" when signed in), a "Kitap bilgisi" link
  to `#kitap-bilgisi`, and the existing purchase button. One row on desktop; on mobile it is
  shown only on step 1, as two lines with the purchase button reduced to an icon with an
  accessible name.
- The title stays the page's one `h1`, in a compact spelling that is not a hero tier. It is
  added to `H1_SPELLINGS` in `components/v2/page-composition-headings.test.ts` with its reason
  (a workbench bar, not a hero), replacing this page's current spelling there.
- **Below the workbench**, in page flow: `#kitap-bilgisi` with the intro prose and the four fact
  cards (unchanged content), then the attribution strip. These stay server-rendered text.

### 4.2 Desktop (`lg` and up)

One section is `height: calc(100dvh - var(--header-height))`, a flex column: the book bar at its
natural height, the workbench `flex-1 min-h-0` below it. The section has a floor
(`min-h-[36rem]`) so short laptop screens scroll the page rather than crushing the player.

- **Left panel, `w-[22rem]`**, own `overflow-y-auto`: the resume card (§4.6) on top, then groups
  with a heading and "3/6" progress, then one row per video: status icon, label with the marker
  count under it ("6 soru", "9 bölüm"), duration right-aligned in a tabular column. The current row is tinted `primary` at low alpha with `text-primary-strong`
  and carries `aria-current="true"`; selecting a row scrolls it into view inside the panel only.
- **Right column**, `min-w-0`, flex column: player (16:9, width-bound, max-height so the marker
  strip keeps ≥ 8rem), then a row with the group title (when there is one) over the video label
  and its facts on the left and prev / "11 / 30" / next plus the auto-next switch on the right, then the
  **marker strip** with its own `overflow-y-auto`, taking the remaining height.

### 4.3 Mobile (below `lg`)

The workbench is `height: calc(100dvh - var(--header-height))`; the page below it (book info,
footer) is reachable by scrolling past it, but neither step needs it.

- **Step 1 — pick:** book bar, resume card, then the list (same rows as desktop) in its own
  scroll area filling the rest.
- **Step 2 — watch:** a top line "← Denemeler" (kind's plural noun) and "11 / 30"; group title
  and label; player full-width 16:9; marker strip filling the remaining height with its own scroll;
  a bottom bar with two buttons "Önceki · Deneme 10" / "Sonraki · Deneme 12" (disabled at the
  ends), and the auto-next switch in the top line.
- Selecting a video pushes a history entry (`#video-12`), so the phone's back gesture returns to
  step 1; "← Denemeler" does `history.back()` when the entry is ours, else goes to step 1 with
  `replaceState`. Arriving on `#video-12…` opens step 2 directly. This supersedes the current
  "replaceState only" rule for video selection; question presses keep using `replaceState`.
- Focus follows the step: entering step 2 moves focus to the video label heading
  (`tabindex="-1"`); returning to step 1 moves it to the row just left, scrolled into view.
- The no-page-scroll guarantee is for portrait phones. In landscape (height below the
  workbench floor, `min-h-[30rem]`) the page scrolls normally rather than crushing the player.

### 4.4 Marker strip

- Layout by §2 (cards / dense grid / named list). Every marker is ≥ 44×44 (`docs/design.md`
  generous-control class), including dense-grid cells (`auto-fill`, `minmax(2.75rem,1fr)`):
  64 markers at 390 px is ~7 per row, ~10 rows, scrolling inside the strip.
- States: default, hover, focus-visible (global ring), current (filled `primary`,
  `aria-current="true"`). There is no "watched" state per marker: the API does not know it, and
  colouring markers before the current one would claim it.
- Named list rows: label left, time right in a tabular column; long names wrap, never truncate.

### 4.5 States

- **Signed out:** no status icons, no resume card, no "izlendi" count; everything else works
  up to the existing login gate on İzle.
- **Progress loading or failed:** rows render without icons, the resume card is absent; when
  progress arrives, icons fill in place (no layout shift: the icon slot is always reserved)
  and the resume card appears above the list.
- **Not playable video** (`external` state): the row shows "YouTube'da" instead of a duration;
  its markers stay plain fragment links, as today.
- **Single video:** no list step, no prev/next, no auto-next switch.

### 4.6 Status, resume and auto-next

- **Status icon per row** (signed in only; signed out shows no icons): check in `--success` when
  `watched`; a progress ring when started (ring fill = `lastPositionSeconds / durationSeconds`,
  half when the duration is unknown); an empty ring otherwise.
- **Resume card:** when `BookProgressDto.resume` exists, "Kaldığın yerden devam et — Deneme 11,
  4:12". Pressing it selects that video and presses İzle at that second (the same path the
  existing resume logic uses). Hidden when signed out or with no progress.
- **Auto-next:** a switch, default on, persisted per browser in `localStorage` (try/catch, off
  when storage throws). When the loaded player reports ENDED and a next video exists, the bench
  selects it and loads it from 0 through the same gated open path İzle uses. It never fires for
  a video that was not playing in the in-page player.

## 5. Behaviour kept

- Every video row is a real `<a href="#video-{n}">` and every marker a real
  `<a href="#video-{n}-etiket-{m}">` in the server HTML, for all videos. Only the selected
  video's marker panel is visible; the others are server-rendered with `hidden` and the island
  toggles it. Existing fragments and shared links keep working.
- The login gate, the click-to-load player facade, progress saving, the watched toggle,
  identity fetch and JSON-LD (`Book`, `VideoObject`) are unchanged in behaviour.
- The jump strip ("Denemeye atla"), the per-deneme `<details>` rows and `BenchTimeline` are
  deleted; the marker strip replaces all three.

## 6. Web structure

- `lib/book/workbench-model.ts` — §2 rules: `buildWorkbench(book)` → groups, items (label, meta,
  noun), marker layout. Pure, unit-tested.
- `app/[locale]/(site)/kitaplar/[slug]/page.tsx` — server: book bar, workbench markup (list +
  stage slot + marker panels), book info, attribution.
- `components/book/video-bench.tsx` — stays the one client island and the one delegated
  listener; gains step state (mobile), history handling, auto-next, the resume card and the
  status map. It is split where it grows: `book-status.ts` (progress → per-row status, pure,
  tested), `use-auto-next.ts`, and `current-marker.ts` (player time → current marker index,
  pure, tested; driven by the player's existing time poll).
- `components/book/bench-stage.tsx` / `deneme-video.tsx` — keep the player; add the ENDED
  callback. Tests whose subject disappears (`book-detail-floors`, `bench.structure`, timeline)
  are deleted or rewritten, not kept alive.
- Copy (Turkish) in `messages/tr.json` `BookDetail`, with the EN twins; nouns per kind in one
  table. Follows `docs/copy.md`.
- `docs/design.md` rules apply: one breakpoint (`lg`), bridge tokens only, 44 px targets for
  list rows, marker cards and prev/next, dense-grid cells ≥ 36 px.

## 7. Testing

- Unit: `workbench-model` (five kinds: labels, groups, layout thresholds 12/13, single-video),
  `current-marker` (before the first marker, on a boundary, past the last),
  `book-status` (watched / started / unknown duration / signed out), history-step reducer.
- API: migration up/down, DTO contract spec for the new fields, `getBookProgress` returns
  per-video rows, seed writes `content_kind`.
- Visual: four local-only sample books (one per non-deneme kind), inserted by a script under the
  scratch area into the dev database and never committed, with 6, 24 and 64 markers. Playwright
  at 320, 360, 390 px and 1280 px, light and dark, signed out and signed in; `pnpm
sweep:overflow -- --filter=/kitaplar`. The no-page-scroll criteria in §1 are checked by
  measuring `document.scrollingElement.scrollTop` range within the workbench's own box.

## 8. Out of scope

Filters and search in the list; per-book reading of a "Kitap bilgisi" sheet (it is an anchor);
changes to `/kitaplar` hub cards beyond reading `contentKind`; English copy beyond keys.
