# T-128 Book Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/kitaplar/[slug]` as a one-screen workbench (desktop playlist, mobile pick → watch) that serves five book kinds from one data model.

**Architecture:** The API gains `books.content_kind`, `book_videos.group_title_tr/en` and a per-video list on the book progress response. The web page stays server-rendered (every video row and marker is a real `<a>` in the HTML); the one client island (`VideoBench`) owns selection, the mobile step, history, panel visibility, status icons, the current marker, resume and auto-next by toggling attributes on that server markup. Pure rules live in `lib/book/*.ts` with unit tests.

**Tech Stack:** NestJS + TypeORM + Postgres (api), Next.js App Router + next-intl + Tailwind v4 + Base UI (web), jest (api), vitest node env (web), Playwright MCP for visual checks.

**Spec:** `cografya_web/docs/superpowers/specs/2026-09-27-t128-book-workbench-design.md`

## Global Constraints

- Branches: `cografya_api` → `feature/t128-book-content-kind`, `cografya_web` → `feature/t128-book-workbench` (already exists, carries the spec). Both from `origin/dev`. Conventional Commits; end every commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every schema change is a NEW migration; never edit an old one. Register it in `src/database/data-source-options.ts` AND in the two ordered lists in `test/province.e2e-spec.ts` and `test/country.e2e-spec.ts`.
- Contract flow: `cd cografya_api && pnpm openapi:generate` → `cp openapi/openapi.json ../cografya_web/openapi/openapi.json` → `cd ../cografya_web && pnpm codegen`. Never hand-edit `lib/api/schema.ts` or `openapi.json`.
- `contentKind` values, exactly: `deneme`, `soru_bankasi`, `konu_anlatimi`, `kamp`, `tek_video`.
- Marker layout thresholds: named → `list`; unnamed and `≤ 12` → `cards`; unnamed and `> 12` → `grid`.
- One breakpoint: `lg` (64rem). Below it = mobile two-step; `lg` and up = playlist.
- Colours only through bridge tokens (`bg-primary`, `text-muted-foreground`, `border-border`, `text-success`, `text-primary-strong`, `bg-muted`, `text-primary-foreground`). No hex, no raw palette class, no hand-written `dark:`.
- Targets: list rows, marker cards, marker grid cells, prev/next, back button ≥ 44×44 CSS px.
- Fraunces (`font-heading`) only on the book `h1` and the current-video `h2`. Everything else Nunito Sans; numbers `tabular-nums`.
- No all-caps eyebrows, no middle-dot meta strings, no `→` appended to button text.
- Copy in `messages/tr.json` `BookDetail` (Turkish, "sen", Title Case for buttons/headings, sentence case for body), EN twin in `messages/en.json`.
- API: `pnpm typecheck && pnpm lint && pnpm test:unit` per task; full `pnpm test:e2e` before pushing (a new migration breaks suites that never mention it).
- Web: `pnpm typecheck && pnpm lint && pnpm test` per task; `pnpm build` (stop `cografya-web-dev` first, API must be on :3001) and `pnpm sweep:overflow -- --filter=/kitaplar` at the end.

## Review Focus

1. **Arriving on a shared link `#video-20-etiket-3` on a phone** — expect step 2 open on video 20, marker 3 current, no player loaded, page not scrolled past the workbench. Pinned by `stepForHash` tests (Task 7) and the Playwright check in Task 12.
2. **Phone back gesture after picking three videos in a row** — expect it to return through the list step, never leave the page on the first press. Pinned by `bench-history` tests (Task 7) plus the manual Playwright step in Task 12.
3. **A 64-marker kamp video at 320 px** — expect a dense grid of ≥ 44 px cells scrolling inside the strip, no horizontal page scroll. Pinned by `markerLayout` tests (Task 5) and `sweep:overflow` on the local sample book (Task 12).
4. **Signed-out reader** — expect no status icons, no resume card, no "izlendi" count, and İzle still opening the login modal. Pinned by the `rowStatuses([])` test (Task 6) and the existing `video-progress.structure.test.ts` gate tests, which must stay green (Task 10).
5. **Auto-next at the last video, or when the next video is not playable** — expect nothing to load. Pinned by the `nextPlayable` test (Task 5).

---

## Part A — `cografya_api`

### Task 1: `content_kind` + video group columns (migration, entities, seed)

**Files:**

- Modify: `cografya_api/src/book/book.types.ts`
- Create: `cografya_api/src/database/migrations/1790467200000-AddBookContentKindAndVideoGroup.ts`
- Modify: `cografya_api/src/database/data-source-options.ts` (import + array entry after `AddAccountTypesAndAudienceFields1790380800000`)
- Modify: `cografya_api/src/book/entities/book.entity.ts`, `cografya_api/src/book/entities/book-video.entity.ts`
- Modify: `cografya_api/src/database/seeds/books.seed-data.ts`, `cografya_api/src/database/seeds/seed-books.ts`
- Modify: every fixture that builds a `Book` (`grep -rn "examTrack:" test src --include=*.ts`): `test/video-progress.e2e-spec.ts`, `test/book-seed.e2e-spec.ts`, `test/book-read.e2e-spec.ts`, `src/database/seeds/book-seed-invariants.spec.ts`
- Modify: `test/province.e2e-spec.ts`, `test/country.e2e-spec.ts` (ordered migration lists)

**Interfaces:**

- Produces: `enum BookContentKind { Deneme = 'deneme', SoruBankasi = 'soru_bankasi', KonuAnlatimi = 'konu_anlatimi', Kamp = 'kamp', TekVideo = 'tek_video' }` in `book.types.ts`; `Book.contentKind: BookContentKind`; `BookVideo.groupTitleTr: string | null`; `BookVideo.groupTitleEn: string | null`; `BookSeed.contentKind: BookContentKind`.

- [ ] **Step 1: Branch**

```bash
cd /home/sertturk16/cografya_v4/cografya_api && git fetch -q origin && git checkout -b feature/t128-book-content-kind origin/dev
```

- [ ] **Step 2: Add the enum** (append to `src/book/book.types.ts`, after `ExamTrack`)

```ts
/**
 * How a book's videos are organised — drives the reader-facing nouns on the book page
 * ("30 deneme", "Önceki test") and whether video titles are composed or authored.
 * Closed set: adding a member is a breaking contract change, same as {@link ExamTrack}.
 */
export enum BookContentKind {
  Deneme = "deneme",
  SoruBankasi = "soru_bankasi",
  KonuAnlatimi = "konu_anlatimi",
  Kamp = "kamp",
  TekVideo = "tek_video",
}
```

- [ ] **Step 3: Write the migration** (`src/database/migrations/1790467200000-AddBookContentKindAndVideoGroup.ts`)

```ts
import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * T-128: the book page serves five book kinds from one model.
 *
 *  1. `books.content_kind` — NOT NULL, closed set by CHECK. The existing row is a deneme book;
 *     the temporary DEFAULT fills it and is dropped so a new book must state its kind.
 *  2. `book_videos.group_title_tr/en` — nullable group heading ("1. Ünite", "1. GÜN"). NULL
 *     means an untitled group; a deneme book has none.
 *
 * Hand-written: a CHECK with a chosen name reads better than a generated one.
 * `down()` drops only what `up()` added; it destroys the kind and group titles by design.
 */
export class AddBookContentKindAndVideoGroup1790467200000 implements MigrationInterface {
  name = "AddBookContentKindAndVideoGroup1790467200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "books" ADD "content_kind" character varying(16) NOT NULL DEFAULT 'deneme'`,
    );
    await queryRunner.query(`ALTER TABLE "books" ALTER COLUMN "content_kind" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "books" ADD CONSTRAINT "CHK_books_content_kind" CHECK ("content_kind" IN ('deneme', 'soru_bankasi', 'konu_anlatimi', 'kamp', 'tek_video'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_videos" ADD "group_title_tr" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_videos" ADD "group_title_en" character varying(120)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "book_videos" DROP COLUMN "group_title_en"`);
    await queryRunner.query(`ALTER TABLE "book_videos" DROP COLUMN "group_title_tr"`);
    await queryRunner.query(`ALTER TABLE "books" DROP CONSTRAINT "CHK_books_content_kind"`);
    await queryRunner.query(`ALTER TABLE "books" DROP COLUMN "content_kind"`);
  }
}
```

Register it: in `data-source-options.ts` add
`import { AddBookContentKindAndVideoGroup1790467200000 } from './migrations/1790467200000-AddBookContentKindAndVideoGroup';`
beside the other imports and `AddBookContentKindAndVideoGroup1790467200000,` after `AddAccountTypesAndAudienceFields1790380800000,` in the `migrations` array. In `test/province.e2e-spec.ts` and `test/country.e2e-spec.ts` add `'AddBookContentKindAndVideoGroup1790467200000',` after `'AddAccountTypesAndAudienceFields1790380800000',`.

- [ ] **Step 4: Entity columns**

In `book.entity.ts`, after the `examTrack` column (import `BookContentKind` from `../book.types`):

```ts
  /** Which kind of book this is. Closed set — see {@link BookContentKind}. */
  @Column({ name: 'content_kind', type: 'varchar', length: 16 })
  contentKind!: BookContentKind;
```

In `book-video.entity.ts`, after `titleEn`:

```ts
  /**
   * The group heading this video sits under on the book page ("1. Ünite · Doğal Sistemler",
   * "1. GÜN"). Consecutive videos with the same value form one group. NULL for a deneme book.
   */
  @Column({ name: 'group_title_tr', type: 'varchar', length: 120, nullable: true })
  groupTitleTr!: string | null;

  /** EN counterpart of {@link groupTitleTr}; null on the same EN-twin rule as {@link titleEn}. */
  @Column({ name: 'group_title_en', type: 'varchar', length: 120, nullable: true })
  groupTitleEn!: string | null;
```

- [ ] **Step 5: Seed** — in `books.seed-data.ts` add `readonly contentKind: BookContentKind;` to `BookSeed` after `examTrack`, and `contentKind: BookContentKind.Deneme,` after `examTrack: ExamTrack.Ayt,` in the row. In `seed-books.ts` add to `BOOK_FIELD_MATCHERS`: `contentKind: (row, seed) => row.contentKind === seed.contentKind,` and to `toEntityShape`: `contentKind: seed.contentKind,` (both after `examTrack`). The mapped types make an omission a compile error.

- [ ] **Step 6: Fixtures** — run `pnpm typecheck`; for every error on a `Book` literal missing `contentKind`, add `contentKind: BookContentKind.Deneme,` next to its `examTrack`. Where a fixture saves through `getRepository(Book).save({...})` without a typed literal (typecheck silent), grep `examTrack:` in `test/` and add the same line; without it the INSERT fails the NOT NULL.

- [ ] **Step 7: Verify migration SQL runs**

```bash
docker compose up -d && pnpm build && DATABASE_URL=postgres://… pnpm migration:run
```

Use the `DATABASE_URL` from the local `.env` (port 5433). Expected: `AddBookContentKindAndVideoGroup1790467200000 has been executed successfully.` Then `psql … -c "select slug_tr, content_kind from books"` → the one book, `deneme`.

- [ ] **Step 8: Gates and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test:unit
git add -A && git commit -m "feat(book): content kind and video group columns (T-128)"
```

### Task 2: Publish `contentKind` and `groupTitleTr/En`

**Files:**

- Modify: `src/book/dto/book-list-item.dto.ts`, `src/book/dto/book-video.dto.ts`, `src/book/book.service.ts:222-232` and `:339-348`
- Modify: `src/book/book.contract.spec.ts` (`PUBLISHED_FIELDS`, `PUBLISHED_NULLABLE`)
- Modify: `test/book-read.e2e-spec.ts`
- Regenerate: `openapi/openapi.json`

**Interfaces:**

- Consumes: Task 1 columns.
- Produces: `BookListItemDto.contentKind` (so `BookDetailDto` inherits it); `BookVideoDto.groupTitleTr: string | null`, `BookVideoDto.groupTitleEn: string | null`.

- [ ] **Step 1: Failing contract test** — in `book.contract.spec.ts` add `'contentKind'` after `'examTrack'` in both `BookListItemDto` and `BookDetailDto` lists, change `BookVideoDto` to `['bookVideoId', 'orderNo', 'titleTr', 'titleEn', 'groupTitleTr', 'groupTitleEn', 'tags', 'youtube']`, and `PUBLISHED_NULLABLE.BookVideoDto` to `['titleTr', 'titleEn', 'groupTitleTr', 'groupTitleEn', 'youtube']`. Add:

```ts
it("publishes contentKind as the closed five-member enum", () => {
  const property = schemaOf("BookListItemDto").properties?.contentKind as
    { enum?: string[] } | undefined;
  expect(property?.enum).toEqual(["deneme", "soru_bankasi", "konu_anlatimi", "kamp", "tek_video"]);
});
```

Run: `pnpm test:unit src/book/book.contract.spec.ts` → FAIL (fields missing).

- [ ] **Step 2: DTOs** — `book-list-item.dto.ts`, after `examTrack`:

```ts
  @ApiProperty({
    enum: BookContentKind,
    enumName: 'BookContentKind',
    example: BookContentKind.Deneme,
    description:
      'How the book organises its videos — drives the reader-facing nouns (deneme, test, ders, ' +
      'fasikül, video). A closed set: adding a member is a breaking contract change.',
  })
  contentKind!: BookContentKind;
```

`book-video.dto.ts`, after `titleEn`:

```ts
  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'Group heading this video sits under ("1. Ünite · Doğal Sistemler", "1. GÜN"). Consecutive ' +
      'videos sharing a value form one group; null is an untitled group. Null for a deneme book.',
  })
  groupTitleTr!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'EN counterpart of groupTitleTr; null when there is no counterpart.',
  })
  groupTitleEn!: string | null;
```

- [ ] **Step 3: Service mapping** — in `book.service.ts` `videoDtos` add `groupTitleTr: video.groupTitleTr, groupTitleEn: video.groupTitleEn,` after `titleEn`; in `toListItem` add `contentKind: row.contentKind,` after `examTrack`.

- [ ] **Step 4: Regenerate and rerun**

```bash
pnpm openapi:generate && pnpm test:unit src/book
```

Expected: PASS. (EACCES on `dist/`: `docker exec -u 0 cografya-api-dev sh -lc 'chown -R 1000:1000 /app/dist'`.)

- [ ] **Step 5: e2e assertion** — in `test/book-read.e2e-spec.ts`, in the detail test that asserts the seeded book body, add `expect(body.contentKind).toBe('deneme');` and `expect(body.videos[0]).toMatchObject({ groupTitleTr: null, groupTitleEn: null });`. Run `pnpm test:e2e test/book-read.e2e-spec.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
pnpm typecheck && pnpm lint
git add -A && git commit -m "feat(book): publish contentKind and video group titles (T-128)"
```

### Task 3: Per-video rows on the book progress response

**Files:**

- Modify: `src/video-progress/dto/book-progress.dto.ts`
- Modify: `src/video-progress/video-progress.service.ts:140-212`
- Modify: `test/video-progress.e2e-spec.ts`
- Regenerate: `openapi/openapi.json`

**Interfaces:**

- Produces: `BookProgressVideoDto { bookVideoId: string; lastPositionSeconds: number; watched: boolean }`, `BookProgressDto.videos: BookProgressVideoDto[]` (the caller's rows for this book, ordered by the video's `orderNo`; empty when none).

- [ ] **Step 1: Failing e2e** — in `test/video-progress.e2e-spec.ts`:
  - the two `toEqual` bodies for a caller with no progress (`userC`, `userF`) gain `videos: []`;
  - in `'watchedCount counts only watched:true rows…'` add after the counts:

```ts
const rows = (response.body as { videos: unknown[] }).videos;
expect(rows).toEqual([
  { bookVideoId: first.id, lastPositionSeconds: 10, watched: true },
  { bookVideoId: second.id, lastPositionSeconds: 5, watched: false },
]);
```

- in the cross-book isolation case add `expect((body as { videos: { bookVideoId: string }[] }).videos.map((v) => v.bookVideoId)).not.toContain(otherBookVideo.id);`

Run `pnpm test:e2e test/video-progress.e2e-spec.ts` → FAIL (`videos` missing).

- [ ] **Step 2: DTO** — add above `BookProgressDto`:

```ts
export class BookProgressVideoDto {
  @ApiProperty({ format: "uuid", description: "book_videos.id this progress row belongs to." })
  bookVideoId!: string;

  @ApiProperty({
    type: Number,
    minimum: 0,
    example: 245,
    description: "Last playback position, seconds.",
  })
  lastPositionSeconds!: number;

  @ApiProperty({
    type: Boolean,
    description: "The caller's declared watched signal on this video.",
  })
  watched!: boolean;
}
```

and on `BookProgressDto`, after `resume`:

```ts
  @ApiProperty({
    type: [BookProgressVideoDto],
    description:
      "The caller's progress rows among this book's videos, ordered by the video's orderNo — one " +
      'per started video; empty when the caller has none. Feeds per-video status on the book page.',
  })
  videos!: BookProgressVideoDto[];
```

- [ ] **Step 3: Service** — inside the transaction, after `resumeRow`:

```ts
const videoRows = await manager
  .getRepository(VideoProgress)
  .createQueryBuilder("progress")
  .innerJoin(BookVideo, "video", "video.id = progress.bookVideoId AND video.bookId = :bookId", {
    bookId: book.id,
  })
  .where("progress.userId = :userId", { userId })
  .select("progress.bookVideoId", "bookVideoId")
  .addSelect("progress.lastPositionSeconds", "lastPositionSeconds")
  .addSelect("progress.watched", "watched")
  .orderBy("video.orderNo", "ASC")
  .getRawMany<{ bookVideoId: string; lastPositionSeconds: number; watched: boolean }>();
```

and in the returned object `videos: videoRows.map((row) => ({ bookVideoId: row.bookVideoId, lastPositionSeconds: Number(row.lastPositionSeconds), watched: row.watched })),`.

- [ ] **Step 4: Regenerate, run, full e2e**

```bash
pnpm openapi:generate && pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:e2e
```

Expected: all green (report exact counts). The e2e lane is the gate for the new migration too.

- [ ] **Step 5: Commit, push, PR**

```bash
git add -A && git commit -m "feat(video-progress): per-video rows on the book progress response (T-128)"
git push -u origin feature/t128-book-content-kind
GH_TOKEN=… gh pr create --base dev --title "feat(book): content kind, video groups, per-video progress (T-128)" --body "…"
```

PR body: what changed, migration SQL summary, "web counterpart: cografya_web feature/t128-book-workbench", and end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. `GH_TOKEN` per memory note `gh-pr-account`.

---

## Part B — `cografya_web`

### Task 4: Contract sync

**Files:**

- Replace: `openapi/openapi.json` (copy), regenerate `lib/api/schema.ts`
- Modify: `lib/api/types.ts` (add `BookContentKind`, `BookProgressVideo` aliases)
- Modify: `lib/video-progress/transport.server.ts:75-91` (zod), `lib/video-progress/client.ts:158-231` (parser)
- Test: `lib/video-progress/client.test.ts`

**Interfaces:**

- Produces: `type BookContentKind = BookDetail["contentKind"]`; `BookProgressValue.videos: readonly BookProgressVideoValue[]` where `BookProgressVideoValue = { bookVideoId: string; lastPositionSeconds: number; watched: boolean }`.

- [ ] **Step 1: Copy + codegen**

```bash
cd /home/sertturk16/cografya_v4/cografya_web && git checkout feature/t128-book-workbench
cp ../cografya_api/openapi/openapi.json openapi/openapi.json && pnpm codegen
```

- [ ] **Step 2: Aliases** — in `lib/api/types.ts` book section:

```ts
/** The closed set of book kinds (`deneme` … `tek_video`) — see `lib/book/workbench-model.ts`. */
export type BookContentKind = BookDetail["contentKind"];
export type BookProgressVideo = components["schemas"]["BookProgressVideoDto"];
```

- [ ] **Step 3: Failing parser test** — in `client.test.ts`, extend the existing happy-path `fetchBookProgress` fixture body with `videos: [{ bookVideoId: "v1", lastPositionSeconds: 30, watched: false }]` and assert `result?.videos` equals it; add a case where `videos` is missing → `result?.videos` is `[]`, and one where an entry is malformed (`watched: "yes"`) → that entry is dropped. Run `pnpm vitest run lib/video-progress/client.test.ts` → FAIL.

- [ ] **Step 4: Implement** — zod in `transport.server.ts`:

```ts
export const bookProgressVideoSchema = z.object({
  bookVideoId: z.string(),
  lastPositionSeconds: z.number(),
  watched: z.boolean(),
});
```

and `videos: z.array(bookProgressVideoSchema),` in `bookProgressSchema` (the contract-agreement tuple below it now compiles again). In `client.ts` add `BookProgressVideoValue`, the `videos` field on `BookProgressValue`, and in `parseBookProgressBody`:

```ts
const rawVideos = (progress as { videos?: unknown }).videos;
const videos: BookProgressVideoValue[] = Array.isArray(rawVideos)
  ? rawVideos.flatMap((entry: unknown) => {
      if (typeof entry !== "object" || entry === null) return [];
      const e = entry as {
        bookVideoId?: unknown;
        lastPositionSeconds?: unknown;
        watched?: unknown;
      };
      return typeof e.bookVideoId === "string" &&
        typeof e.lastPositionSeconds === "number" &&
        typeof e.watched === "boolean"
        ? [
            {
              bookVideoId: e.bookVideoId,
              lastPositionSeconds: e.lastPositionSeconds,
              watched: e.watched,
            },
          ]
        : [];
    })
  : [];
```

returning `videos` in the object.

- [ ] **Step 5: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm codegen:check
git add -A && git commit -m "feat(book): sync contract for content kind, groups and per-video progress (T-128)"
```

### Task 5: `lib/book/workbench-model.ts`

**Files:**

- Create: `lib/book/workbench-model.ts`, `lib/book/workbench-model.test.ts`

**Interfaces:**

- Produces:

```ts
export type MarkerLayout = "cards" | "grid" | "list";
export const MARKER_CARD_LIMIT = 12;
export function isNamed(tags: readonly { nameTr: string | null }[]): boolean;
export function markerLayout(tags: readonly { nameTr: string | null }[]): MarkerLayout;
export interface VideoGroup<T> {
  readonly title: string | null;
  readonly items: readonly T[];
}
export function groupVideos<T extends { readonly groupTitleTr: string | null }>(
  videos: readonly T[],
): VideoGroup<T>[];
export function hasGroupHeadings<T>(groups: readonly VideoGroup<T>[]): boolean;
export function neighbours(
  orderNos: readonly number[],
  current: number,
): { prev: number | null; next: number | null };
export function nextPlayable<T extends { readonly orderNo: number; readonly playable: boolean }>(
  videos: readonly T[],
  current: number,
): T | null;
```

- [ ] **Step 1: Failing tests** (`lib/book/workbench-model.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import {
  groupVideos,
  hasGroupHeadings,
  isNamed,
  markerLayout,
  neighbours,
  nextPlayable,
} from "./workbench-model";

const q = (n: number) => Array.from({ length: n }, () => ({ nameTr: null }));

describe("markerLayout", () => {
  it("uses cards up to twelve unnamed markers", () => {
    expect(markerLayout(q(6))).toBe("cards");
    expect(markerLayout(q(12))).toBe("cards");
  });
  it("switches to the dense grid at thirteen", () => {
    expect(markerLayout(q(13))).toBe("grid");
    expect(markerLayout(q(64))).toBe("grid");
  });
  it("lists named markers whatever their count", () => {
    expect(markerLayout([{ nameTr: "Giriş" }, { nameTr: null }])).toBe("list");
    expect(isNamed([{ nameTr: "Tahıllar" }])).toBe(true);
    expect(isNamed(q(3))).toBe(false);
  });
});

describe("groupVideos", () => {
  const v = (orderNo: number, groupTitleTr: string | null) => ({ orderNo, groupTitleTr });
  it("keeps a deneme book as one untitled group", () => {
    const groups = groupVideos([v(1, null), v(2, null), v(3, null)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBeNull();
    expect(hasGroupHeadings(groups)).toBe(false);
  });
  it("splits consecutive runs of the same title", () => {
    const groups = groupVideos([v(1, "1. GÜN"), v(2, "2. GÜN"), v(3, "2. GÜN")]);
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([
      ["1. GÜN", 1],
      ["2. GÜN", 2],
    ]);
    expect(hasGroupHeadings(groups)).toBe(true);
  });
  it("does not merge a title that reappears after another group", () => {
    expect(groupVideos([v(1, "A"), v(2, "B"), v(3, "A")]).map((g) => g.title)).toEqual([
      "A",
      "B",
      "A",
    ]);
  });
  it("returns no groups for no videos", () => {
    expect(groupVideos([])).toEqual([]);
  });
});

describe("neighbours", () => {
  const nos = [1, 2, 3, 15, 16];
  it("walks the book order, not the numbers", () => {
    expect(neighbours(nos, 3)).toEqual({ prev: 2, next: 15 });
  });
  it("stops at both ends", () => {
    expect(neighbours(nos, 1)).toEqual({ prev: null, next: 2 });
    expect(neighbours(nos, 16)).toEqual({ prev: 15, next: null });
  });
  it("answers nothing for an unknown current", () => {
    expect(neighbours(nos, 99)).toEqual({ prev: null, next: null });
  });
});

describe("nextPlayable", () => {
  const vids = [
    { orderNo: 1, playable: true },
    { orderNo: 2, playable: false },
    { orderNo: 3, playable: true },
  ];
  it("returns the next video when it can play in the page", () => {
    expect(nextPlayable(vids, 2)?.orderNo).toBe(3);
  });
  it("returns null when the next video cannot play in the page", () => {
    expect(nextPlayable(vids, 1)).toBeNull();
  });
  it("returns null at the last video", () => {
    expect(nextPlayable(vids, 3)).toBeNull();
  });
});
```

Run: `pnpm vitest run lib/book/workbench-model.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement** (`lib/book/workbench-model.ts`)

```ts
/**
 * The book page's structural rules (T-128 spec §2): Book → Group → Video → Marker.
 *
 * Pure and framework-free so the page (server) and the bench island (client) read one answer.
 * Labels are NOT composed here — they need the translator; see `video-identity.ts`.
 */

export type MarkerLayout = "cards" | "grid" | "list";

/** Up to this many unnamed markers render as cards with their time; more become a dense grid. */
export const MARKER_CARD_LIMIT = 12;

/** A video is named when any marker carries its own name (konu anlatımı, tek video). */
export function isNamed(tags: readonly { readonly nameTr: string | null }[]): boolean {
  return tags.some((tag) => tag.nameTr !== null);
}

export function markerLayout(tags: readonly { readonly nameTr: string | null }[]): MarkerLayout {
  if (isNamed(tags)) return "list";
  return tags.length <= MARKER_CARD_LIMIT ? "cards" : "grid";
}

export interface VideoGroup<T> {
  readonly title: string | null;
  readonly items: readonly T[];
}

/** Consecutive videos sharing a `groupTitleTr` form one group, in the order given. */
export function groupVideos<T extends { readonly groupTitleTr: string | null }>(
  videos: readonly T[],
): VideoGroup<T>[] {
  const groups: { title: string | null; items: T[] }[] = [];
  for (const video of videos) {
    const last = groups.at(-1);
    if (last !== undefined && last.title === video.groupTitleTr) last.items.push(video);
    else groups.push({ title: video.groupTitleTr, items: [video] });
  }
  return groups;
}

/** Headings render unless the whole book is one untitled group. */
export function hasGroupHeadings<T>(groups: readonly VideoGroup<T>[]): boolean {
  return groups.some((group) => group.title !== null);
}

export function neighbours(
  orderNos: readonly number[],
  current: number,
): { prev: number | null; next: number | null } {
  const index = orderNos.indexOf(current);
  if (index === -1) return { prev: null, next: null };
  return { prev: orderNos[index - 1] ?? null, next: orderNos[index + 1] ?? null };
}

/** The video auto-next may load: the next one in book order, only if it plays in the page. */
export function nextPlayable<T extends { readonly orderNo: number; readonly playable: boolean }>(
  videos: readonly T[],
  current: number,
): T | null {
  const index = videos.findIndex((video) => video.orderNo === current);
  const next = index === -1 ? undefined : videos[index + 1];
  return next !== undefined && next.playable ? next : null;
}
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm vitest run lib/book/workbench-model.test.ts && pnpm typecheck && pnpm lint
git add lib/book/workbench-model.ts lib/book/workbench-model.test.ts
git commit -m "feat(book): workbench model for groups, marker layout and neighbours (T-128)"
```

### Task 6: `book-status.ts` and `current-marker.ts`

**Files:**

- Create: `lib/book/book-status.ts`, `lib/book/book-status.test.ts`, `lib/book/current-marker.ts`, `lib/book/current-marker.test.ts`

**Interfaces:**

- Produces:

```ts
export type RowStatus =
  { readonly kind: "done" } | { readonly kind: "part"; readonly fraction: number };
export function rowStatuses(
  rows: readonly {
    readonly bookVideoId: string;
    readonly lastPositionSeconds: number;
    readonly watched: boolean;
  }[],
  durations: ReadonlyMap<string, number | null>,
): Map<string, RowStatus>;
export function currentMarkerIndex(seconds: readonly number[], at: number): number;
```

- [ ] **Step 1: Failing tests**

`lib/book/book-status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rowStatuses } from "./book-status";

describe("rowStatuses", () => {
  const durations = new Map<string, number | null>([
    ["a", 400],
    ["b", 400],
    ["c", null],
  ]);
  it("marks a watched video done whatever its position", () => {
    expect(
      rowStatuses([{ bookVideoId: "a", lastPositionSeconds: 0, watched: true }], durations).get(
        "a",
      ),
    ).toEqual({
      kind: "done",
    });
  });
  it("fills the ring by position over duration", () => {
    expect(
      rowStatuses([{ bookVideoId: "b", lastPositionSeconds: 100, watched: false }], durations).get(
        "b",
      ),
    ).toEqual({
      kind: "part",
      fraction: 0.25,
    });
  });
  it("uses half a ring when the duration is unknown", () => {
    expect(
      rowStatuses([{ bookVideoId: "c", lastPositionSeconds: 90, watched: false }], durations).get(
        "c",
      ),
    ).toEqual({
      kind: "part",
      fraction: 0.5,
    });
  });
  it("keeps a started ring visible and never full", () => {
    const s = rowStatuses(
      [
        { bookVideoId: "a", lastPositionSeconds: 1, watched: false },
        { bookVideoId: "b", lastPositionSeconds: 399, watched: false },
      ],
      durations,
    );
    expect(s.get("a")).toEqual({ kind: "part", fraction: 0.05 });
    expect(s.get("b")).toEqual({ kind: "part", fraction: 0.95 });
  });
  it("answers nothing for a signed-out reader (no rows)", () => {
    expect(rowStatuses([], durations).size).toBe(0);
  });
});
```

`lib/book/current-marker.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { currentMarkerIndex } from "./current-marker";

describe("currentMarkerIndex", () => {
  const seconds = [0, 86, 141, 229];
  it("is -1 before the first marker", () => {
    expect(currentMarkerIndex([10, 20], 5)).toBe(-1);
  });
  it("is the marker whose segment contains the time", () => {
    expect(currentMarkerIndex(seconds, 100)).toBe(1);
  });
  it("switches exactly on a boundary", () => {
    expect(currentMarkerIndex(seconds, 141)).toBe(2);
  });
  it("stays on the last marker past its start", () => {
    expect(currentMarkerIndex(seconds, 9999)).toBe(3);
  });
  it("is -1 for a video with no markers", () => {
    expect(currentMarkerIndex([], 50)).toBe(-1);
  });
});
```

Run both → FAIL.

- [ ] **Step 2: Implement**

`lib/book/book-status.ts`:

```ts
/**
 * Per-row watch status for the book page's list (T-128 spec §4.6). Signed-out readers and
 * unstarted videos have no entry: the row shows its reserved, empty icon slot.
 */
export type RowStatus =
  { readonly kind: "done" } | { readonly kind: "part"; readonly fraction: number };

const MIN_FRACTION = 0.05;
const MAX_FRACTION = 0.95;
const UNKNOWN_DURATION_FRACTION = 0.5;

export function rowStatuses(
  rows: readonly {
    readonly bookVideoId: string;
    readonly lastPositionSeconds: number;
    readonly watched: boolean;
  }[],
  durations: ReadonlyMap<string, number | null>,
): Map<string, RowStatus> {
  const result = new Map<string, RowStatus>();
  for (const row of rows) {
    if (row.watched) {
      result.set(row.bookVideoId, { kind: "done" });
      continue;
    }
    const duration = durations.get(row.bookVideoId) ?? null;
    const raw =
      duration === null || duration <= 0
        ? UNKNOWN_DURATION_FRACTION
        : row.lastPositionSeconds / duration;
    const fraction = Math.min(MAX_FRACTION, Math.max(MIN_FRACTION, raw));
    result.set(row.bookVideoId, { kind: "part", fraction });
  }
  return result;
}
```

`lib/book/current-marker.ts`:

```ts
/**
 * Which marker the player is inside: the last one whose start is at or before `at`, or -1
 * before the first. `seconds` is ascending (the api orders etiketler by orderNo and startSecond).
 */
export function currentMarkerIndex(seconds: readonly number[], at: number): number {
  let index = -1;
  for (let i = 0; i < seconds.length; i += 1) {
    const start = seconds[i];
    if (start === undefined || start > at) break;
    index = i;
  }
  return index;
}
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm vitest run lib/book/book-status.test.ts lib/book/current-marker.test.ts && pnpm typecheck && pnpm lint
git add lib/book/book-status.* lib/book/current-marker.*
git commit -m "feat(book): row status and current-marker rules (T-128)"
```

### Task 7: `bench-history.ts` and the auto-next preference

**Files:**

- Create: `lib/book/bench-history.ts`, `lib/book/bench-history.test.ts`, `lib/book/auto-next-preference.ts`, `lib/book/auto-next-preference.test.ts`

**Interfaces:**

- Produces:

```ts
export type BenchStep = "pick" | "watch";
export function stepForHash(
  hash: string,
  orderNos: readonly number[],
): { step: BenchStep; orderNo: number | null };
export const BENCH_HISTORY_MARK = "t128-bench";
export function isBenchEntry(state: unknown): boolean;
export const AUTO_NEXT_KEY = "cg.book.autoNext";
export function readAutoNext(storage: Pick<Storage, "getItem"> | null): boolean;
export function writeAutoNext(storage: Pick<Storage, "setItem"> | null, value: boolean): void;
```

- [ ] **Step 1: Failing tests**

`lib/book/bench-history.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BENCH_HISTORY_MARK, isBenchEntry, stepForHash } from "./bench-history";

const nos = [1, 2, 20];

describe("stepForHash", () => {
  it("opens the watch step on a video fragment", () => {
    expect(stepForHash("#video-20", nos)).toEqual({ step: "watch", orderNo: 20 });
  });
  it("opens the watch step on a marker fragment of that video", () => {
    expect(stepForHash("#video-20-etiket-3", nos)).toEqual({ step: "watch", orderNo: 20 });
    expect(stepForHash("#video-2-tahillar", nos)).toEqual({ step: "watch", orderNo: 2 });
  });
  it("stays on the list for no hash, an unknown video, or a foreign fragment", () => {
    expect(stepForHash("", nos)).toEqual({ step: "pick", orderNo: null });
    expect(stepForHash("#video-99", nos)).toEqual({ step: "pick", orderNo: null });
    expect(stepForHash("#kitap-bilgisi", nos)).toEqual({ step: "pick", orderNo: null });
  });
  it("does not read video-2 out of video-20", () => {
    expect(stepForHash("#video-20", [2])).toEqual({ step: "pick", orderNo: null });
  });
});

describe("isBenchEntry", () => {
  it("recognises only entries the bench pushed", () => {
    expect(isBenchEntry({ [BENCH_HISTORY_MARK]: true })).toBe(true);
    expect(isBenchEntry(null)).toBe(false);
    expect(isBenchEntry({ other: true })).toBe(false);
  });
});
```

`lib/book/auto-next-preference.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AUTO_NEXT_KEY, readAutoNext, writeAutoNext } from "./auto-next-preference";

describe("auto-next preference", () => {
  it("defaults to on", () => {
    expect(readAutoNext({ getItem: () => null })).toBe(true);
    expect(readAutoNext(null)).toBe(true);
  });
  it("reads a stored off", () => {
    expect(readAutoNext({ getItem: (k) => (k === AUTO_NEXT_KEY ? "0" : null) })).toBe(false);
  });
  it("is off when storage throws", () => {
    expect(
      readAutoNext({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toBe(false);
  });
  it("writes 1/0 and swallows a throwing storage", () => {
    const written: string[] = [];
    writeAutoNext({ setItem: (_k, v) => void written.push(v) }, false);
    expect(written).toEqual(["0"]);
    expect(() =>
      writeAutoNext(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        true,
      ),
    ).not.toThrow();
  });
});
```

Run both → FAIL.

- [ ] **Step 2: Implement**

`lib/book/bench-history.ts`:

```ts
/**
 * The mobile two-step's URL contract (T-128 spec §4.3). The hash IS the step: a video or marker
 * fragment of a video on this page means "watch that video"; anything else means "pick".
 * Selecting a video pushes an entry marked with {@link BENCH_HISTORY_MARK} so the back gesture
 * returns to the list, and the back button knows whether stepping back stays on this page.
 */
export type BenchStep = "pick" | "watch";

export const BENCH_HISTORY_MARK = "t128-bench";

const VIDEO_FRAGMENT = /^#video-(\d+)(?:-|$)/;

export function stepForHash(
  hash: string,
  orderNos: readonly number[],
): { step: BenchStep; orderNo: number | null } {
  const match = VIDEO_FRAGMENT.exec(hash);
  const orderNo = match?.[1] === undefined ? Number.NaN : Number.parseInt(match[1], 10);
  return orderNos.includes(orderNo) ? { step: "watch", orderNo } : { step: "pick", orderNo: null };
}

export function isBenchEntry(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as Record<string, unknown>)[BENCH_HISTORY_MARK] === true
  );
}
```

`lib/book/auto-next-preference.ts`:

```ts
/** Per-browser auto-next switch (T-128 spec §4.6). Default on; off when storage is unusable. */
export const AUTO_NEXT_KEY = "cg.book.autoNext";

export function readAutoNext(storage: Pick<Storage, "getItem"> | null): boolean {
  if (storage === null) return true;
  try {
    return storage.getItem(AUTO_NEXT_KEY) !== "0";
  } catch {
    return false;
  }
}

export function writeAutoNext(storage: Pick<Storage, "setItem"> | null, value: boolean): void {
  try {
    storage?.setItem(AUTO_NEXT_KEY, value ? "1" : "0");
  } catch {
    // Private mode or blocked storage: the switch still works for this page view.
  }
}
```

- [ ] **Step 3: Pass + commit**

```bash
pnpm vitest run lib/book/bench-history.test.ts lib/book/auto-next-preference.test.ts && pnpm typecheck && pnpm lint
git add lib/book/bench-history.* lib/book/auto-next-preference.*
git commit -m "feat(book): step-from-hash and auto-next preference rules (T-128)"
```

### Task 8: Kind-aware copy and `videoTitle`

**Files:**

- Modify: `lib/book/video-identity.ts` (`videoTitle` signature), its test `lib/book/video-identity.test.ts`
- Modify: `messages/tr.json`, `messages/en.json` (`BookDetail`)
- Modify: every `videoTitle(` caller (`grep -rn "videoTitle(" app components lib`)

**Interfaces:**

- Produces: `videoTitle(t, locale, video, kind: BookContentKind)`; messages listed below.

- [ ] **Step 1: Failing test** — in `video-identity.test.ts` change the fake translator to record values and assert `videoTitle(t, "tr", { orderNo: 4, titleTr: null, titleEn: null }, "soru_bankasi")` calls `t("videoFallbackHeading", { no: 4, kind: "soru_bankasi" })`, and that an authored `titleTr` still wins. Run → FAIL (arity/type).

- [ ] **Step 2: Implement** — in `video-identity.ts`:

```ts
type VideoTitleTranslator = (
  key: "videoFallbackHeading",
  values: { no: number; kind: BookContentKind },
) => string;

export function videoTitle(
  t: VideoTitleTranslator,
  locale: Locale,
  video: VideoIdentity & { readonly titleTr: string | null; readonly titleEn: string | null },
  kind: BookContentKind,
): string {
  const authored = locale === "en" ? video.titleEn : video.titleTr;
  if (authored !== null) return authored;
  return t("videoFallbackHeading", { no: video.orderNo, kind });
}
```

(import `type BookContentKind` from `@/lib/api/types`).

- [ ] **Step 3: Messages** — `messages/tr.json` `BookDetail`, replace/add these keys (keep all others):

```json
"videoFallbackHeading": "{kind, select, deneme {Deneme} soru_bankasi {Test} konu_anlatimi {Ders} kamp {Fasikül} other {Video}} {no}",
"itemsPlural": "{kind, select, deneme {Denemeler} soru_bankasi {Testler} konu_anlatimi {Dersler} kamp {Fasiküller} other {Videolar}}",
"bookSummary": "{count} {kind, select, deneme {deneme} soru_bankasi {test} konu_anlatimi {ders} kamp {fasikül} other {video}}, {markers, plural, other {# {named, select, yes {bölüm} other {soru çözümü}}}}",
"bookWatched": "{watched}/{count} izlendi",
"markerCount": "{count, plural, other {# {named, select, yes {bölüm} other {soru}}}}",
"bookInfo": "Kitap Bilgisi",
"backToList": "{kind, select, deneme {Denemeler} soru_bankasi {Testler} konu_anlatimi {Dersler} kamp {Fasiküller} other {Videolar}}",
"position": "{current} / {total}",
"prev": "Önceki",
"next": "Sonraki",
"prevAria": "Önceki: {label}",
"nextAria": "Sonraki: {label}",
"autoNext": "Otomatik Sonraki",
"resumeTitle": "Kaldığın Yerden Devam Et",
"resumeDetail": "{label}, {time}",
"statusDone": "izlendi",
"statusPart": "yarım kaldı",
"playerTitle": "{label} video çözümü",
"watchAria": "İzle — {label} video çözümü",
"watchAriaSignedOut": "İzle — {label} video çözümü, giriş gerekir",
"watchOnYoutubeAria": "YouTube'da izle — {label} video çözümü, yeni sekmede açılır",
"watchLoadingAria": "{label} video çözümü yükleniyor",
"onYoutube": "YouTube'da",
"listLabel": "{kind, select, deneme {Denemeler} soru_bankasi {Testler} konu_anlatimi {Dersler} kamp {Fasiküller} other {Videolar}} listesi",
"markersLabel": "{named, select, yes {Bölümler} other {Sorular}}"
```

Delete `jumpHeading` and `timelineLabel` (their UI is deleted in Task 10). `messages/en.json` gets the same keys with English values (`Mock exam {no}`/`Test {no}`/`Lesson {no}`/`Booklet {no}`/`Video {no}`, "Previous", "Next", "Autoplay next", "Continue where you left off", "watched", "in progress", "Book info", "on YouTube", "{watched}/{count} watched", "{label} video solution" …). Every `{no}` → `{label}` key change updates its caller to pass `label: videoTitle(t, locale, video, kind)`. `components/book/messages.test.ts` and `lib/book/messages.test.ts` discover consumers — run them and follow their failures.

- [ ] **Step 4: Callers** — update each `videoTitle(` call: the page passes `book.contentKind` (index rows and the JSON-LD `VideoObject.name`); `bench-stage.tsx` passes `"deneme"` for now, since its call disappears in Task 10 (the stage then reads the server-composed `video.label`). Callers of the `{no}` → `{label}` keys pass `label: videoTitle(...)`.

- [ ] **Step 5: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add -A && git commit -m "feat(book): kind-aware video labels and workbench copy (T-128)"
```

### Task 9: Player callbacks and frame sizing (`deneme-video.tsx`)

**Files:**

- Modify: `components/book/deneme-video.tsx:43` (`FRAME`), props, the player effect (`:374-440`)
- Modify: `components/book/deneme-video.src-invariant.test.ts`

**Interfaces:**

- Produces: `DenemeVideo` props `onPlaybackTime?: (second: number) => void` (called ~1×/s while PLAYING) and `onEnded?: () => void` (called on ENDED); callbacks read through refs, so the pinned `[isActive, active?.loadToken]` dependency array is unchanged.

- [ ] **Step 1: Failing structure test** — append to `deneme-video.src-invariant.test.ts` (it reads the source as text; follow its existing `source` helper):

```ts
describe("playback callbacks for the bench (T-128)", () => {
  it("reports ENDED through a ref, not a dependency", () => {
    expect(source).toMatch(/YT_PLAYER_STATE\.ENDED[\s\S]*onEndedRef\.current\?\.\(\)/);
  });
  it("polls the time only while playing and stops with the save interval", () => {
    expect(source).toMatch(/timePoll = setInterval\(/);
    expect(source).toMatch(/const stopTimePoll = \(\) =>/);
  });
  it("keeps the frame bound by the viewport height as well as the column width", () => {
    expect(source).toMatch(
      /max-w-\[min\(100%,calc\(\(100dvh-var\(--header-height\)-19rem\)\*16\/9\)\)\]/,
    );
  });
});
```

Run `pnpm vitest run components/book/deneme-video.src-invariant.test.ts` → FAIL.

- [ ] **Step 2: Implement**
  - `FRAME` becomes `"relative mx-auto aspect-video min-h-[200px] w-full max-w-[min(100%,calc((100dvh-var(--header-height)-19rem)*16/9))] bg-muted"`. 19rem is the height the workbench reserves beside the player on desktop (book bar, caption row, 8rem marker floor, gutters). The 560 px cap goes: the stage column now sets the width. Update the docblock above `FRAME` to say so.
  - Props: add `onPlaybackTime?: (second: number) => void; onEnded?: () => void;` with a one-line docblock each, and refs:

```ts
const onPlaybackTimeRef = useRef(onPlaybackTime);
const onEndedRef = useRef(onEnded);
useEffect(() => {
  onPlaybackTimeRef.current = onPlaybackTime;
  onEndedRef.current = onEnded;
});
```

- In the player effect, beside `saveInterval`:

```ts
let timePoll: ReturnType<typeof setInterval> | null = null;
const stopTimePoll = () => {
  if (timePoll !== null) {
    clearInterval(timePoll);
    timePoll = null;
  }
};
```

    in `onStateChange`, PLAYING branch before `return`:

```ts
stopTimePoll();
timePoll = setInterval(() => {
  const player = playerRef.current;
  if (player !== null) onPlaybackTimeRef.current?.(player.getCurrentTime());
}, 1000);
```

    PAUSED/ENDED branch: `stopTimePoll();` and then `if (event.data === YT_PLAYER_STATE.ENDED) onEndedRef.current?.();`. Cleanup: `stopTimePoll();` beside `stopPeriodicSave();`.

- [ ] **Step 3: Pass + commit**

```bash
pnpm vitest run components/book && pnpm typecheck && pnpm lint
git add components/book/deneme-video.tsx components/book/deneme-video.src-invariant.test.ts
git commit -m "feat(book): playback time and ended callbacks on the player (T-128)"
```

(`bench.structure.test.ts` may now fail on the removed 560 px cap; it is rewritten in Task 11 — note the failure in the commit body if so.)

### Task 10: The workbench — server markup, stage, island

**Files:**

- Rewrite: `app/[locale]/(site)/kitaplar/[slug]/page.tsx`
- Create: `components/book/book-bar.tsx`, `components/book/workbench-list.tsx` (server), `components/book/marker-panels.tsx` (server), `components/book/status-icon.tsx` (server)
- Rewrite: `components/book/video-bench.tsx`, `components/book/bench-stage.tsx`
- Delete: `components/book/bench-timeline.tsx`, `components/book/book-detail-floors.test.ts`

**Interfaces:**

- Consumes: Tasks 5–9.
- Produces:
  - `BenchVideo` gains `groupTitleTr: string | null`, `label: string` (server-composed via `videoTitle`), `markerCount: number`, `durationSeconds: number | null`.
  - `VideoBench` props: `{ videos: readonly BenchVideo[]; kind: BookContentKind; bookSlug: string; barProps: Omit<BookBarProps, "watchedText">; list: ReactNode; markers: ReactNode }` (a function cannot cross the server→client boundary, so the bar comes as data and `VideoBench` renders `BookBar` with the live watched count).
  - DOM contract the island relies on (server side):
    - list row: `<a id="video-{n}" href="#video-{n}" data-video-row data-deneme="{n}" data-video-id="{bookVideoId}" class="group/row …">` containing `<StatusIcon />`;
    - group heading: `<span data-group-progress data-group-ids="{id1 id2 …}">` (empty on the server);
    - marker panel: `<div data-marker-panel data-deneme="{n}" hidden={n !== default}>` holding `<a id="{tagFragment}" href="#{tagFragment}" data-second="{s}" data-marker-index="{i}">`;
    - current heading: `<h2 id="bench-current-heading" tabIndex={-1}>` in `BenchStage`.

- [ ] **Step 1: Delete what the marker strip replaces**

```bash
git rm components/book/bench-timeline.tsx components/book/book-detail-floors.test.ts
```

- [ ] **Step 2: `components/book/status-icon.tsx`** (server component, no hooks)

```tsx
import { Check } from "lucide-react";

/**
 * The list row's watch status, drawn empty on the server and switched by the bench island
 * through the row's `data-status` ("done" | "part") and `--ring` (0–1) — no client render, so
 * the slot is reserved from first paint and progress arriving shifts nothing (spec §4.5).
 * Circumference of r=8 is 50.27.
 */
export function StatusIcon({ doneLabel, partLabel }: { doneLabel: string; partLabel: string }) {
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center">
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="invisible size-5 -rotate-90 group-data-[status=part]/row:visible"
      >
        <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" className="stroke-border" />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-primary [stroke-dasharray:calc(var(--ring,0)*50.27)_50.27]"
        />
      </svg>
      <Check
        aria-hidden="true"
        className="absolute hidden size-5 text-success group-data-[status=done]/row:block"
      />
      <span className="sr-only hidden group-data-[status=done]/row:inline">{doneLabel}</span>
      <span className="sr-only hidden group-data-[status=part]/row:inline">{partLabel}</span>
    </span>
  );
}
```

- [ ] **Step 3: `components/book/workbench-list.tsx`** (server)

```tsx
import { formatDuration } from "@/lib/book/duration";
import { groupVideos, hasGroupHeadings } from "@/lib/book/workbench-model";
import { videoFragment } from "@/lib/book/video-identity";
import type { BenchVideo } from "./bench-stage";
import { StatusIcon } from "./status-icon";

const ROW =
  "group/row flex min-h-14 items-center gap-3 px-4 py-2.5 text-foreground no-underline " +
  "transition-colors duration-150 hover:bg-muted aria-[current=true]:bg-primary/10";
const ROW_LABEL =
  "block text-sm font-semibold leading-snug group-aria-[current=true]/row:text-primary-strong";
const ROW_SUB = "block text-xs text-muted-foreground";
const ROW_DURATION = "ml-auto shrink-0 text-xs tabular-nums text-muted-foreground";
const GROUP_HEAD =
  "sticky top-0 z-10 flex items-baseline justify-between gap-2 bg-background px-4 pt-3 pb-1.5 " +
  "text-xs font-semibold text-muted-foreground";

export function WorkbenchList({
  videos,
  listLabel,
  markerCountLabel,
  onYoutubeLabel,
  doneLabel,
  partLabel,
}: {
  videos: readonly BenchVideo[];
  listLabel: string;
  markerCountLabel: (video: BenchVideo) => string;
  onYoutubeLabel: string;
  doneLabel: string;
  partLabel: string;
}) {
  const groups = groupVideos(videos);
  const headings = hasGroupHeadings(groups);
  return (
    <nav aria-label={listLabel}>
      {groups.map((group, index) => (
        <section key={`${group.title ?? "none"}-${index}`}>
          {headings && group.title !== null && (
            <h2 className={GROUP_HEAD}>
              <span>{group.title}</span>
              <span
                data-group-progress=""
                data-group-ids={group.items.map((v) => v.bookVideoId).join(" ")}
                className="tabular-nums"
              />
            </h2>
          )}
          <ul role="list" className="m-0 list-none p-0">
            {group.items.map((video) => (
              <li key={video.orderNo}>
                <a
                  id={videoFragment(video.orderNo)}
                  href={`#${videoFragment(video.orderNo)}`}
                  className={ROW}
                  data-video-row=""
                  data-deneme={video.orderNo}
                  data-video-id={video.bookVideoId}
                >
                  <StatusIcon doneLabel={doneLabel} partLabel={partLabel} />
                  <span className="min-w-0">
                    <span className={ROW_LABEL}>{video.label}</span>
                    <span className={ROW_SUB}>{markerCountLabel(video)}</span>
                  </span>
                  <span className={ROW_DURATION}>
                    {video.playable
                      ? video.durationSeconds !== null && formatDuration(video.durationSeconds)
                      : onYoutubeLabel}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: `components/book/marker-panels.tsx`** (server)

```tsx
import { formatDuration } from "@/lib/book/duration";
import { markerLayout } from "@/lib/book/workbench-model";
import { tagFragment } from "@/lib/book/video-identity";
import type { BenchVideo } from "./bench-stage";

const CARDS =
  "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(5.5rem,100%),1fr))] gap-2 p-0";
const CARD =
  "group/marker flex min-h-14 flex-col items-center justify-center rounded-lg border " +
  "border-border bg-card text-primary-strong no-underline tabular-nums transition-colors " +
  "duration-150 hover:border-primary aria-[current=true]:border-primary " +
  "aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground";
const CARD_NO = "text-base font-semibold leading-tight";
const CARD_TIME =
  "text-xs text-muted-foreground group-aria-[current=true]/marker:text-primary-foreground";
const GRID = "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 p-0";
const CELL =
  "flex min-h-11 items-center justify-center rounded-lg border border-border bg-card text-sm " +
  "font-semibold text-primary-strong no-underline tabular-nums transition-colors duration-150 " +
  "hover:border-primary aria-[current=true]:border-primary aria-[current=true]:bg-primary " +
  "aria-[current=true]:text-primary-foreground";
const LIST = "m-0 flex list-none flex-col gap-0.5 p-0";
const LIST_ROW =
  "flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-foreground " +
  "no-underline transition-colors duration-150 hover:bg-muted aria-[current=true]:bg-primary/10 " +
  "aria-[current=true]:text-primary-strong";

export function MarkerPanels({
  videos,
  defaultOrderNo,
  markerLabel,
  markerAria,
  panelLabel,
}: {
  videos: readonly BenchVideo[];
  defaultOrderNo: number;
  /** "Soru 3" or the marker's own name. */
  markerLabel: (tag: BenchVideo["tags"][number]) => string;
  /** "Soru 3, videoda 2:29". */
  markerAria: (tag: BenchVideo["tags"][number]) => string;
  panelLabel: (video: BenchVideo) => string;
}) {
  return videos.map((video) => {
    const layout = markerLayout(video.tags);
    return (
      <div
        key={video.orderNo}
        data-marker-panel=""
        data-deneme={video.orderNo}
        hidden={video.orderNo !== defaultOrderNo}
        role="group"
        aria-label={panelLabel(video)}
      >
        <ul role="list" className={layout === "cards" ? CARDS : layout === "grid" ? GRID : LIST}>
          {video.tags.map((tag, index) => {
            const fragment = tagFragment(video.orderNo, tag, video.tags);
            const common = {
              id: fragment,
              href: `#${fragment}`,
              "data-second": tag.second,
              "data-marker-index": index,
              "aria-label": video.playable ? markerAria(tag) : undefined,
            };
            return (
              <li key={tag.orderNo}>
                {layout === "cards" && (
                  <a {...common} className={CARD}>
                    <span className={CARD_NO}>{tag.orderNo}</span>
                    <span className={CARD_TIME}>{formatDuration(tag.second)}</span>
                  </a>
                )}
                {layout === "grid" && (
                  <a {...common} className={CELL} title={markerAria(tag)}>
                    {tag.orderNo}
                  </a>
                )}
                {layout === "list" && (
                  <a {...common} className={LIST_ROW}>
                    <span className="min-w-0">{markerLabel(tag)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDuration(tag.second)}
                    </span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  });
}
```

- [ ] **Step 5: `components/book/book-bar.tsx`** (no hooks; rendered inside the island so the watched count can be live)

```tsx
import Image from "next/image";
import { ExternalLink, Info, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** The page `h1`, in the workbench-bar spelling named in `page-composition-headings.test.ts`. */
export const BOOK_BAR_H1 =
  "m-0 font-heading text-lg font-bold leading-tight text-foreground lg:text-xl";

export interface BookBarProps {
  title: string;
  coverImagePath: string | null;
  coverAlt: string;
  examTrack: string;
  summary: string;
  watchedText: string | null;
  infoLabel: string;
  purchaseUrl: string | null;
  purchaseLabel: string;
  purchaseAria: string;
}

export function BookBar(p: BookBarProps) {
  return (
    <div className="flex items-center gap-3">
      {p.coverImagePath !== null && (
        <Image
          src={p.coverImagePath}
          alt={p.coverAlt}
          width={40}
          height={53}
          sizes="40px"
          className="h-[53px] w-10 shrink-0 rounded-md border border-border object-cover"
          priority
        />
      )}
      <div className="min-w-0 flex-1">
        <h1 className={BOOK_BAR_H1}>{p.title}</h1>
        <p className="m-0 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span className="font-semibold text-primary-strong">{p.examTrack}</span>
          <span>{p.summary}</span>
          {p.watchedText !== null && <span className="tabular-nums">{p.watchedText}</span>}
        </p>
      </div>
      <a
        href="#kitap-bilgisi"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
      >
        <Info className="size-4" aria-hidden="true" />
        {p.infoLabel}
      </a>
      {p.purchaseUrl !== null && (
        <a
          href={p.purchaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={p.purchaseAria}
          className={cn(buttonVariants({ variant: "primary", size: "sm" }), "min-h-11 min-w-11")}
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{p.purchaseLabel}</span>
          <ExternalLink className="hidden size-3.5 opacity-70 sm:inline" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
```

(Check `buttonVariants` variant names in `components/ui/button.tsx` — `primary`/`ghost`/`outline` are used on the current page; use what exists.)

- [ ] **Step 6: Rewrite `bench-stage.tsx`** — keep `BenchVideo` (extended per Interfaces) and `DenemeVideo` usage; replace the caption + `BenchTimeline` with:

```tsx
export function BenchStage({
  videos,
  kind,
  defaultOrderNo,
  authState,
  progress,
  onSaveWatched,
  externalResolvingOrderNo,
  autoNext,
  onToggleAutoNext,
  onGo,
  onBack,
  onPlaybackTime,
  onEnded,
  markers,
}: {
  videos: readonly BenchVideo[];
  kind: BookContentKind;
  defaultOrderNo: number;
  authState: AuthSessionState;
  progress: VideoProgressValue | null | "loading";
  onSaveWatched: (watched: boolean) => Promise<{ readonly ok: boolean }>;
  externalResolvingOrderNo: number | null;
  autoNext: boolean;
  onToggleAutoNext: () => void;
  onGo: (orderNo: number) => void;
  onBack: () => void;
  onPlaybackTime: (orderNo: number, second: number) => void;
  onEnded: (orderNo: number) => void;
  markers: ReactNode;
}) {
  const t = useTranslations("BookDetail");
  const { selected, active } = useBenchState();
  const orderNo = selected ?? defaultOrderNo;
  const video = videos.find((candidate) => candidate.orderNo === orderNo) ?? videos[0];
  if (video === undefined) return null;
  const single = videos.length === 1;
  const orderNos = videos.map((v) => v.orderNo);
  const { prev, next } = neighbours(orderNos, video.orderNo);
  const prevVideo = videos.find((v) => v.orderNo === prev);
  const nextVideo = videos.find((v) => v.orderNo === next);
  const knownWatched = progress !== null && progress !== "loading" ? progress.watched : false;
  const label = video.label;
  const named = isNamed(video.tags);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-deneme={video.orderNo}>
      {!single && (
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-2 lg:hidden">
          <button
            type="button"
            onClick={onBack}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "min-h-11 -ml-2")}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("backToList", { kind })}
          </button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {t("position", {
              current: orderNos.indexOf(video.orderNo) + 1,
              total: orderNos.length,
            })}
          </span>
        </div>
      )}

      <div className="shrink-0 px-4 pt-2 lg:px-6 lg:pt-4">
        <DenemeVideo
          video={video}
          active={active}
          authState={authState}
          watched={knownWatched}
          title={t("playerTitle", { label })}
          watchLabel={t("watch")}
          watchAriaLabel={t("watchAria", { label })}
          watchAriaSignedOutLabel={t("watchAriaSignedOut", { label })}
          signInCtaText={t("signInCta")}
          sessionReadyAnnounceText={t("sessionReadyAnnounce")}
          watchOnYoutubeLabel={t("watchOnYoutube")}
          watchOnYoutubeAriaLabel={t("watchOnYoutubeAria", { label })}
          watchOnYoutubeLoading={externalResolvingOrderNo === video.orderNo}
          watchLoadingLabel={t("watchLoading")}
          watchLoadingAriaLabel={t("watchLoadingAria", { label })}
          onPlaybackTime={(second) => onPlaybackTime(video.orderNo, second)}
          onEnded={() => onEnded(video.orderNo)}
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2 px-4 pt-3 lg:px-6">
        <div className="min-w-0">
          {video.groupTitleTr !== null && (
            <p className="m-0 text-xs text-muted-foreground">{video.groupTitleTr}</p>
          )}
          <h2
            id="bench-current-heading"
            tabIndex={-1}
            className="m-0 font-heading text-xl font-semibold text-foreground"
          >
            {label}
          </h2>
          <p className="m-0 text-xs text-muted-foreground tabular-nums">
            {t("markerCount", { count: video.markerCount, named: named ? "yes" : "no" })}
            {video.rich !== null && (
              <>
                {" "}
                <span className="sr-only">{t("durationLabel")}</span>
                <time dateTime={video.rich.durationIso}>
                  {formatDuration(video.rich.durationSeconds)}
                </time>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!single && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                role="switch"
                checked={autoNext}
                onChange={onToggleAutoNext}
                className="size-4 accent-[var(--primary)]"
              />
              {t("autoNext")}
            </label>
          )}
          {!single && (
            <div className="hidden items-center gap-1 lg:flex">
              <button
                type="button"
                disabled={prevVideo === undefined}
                onClick={() => prevVideo && onGo(prevVideo.orderNo)}
                aria-label={prevVideo ? t("prevAria", { label: prevVideo.label }) : t("prev")}
                className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-11")}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span className="min-w-12 text-center text-sm tabular-nums text-muted-foreground">
                {t("position", {
                  current: orderNos.indexOf(video.orderNo) + 1,
                  total: orderNos.length,
                })}
              </span>
              <button
                type="button"
                disabled={nextVideo === undefined}
                onClick={() => nextVideo && onGo(nextVideo.orderNo)}
                aria-label={nextVideo ? t("nextAria", { label: nextVideo.label }) : t("next")}
                className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-11")}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      <VideoProgressControls
        authState={authState}
        progress={progress}
        onToggleWatched={onSaveWatched}
      />

      <div
        className="min-h-[6rem] flex-1 overflow-y-auto px-4 pt-3 pb-4 lg:px-6"
        aria-label={t("markersLabel", { named: named ? "yes" : "no" })}
        role="region"
      >
        {markers}
      </div>

      {!single && (
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border p-2 lg:hidden">
          <button
            type="button"
            disabled={prevVideo === undefined}
            onClick={() => prevVideo && onGo(prevVideo.orderNo)}
            className={cn(buttonVariants({ variant: "outline" }), "min-h-12 justify-start")}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="text-xs text-muted-foreground">{t("prev")}</span>
              <span className="truncate">{prevVideo?.label ?? ""}</span>
            </span>
          </button>
          <button
            type="button"
            disabled={nextVideo === undefined}
            onClick={() => nextVideo && onGo(nextVideo.orderNo)}
            className={cn(buttonVariants({ variant: "outline" }), "min-h-12 justify-end")}
          >
            <span className="flex min-w-0 flex-col items-end leading-tight">
              <span className="text-xs text-muted-foreground">{t("next")}</span>
              <span className="truncate">{nextVideo?.label ?? ""}</span>
            </span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
```

Imports: `ReactNode` from react; `ArrowLeft, ChevronLeft, ChevronRight` from lucide-react; `cn`; `buttonVariants`; `neighbours, isNamed` from `@/lib/book/workbench-model`; `type BookContentKind`. Drop `STAGE`, `STAGE_CAPTION`, `STAGE_NAME`, `STAGE_FACTS`, `META_SEPARATOR` and the `BenchTimeline` import. Run prettier (the commit hook does) — the long JSX lines above are formatted by it. The `aria-label` wording for prev/next when disabled falls back to the plain word.

- [ ] **Step 7: Rewrite `video-bench.tsx`** — keep, unchanged in behaviour: `orderNoOf`, `applyFragmentAndSelect`, the auth modal refs and resume-focus effect, `useAuthSession` once, the book-progress fetch, the per-video progress fetch and `saveWatched`, `openExternalWatch`, `resetBench` on unmount, and the `onClick` gate (login gate, resume-second priority, external flow). Delete: the percentage card, the mobile accordion effect, the `indexClassName`/`className`/`children`/`defaultOrderNo` props. Add:

```tsx
const orderNos = useMemo(() => videos.map((v) => v.orderNo), [videos]);
const defaultOrderNo = orderNos[0] ?? 0;
const single = videos.length === 1;
const [step, setStep] = useState<BenchStep>(single ? "watch" : "pick");
const focusOnStep = useRef(false);
const [autoNext, setAutoNext] = useState(true);
const [currentMarker, setCurrentMarker] = useState<{ orderNo: number; index: number } | null>(null);

useEffect(() => {
  setAutoNext(readAutoNext(safeLocalStorage()));
}, []);
```

where `safeLocalStorage` is a module function: `function safeLocalStorage(): Storage | null { try { return window.localStorage; } catch { return null; } }`.

Navigation:

```tsx
const narrow = () => window.matchMedia("(max-width: 63.999rem)").matches;

const goTo = (orderNo: number) => {
  window.history.pushState({ [BENCH_HISTORY_MARK]: true }, "", `#${videoFragment(orderNo)}`);
  selectVideo(orderNo);
  setCurrentMarker(null);
  focusOnStep.current = narrow();
  setStep("watch");
};

const backToList = () => {
  focusOnStep.current = true;
  if (isBenchEntry(window.history.state)) {
    window.history.back();
    return;
  }
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  setStep("pick");
};

useEffect(() => {
  const onPop = () => {
    const next = stepForHash(window.location.hash, orderNos);
    if (next.orderNo !== null) selectVideo(next.orderNo);
    setStep(single ? "watch" : next.step);
  };
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}, [orderNos, single]);
```

In the existing hash-landing effect, replace the corrective page scroll with: `setStep("watch")` when `stepForHash` finds a video, `setCurrentMarker({ orderNo, index })` when the target carries `data-marker-index`, and `root.querySelector('[data-video-row][data-deneme="' + orderNo + '"]')?.scrollIntoView({ block: "nearest" })` (scrolls the list panel only).

Focus after step change:

```tsx
useEffect(() => {
  if (!focusOnStep.current) return;
  focusOnStep.current = false;
  if (step === "watch") document.getElementById("bench-current-heading")?.focus();
  else
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-video-row][data-deneme="${selectedOrderNo}"]`)
      ?.focus();
}, [step, selectedOrderNo]);
```

DOM reconciliation (the server markup is the state; this states the whole answer each time):

```tsx
useEffect(() => {
  const root = rootRef.current;
  if (root === null) return;
  for (const row of root.querySelectorAll<HTMLElement>("[data-video-row]")) {
    if (row.dataset.deneme === String(selectedOrderNo)) row.setAttribute("aria-current", "true");
    else row.removeAttribute("aria-current");
  }
  for (const panel of root.querySelectorAll<HTMLElement>("[data-marker-panel]")) {
    panel.hidden = panel.dataset.deneme !== String(selectedOrderNo);
  }
  root
    .querySelector('[data-video-row][data-deneme="' + selectedOrderNo + '"]')
    ?.scrollIntoView({ block: "nearest" });
}, [selectedOrderNo]);

useEffect(() => {
  const root = rootRef.current;
  if (root === null) return;
  for (const marker of root.querySelectorAll<HTMLElement>(
    "[data-marker-panel] [data-marker-index]",
  )) {
    const panel = marker.closest<HTMLElement>("[data-marker-panel]");
    const on =
      currentMarker !== null &&
      panel?.dataset.deneme === String(currentMarker.orderNo) &&
      marker.dataset.markerIndex === String(currentMarker.index);
    if (on) marker.setAttribute("aria-current", "true");
    else marker.removeAttribute("aria-current");
  }
}, [currentMarker]);

const statuses = useMemo(
  () =>
    rowStatuses(
      bookProgress?.videos ?? [],
      new Map(videos.map((v) => [v.bookVideoId, v.durationSeconds])),
    ),
  [bookProgress, videos],
);

useEffect(() => {
  const root = rootRef.current;
  if (root === null) return;
  for (const row of root.querySelectorAll<HTMLElement>("[data-video-row]")) {
    const status = statuses.get(row.dataset.videoId ?? "");
    if (status === undefined) {
      delete row.dataset.status;
      row.style.removeProperty("--ring");
    } else {
      row.dataset.status = status.kind;
      row.style.setProperty("--ring", status.kind === "part" ? String(status.fraction) : "1");
    }
  }
  for (const slot of root.querySelectorAll<HTMLElement>("[data-group-progress]")) {
    const ids = (slot.dataset.groupIds ?? "").split(" ").filter(Boolean);
    const done = ids.filter((id) => statuses.get(id)?.kind === "done").length;
    slot.textContent = bookProgress === null ? "" : `${done}/${ids.length}`;
  }
}, [statuses, bookProgress]);
```

Playback and auto-next:

```tsx
const onPlaybackTime = (orderNo: number, second: number) => {
  const video = videos.find((v) => v.orderNo === orderNo);
  if (video === undefined) return;
  const index = currentMarkerIndex(
    video.tags.map((tag) => tag.second),
    second,
  );
  setCurrentMarker((prev) =>
    index === -1 || (prev?.orderNo === orderNo && prev.index === index) ? prev : { orderNo, index },
  );
};

const onEnded = (orderNo: number) => {
  if (!autoNext) return;
  const next = nextPlayable(videos, orderNo);
  if (next === null) return;
  window.history.pushState({ [BENCH_HISTORY_MARK]: true }, "", `#${videoFragment(next.orderNo)}`);
  setCurrentMarker(null);
  openVideo(next.orderNo, 0);
};

const toggleAutoNext = () => {
  setAutoNext((value) => {
    writeAutoNext(safeLocalStorage(), !value);
    return !value;
  });
};
```

`onClick` additions (before the `[data-second], [data-player-open]` lookup, same modifier/defaultPrevented guards):

```tsx
const row = event.target.closest<HTMLElement>("[data-video-row]");
if (row !== null) {
  const rowOrderNo = orderNoOf(row);
  if (rowOrderNo === null) return;
  event.preventDefault();
  goTo(rowOrderNo);
  return;
}
```

and, after a marker press resolves its `second` (the `raw !== undefined` branch), record the marker: `const idx = Number.parseInt(trigger.dataset.markerIndex ?? "", 10); if (Number.isFinite(idx)) setCurrentMarker({ orderNo, index: idx });`.

Resume card (rendered above the list):

```tsx
const resume = bookProgress?.resume ?? null;
const resumeVideo = resume === null ? undefined : videos.find((v) => v.orderNo === resume.orderNo);
const resumeCard =
  resume !== null && resumeVideo !== undefined ? (
    <button
      type="button"
      onClick={() => {
        goTo(resumeVideo.orderNo);
        if (resumeVideo.playable) openVideo(resumeVideo.orderNo, resume.lastPositionSeconds);
      }}
      className="m-3 flex min-h-14 w-[calc(100%-1.5rem)] items-center gap-3 rounded-lg border border-border bg-card px-3 text-left transition-colors duration-150 hover:border-primary"
    >
      <RotateCcw className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{t("resumeTitle")}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {t("resumeDetail", {
            label: resumeVideo.label,
            time: formatDuration(resume.lastPositionSeconds),
          })}
        </span>
      </span>
    </button>
  ) : null;
```

(The resume press is a click, so loading the player here respects the click-to-load rule; the existing post-auth resume effect still never loads.)

Render:

```tsx
  const watchedText =
    bookProgress === null ? null : t("bookWatched", { watched: bookProgress.watchedCount, count: bookProgress.videoCount });

  return (
    <div
      ref={rootRef}
      onClick={onClick}
      data-step={step}
      className="group/bench mx-auto flex h-[calc(100dvh-var(--header-height))] min-h-[30rem] w-full max-w-7xl flex-col lg:min-h-[36rem]"
    >
      <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6 lg:px-8 group-data-[step=watch]/bench:max-lg:hidden">
        <BookBar {...barProps} watchedText={watchedText} />
      </div>
      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="min-h-0 flex-1 overflow-y-auto lg:border-r lg:border-border group-data-[step=watch]/bench:max-lg:hidden">
          {resumeCard}
          {list}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col group-data-[step=pick]/bench:max-lg:hidden">
          <BenchStage … markers={markers} onGo={goTo} onBack={backToList} onPlaybackTime={onPlaybackTime} onEnded={onEnded} autoNext={autoNext} onToggleAutoNext={toggleAutoNext} kind={kind} />
        </div>
      </div>
    </div>
  );
```

`VideoBench` calls `const t = useTranslations("BookDetail");` for the strings above (`bookWatched`, `resumeTitle`, `resumeDetail`).

- [ ] **Step 8: Rewrite `page.tsx`** — keep `generateStaticParams`, `generateMetadata`, JSON-LD (`videoTitle` now takes `book.contentKind`), `attributionRows`. Delete `V2LiveTicker`, the hero section, the jump strip, the `<details>` rows, every hoisted class constant and its docblock (their subjects are gone). New body:

```tsx
  const kind = book.contentKind;
  const benchVideos: BenchVideo[] = videoStates.map(({ video, state }) => ({
    orderNo: video.orderNo,
    bookVideoId: video.bookVideoId,
    titleTr: video.titleTr,
    titleEn: video.titleEn,
    groupTitleTr: video.groupTitleTr,
    label: videoTitle(t, locale, video, kind),
    markerCount: video.tags.length,
    durationSeconds: state.kind === "rich" ? state.youtube.durationSeconds : null,
    playable: isPlayable(state),
    tags: video.tags.map((tag) => ({ orderNo: tag.orderNo, second: tag.startSecond, nameTr: tag.nameTr })),
    rich: /* copy the `rich:` expression from the current page.tsx:334-348 verbatim */,
  }));
  const named = (v: BenchVideo) => (isNamed(v.tags) ? "yes" : "no");
  const totalMarkers = benchVideos.reduce((sum, v) => sum + v.markerCount, 0);
  const anyNamed = benchVideos.some((v) => isNamed(v.tags));
  const defaultOrderNo = benchVideos[0]?.orderNo;

  return (
    <>
      {/* JSON-LD unchanged */}
      {defaultOrderNo !== undefined && (
        <VideoBench
          videos={benchVideos}
          kind={kind}
          bookSlug={book.slugTr}
          barProps={{
            title,
            coverImagePath: book.coverImagePath,
            coverAlt: t("coverAlt", { title }),
            examTrack: book.examTrack,
            summary: t("bookSummary", { count: benchVideos.length, kind, markers: totalMarkers, named: anyNamed ? "yes" : "no" }),
            infoLabel: t("bookInfo"),
            purchaseUrl: book.purchaseUrl,
            purchaseLabel: t("purchase"),
            purchaseAria: t("purchaseAria"),
          }}
          list={
            <WorkbenchList
              videos={benchVideos}
              listLabel={t("listLabel", { kind })}
              markerCountLabel={(v) => t("markerCount", { count: v.markerCount, named: named(v) })}
              onYoutubeLabel={t("onYoutube")}
              doneLabel={t("statusDone")}
              partLabel={t("statusPart")}
            />
          }
          markers={
            <MarkerPanels
              videos={benchVideos}
              defaultOrderNo={defaultOrderNo}
              markerLabel={(tag) => tag.nameTr ?? t("tagLabel", { no: tag.orderNo })}
              markerAria={(tag) => t("tagLabelAria", { no: tag.orderNo, time: formatDuration(tag.second) })}
              panelLabel={(v) => v.label}
            />
          }
        />
      )}
      <PageContainer space="default">
        <section id="kitap-bilgisi" aria-labelledby="kitap-bilgisi-heading" className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-6">
          <h2 id="kitap-bilgisi-heading">{t("bookInfo")}</h2>
          {introText && <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground"><ProseNote text={introText} className="space-y-2" /></div>}
          {/* the four fact cards: move the existing `grid grid-cols-2 sm:grid-cols-4` block here VERBATIM
              (same classes, same children) so the composition counters see the same four tiles */}
        </section>
        {/* attribution strip: unchanged */}
      </PageContainer>
    </>
  );
```

`markerLabel`/`markerAria`/`markerCountLabel` are closures and cannot cross into a client component — `WorkbenchList` and `MarkerPanels` are SERVER components rendered here and passed as `ReactNode`, so they receive closures legally. `tagLabelAria` uses `{no}` and `{time}`: for a named marker pass its name instead — add `tagNamedAria: "{name}, videoda {time}"` to both message files and use it when `tag.nameTr !== null`.
Breadcrumbs: dropped from this page (the bar replaces them; the header nav carries "Kitaplar"). If `page-composition-*` tests require breadcrumbs on detail pages, keep `<Breadcrumbs>` inside `#kitap-bilgisi` instead, and say so in the commit.

- [ ] **Step 9: Run and fix the suite**

```bash
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -60
```

Expected failures, and the fix for each:

- `components/book/bench.structure.test.ts` — rewritten in Task 11; skip nothing here, just note it.
- `components/v2/page-composition-headings.test.ts` — entry 7 (`kitaplar/[slug]`) becomes `BOOK_BAR_H1`'s spelling; update the pinned string and its comment to "workbench bar, not a hero (T-128)".
- `components/anchor-offset-token.test.ts` — the book page now carries one `scroll-mt-[calc(var(--header-height)+1rem)]` (on `#kitap-bilgisi`); update its expectation to that.
- `components/v2/page-composition-containers.test.ts` / `page-composition-cards.test.ts` / `components/ui/token-binding.test.ts` — update the counts/paths they report for `kitaplar/[slug]`, one line of reason each.
- `components/book/messages.test.ts`, `lib/book/messages.test.ts` — follow their output (keys added/removed in Task 8).
- `components/book/video-progress.structure.test.ts` — must stay green without edits to its gate assertions; if a regex no longer finds code that still exists, adjust only the anchor text, never the asserted behaviour.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(book): one-screen workbench for every book kind (T-128)"
```

### Task 11: Rewrite `bench.structure.test.ts` for the new contract

**Files:**

- Rewrite: `components/book/bench.structure.test.ts`

- [ ] **Step 1: Replace the retired cases** (accordion, jump strip, timeline, 560 px cap, sticky offset, caption floor) with cases that read the new sources as text, following the file's existing helpers (`readFileSync` of the page and components):

```ts
describe("the workbench keeps every link crawlable (T-128)", () => {
  it("renders every video row as a real fragment link from the server", () => {
    expect(list).toMatch(/href=\{`#\$\{videoFragment\(video\.orderNo\)\}`\}/);
    expect(list).toMatch(/data-video-row=""/);
    expect(list).not.toMatch(/"use client"/);
  });
  it("renders every marker of every video, hiding only the unselected panels", () => {
    expect(markers).toMatch(/videos\.map\(/);
    expect(markers).toMatch(/hidden=\{video\.orderNo !== defaultOrderNo\}/);
    expect(markers).toMatch(/href: `#\$\{fragment\}`/);
    expect(markers).not.toMatch(/"use client"/);
  });
});

describe("the island stays the one delegated listener", () => {
  it("acts only on the three data hooks", () => {
    expect(bench).toMatch(/closest<HTMLElement>\("\[data-video-row\]"\)/);
    expect(bench).toMatch(/closest<HTMLElement>\("\[data-second\], \[data-player-open\]"\)/);
  });
  it("loads no player from a hash alone", () => {
    const hashEffect = bench.slice(bench.indexOf("window.location.hash.slice(1)"));
    expect(hashEffect.slice(0, hashEffect.indexOf("}, [")).includes("openVideo(")).toBe(false);
  });
  it("pushes a marked history entry on selection and never on a marker press", () => {
    expect(bench).toMatch(/pushState\(\{ \[BENCH_HISTORY_MARK\]: true \}/);
    expect(bench).toMatch(/replaceState\(null, "", fragment\)/);
  });
  it("clears the store when the bench leaves the page", () => {
    expect(bench).toMatch(/useEffect\(\(\) => resetBench, \[\]\)/);
  });
  it("never auto-loads a video the provider refuses to embed", () => {
    expect(bench).toMatch(/nextPlayable\(videos, orderNo\)/);
  });
});

describe("the one-screen frame", () => {
  it("sizes the workbench to the viewport below the header, with a floor", () => {
    expect(bench).toMatch(/h-\[calc\(100dvh-var\(--header-height\)\)\] min-h-\[30rem\]/);
    expect(bench).toMatch(/lg:min-h-\[36rem\]/);
  });
  it("splits the steps only below lg", () => {
    expect(bench).toMatch(/group-data-\[step=watch\]\/bench:max-lg:hidden/);
    expect(bench).toMatch(/group-data-\[step=pick\]\/bench:max-lg:hidden/);
  });
  it("keeps every marker target at least 44px", () => {
    expect(markers).toMatch(/minmax\(2\.75rem,1fr\)/);
    expect(markers).toMatch(/min-h-11/);
  });
});
```

(Declare `const list = read("components/book/workbench-list.tsx")`, `markers = read("components/book/marker-panels.tsx")`, `bench = read("components/book/video-bench.tsx")` with the file's existing read helper.)

- [ ] **Step 2: Run + commit**

```bash
pnpm vitest run components/book && pnpm test
git add components/book/bench.structure.test.ts && git commit -m "test(book): pin the workbench's crawlable-links and one-screen contract (T-128)"
```

### Task 12: Local sample books, visual verification, sweep

**Files:**

- Create (NOT committed): `$SCRATCH/t128-sample-books.sql` where `$SCRATCH=/home/sertturk16/.tmp-claude/claude-1000/-home-sertturk16-cografya-v4/2fa3fc79-5538-4cfe-b834-939d6c43cad7/scratchpad`

- [ ] **Step 1: Migrate the dev DB and insert samples** — run the API migration against the dev database (Task 1 Step 7). Write the SQL: four books (`soru_bankasi` with 3 groups × 3 tests × 24 unnamed tags; `konu_anlatimi` with 2 groups × 3 lessons × 6–9 named tags; `kamp` with 4 "N. GÜN" groups × 1 fasikül × 64 unnamed tags; `tek_video` with one video × 18 named tags), each reusing the existing book's `youtube_video_id` values so snapshots/identity resolve, `display_order` 90–93, slugs `t128-ornek-*`, `cover_image_path` = the existing cover. Required `books` columns: copy from the existing row via `INSERT … SELECT` and override slug/title/isbn13 (unique: `97800000000N1`…)/content_kind/display_order. Run with `psql`, then revalidate: `curl -s localhost:3000/kitaplar/t128-ornek-kamp -o /dev/null -w '%{http_code}'` → 200 (the dev server renders on demand).

- [ ] **Step 2: Playwright pass (one batched round)** — for `/kitaplar/ayt-cografya-konu-ozetli-brans-denemeleri` and the four samples, at 320×640, 360×640, 390×844 and 1280×800, light and dark: screenshot to `.playwright-mcp/t128-<slug>-<w>-<theme>.png`, and evaluate
      `document.scrollingElement.scrollHeight - innerHeight` is ≥ 0 but the workbench's `getBoundingClientRect().bottom <= innerHeight` (fits one screen), and each inner scroller (`overflow-y-auto`) is the one that scrolls. Mobile flow: tap a row → step 2, heading focused; tap Sonraki; press back (`page.goBack()`) → returns to step 2 of the previous video, again → step 1; open `#video-20-etiket-3` directly → step 2, marker 3 `aria-current`. Signed in (dev account): status icons, resume card, "x/30 izlendi". Keyboard: Tab through list → Enter on a row → focus stays on the row at 1280 (no jump).

- [ ] **Step 3: Fix everything the round shows in one batch, confirm with at most one more round.**

- [ ] **Step 4: Sweep and build**

```bash
pnpm sweep:overflow -- --filter=/kitaplar
docker stop cografya-web-dev && pnpm build; docker start cografya-web-dev
```

Expected: sweep green; build passes.

- [ ] **Step 5: Remove the sample rows** — `DELETE FROM books WHERE slug_tr LIKE 't128-ornek-%'` (cascades to videos/tags; check the FK first with `\d book_videos`). Screenshots of the samples stay in `.playwright-mcp/` for the PR.

### Task 13: Close out

- [ ] **Step 1:** `docs/architecture.md` — one short paragraph under the book section: the workbench DOM contract (row/panel/marker data attributes) and that the island reconciles attributes on server markup. No narrative.
- [ ] **Step 2:** Final gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm codegen:check`.
- [ ] **Step 3:** Push and open the web PR into `dev` (GH_TOKEN per `gh-pr-account`), body: summary, before/after screenshots (390 and 1280), the four-kind samples, link to the API PR, "merge the API PR first", ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- [ ] **Step 4:** Move T-128 from `TASKS.md` to the top of `TASKS-DONE.md` with both PR links.
