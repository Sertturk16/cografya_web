# T-048 — Build Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a production build that cannot reach the API fail loudly instead of exiting 0 with 856 of its 980 routes silently missing — and give the real deploy and CI an API so they build the thing production is supposed to ship.

**Architecture:** A guard first, proven red against a data-less build before anything is fixed; then the two places that produce data-less builds (the Docker image, CI) are given API access. The guard reads `.next/prerender-manifest.json` and asserts named subsets, because a single total lets a partial collapse hide inside a healthy sum.

**Tech Stack:** Next.js 16 standalone output, Node 24, pnpm 11.2.2, Docker BuildKit, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-19-dark-mode-and-build-integrity-design.md` (§2.1, §5, §8)

## Global Constraints

- Branch off `dev`: `feature/t048-build-integrity`. Never push to `main`; a push to `main` deploys.
- Depends on nothing. May run in parallel with T-033 and T-031c. Touches no `components/**`, no `app/**`, no `app/globals.css`.
- `pnpm typecheck && pnpm lint && pnpm test` green before every commit.
- The root `docker-compose.prod.yml` and `Caddyfile` live in the **workspace root, which is not a git repo**. Changes there are not committed by this branch; they are written down in the PR body as the deploy-side change the owner applies. Only `cografya_web/` files are committed.
- `.env.prod` is gitignored and must never be printed or committed.
- Never weaken a test to go green. If the guard is red, the build is wrong.
- Node 24 (`.nvmrc`), pnpm pinned by `packageManager`.

---

### Task 1: The prerender floor guard, proven red first

**Files:**

- Create: `scripts/assert-prerender-floor.mjs`
- Create: `scripts/assert-prerender-floor.test.ts`
- Modify: `package.json` (the `build` script)

**Interfaces:**

- Consumes: nothing.
- Produces: `readPrerenderFloors(manifest: unknown): { label: string; kind: "exact" | "floor"; expected: number; actual: number }[]` exported from `scripts/assert-prerender-floor.mjs`, so the test can exercise the counting without running a build. The CLI half calls it and exits 1 on any row that fails.

**Why subsets, not a total.** `PAGE_BODY_SPELLINGS = 0` read a missing wrapper as compliance and four PRs went by. A total-only floor has the same shape: 980 could be met while every province page is gone and something else grew.

**Why `build` and not `postbuild`.** pnpm ships `enable-pre-post-scripts` disabled by default, so a `postbuild` script would silently never run. A guard whose failure mode is "quietly absent" is the exact class of defect this task closes.

- [ ] **Step 1: Write the failing test**

Create `scripts/assert-prerender-floor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readPrerenderFloors } from "./assert-prerender-floor.mjs";

/** A manifest shaped like the real one, with the route counts a healthy build produces. */
function healthyManifest(): { routes: Record<string, unknown> } {
  const routes: Record<string, unknown> = {};
  const add = (path: string) => {
    routes[path] = {};
  };
  for (const locale of ["tr", "en"]) {
    for (let i = 0; i < 81; i++) add(`/${locale}/turkiye/province-${i}`);
    for (let i = 0; i < 7; i++) add(`/${locale}/turkiye/bolge/region-${i}`);
    for (let i = 0; i < 199; i++) add(`/${locale}/dunya/country-${i}`);
    for (let i = 0; i < 14; i++) add(`/${locale}/dunya/kita/continent-${i}`);
    add(`/${locale}/kitaplar/a-book`);
    for (let i = 0; i < 7; i++) add(`/${locale}/design-system/category-${i}`);
  }
  return { routes };
}

describe("readPrerenderFloors", () => {
  it("passes every row for a healthy manifest", () => {
    const rows = readPrerenderFloors(healthyManifest());
    const failures = rows.filter((r) =>
      r.kind === "exact" ? r.actual !== r.expected : r.actual < r.expected,
    );
    expect(failures).toEqual([]);
  });

  it("counts the 81 provinces in both locales", () => {
    const provinces = readPrerenderFloors(healthyManifest()).find((r) => r.label === "provinces");
    expect(provinces).toMatchObject({ kind: "exact", expected: 162, actual: 162 });
  });

  it("fails the province row when the API was unreachable — the case this exists for", () => {
    // What a 127.0.0.1:9 build actually produced on 2026-09-19: turkiye collapses to the one
    // static hub page, books to nothing, while unrelated static routes survive.
    const collapsed = { routes: { "/tr/turkiye/bolge": {}, "/en/turkiye/bolge": {} } };
    const rows = readPrerenderFloors(collapsed);
    const provinces = rows.find((r) => r.label === "provinces");
    expect(provinces).toMatchObject({ expected: 162, actual: 0 });
  });

  it("rejects a manifest that is not shaped like one at all", () => {
    expect(() => readPrerenderFloors({ nope: true })).toThrow(/routes/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/assert-prerender-floor.test.ts`

Expected: FAIL — `Cannot find module './assert-prerender-floor.mjs'`.

If vitest does not pick up `scripts/`, add `"scripts/**/*.test.ts"` to the `include` array in `vitest.config.ts` as part of this step; co-located tests under `lib/`, `components/` and `tools/` are the current convention and `scripts/` is a fourth root.

- [ ] **Step 3: Write the implementation**

Create `scripts/assert-prerender-floor.mjs`:

```js
/**
 * Assert that a production build actually prerendered its data pages.
 *
 * ## The failure this catches
 *
 * Measured 2026-09-19: with the API unreachable, `next build` exits **0** and writes **124**
 * prerendered routes instead of **980**. Every `generateStaticParams` returns zero rows,
 * because the 16 `*Resilient`/`*Safe` wrappers swallow fetch failures to `[]` while
 * `NEXT_PHASE` says production build. Nothing downstream noticed, including CI.
 *
 * ## Why named subsets and not one total
 *
 * A single total is satisfiable while a whole category is missing. The counts below are
 * therefore per route family, and the structural ones are pinned EXACTLY: Türkiye has 81
 * provinces and 7 regions, and the showcase has 7 categories, so those numbers moving is
 * news either way. Country and book counts are floors, because seeds are added over time.
 *
 * All figures measured from `.next/prerender-manifest.json` on 2026-09-19.
 */
import { readFileSync } from "node:fs";

/** @typedef {{ label: string, kind: "exact" | "floor", expected: number, pattern: RegExp }} Rule */

/** @type {readonly Rule[]} */
const RULES = [
  { label: "total", kind: "floor", expected: 980, pattern: /^\// },
  {
    label: "provinces",
    kind: "exact",
    expected: 162,
    pattern: /^\/(tr|en)\/turkiye\/(?!bolge)[^/]+$/,
  },
  { label: "regions", kind: "exact", expected: 14, pattern: /^\/(tr|en)\/turkiye\/bolge\/[^/]+$/ },
  {
    label: "countries",
    kind: "floor",
    expected: 398,
    pattern: /^\/(tr|en)\/(dunya|world)\/(?!kita|continent)[^/]+$/,
  },
  {
    label: "continents",
    kind: "exact",
    expected: 28,
    pattern: /^\/(tr|en)\/(dunya\/kita|world\/continent)\/[^/]+$/,
  },
  { label: "books", kind: "floor", expected: 2, pattern: /^\/(tr|en)\/(kitaplar|books)\/[^/]+$/ },
  {
    label: "design-system",
    kind: "exact",
    expected: 14,
    pattern: /^\/(tr|en)\/design-system\/[^/]+$/,
  },
];

/**
 * @param {unknown} manifest
 * @returns {{ label: string, kind: "exact" | "floor", expected: number, actual: number }[]}
 */
export function readPrerenderFloors(manifest) {
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    !("routes" in manifest) ||
    typeof manifest.routes !== "object" ||
    manifest.routes === null
  ) {
    throw new Error("Not a prerender manifest: no `routes` object");
  }
  const paths = Object.keys(manifest.routes);
  return RULES.map((rule) => ({
    label: rule.label,
    kind: rule.kind,
    expected: rule.expected,
    actual: paths.filter((p) => rule.pattern.test(p)).length,
  }));
}

function main() {
  const path = ".next/prerender-manifest.json";
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    console.error(`prerender floor: cannot read ${path} — did next build run?`);
    console.error(String(cause));
    process.exit(1);
  }

  const rows = readPrerenderFloors(manifest);
  const failed = rows.filter((r) =>
    r.kind === "exact" ? r.actual !== r.expected : r.actual < r.expected,
  );

  for (const r of rows) {
    const ok = r.kind === "exact" ? r.actual === r.expected : r.actual >= r.expected;
    const sign = r.kind === "exact" ? "=" : ">=";
    console.log(`${ok ? "ok  " : "FAIL"} ${r.label.padEnd(14)} ${r.actual} ${sign} ${r.expected}`);
  }

  if (failed.length > 0) {
    console.error(
      `\nprerender floor: ${failed.length} route famil${failed.length === 1 ? "y" : "ies"} short. ` +
        `An API-less build looks exactly like this. Check API_BASE_URL and that the API is ` +
        `reachable from wherever this build ran.`,
    );
    process.exit(1);
  }
}

// Only run the CLI half when invoked directly, so the test can import the counting half.
if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/^.*[/\\]/, ""))
) {
  main();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run scripts/assert-prerender-floor.test.ts`

Expected: PASS, all four.

- [ ] **Step 5: Prove the guard red against a real data-less build**

This is the step that makes the guard worth having. Do not skip it.

```bash
API_BASE_URL=http://127.0.0.1:9 NODE_ENV=production pnpm exec next build
node scripts/assert-prerender-floor.mjs
```

Measured: `next build` exits 0 (that is the defect), then the guard prints `FAIL` for five
families — `total`, `provinces`, `regions`, `countries`, `books` — and exits 1. `continents`
and `design-system` stay `ok`: their `generateStaticParams` are non-async over local
constants (`app/[locale]/(site)/dunya/kita/[slug]/page.tsx:43` and
`app/[locale]/design-system/[category]/page.tsx:13`), so they never touch the API.

Record the exact printed block in the PR body. A guard that has never been seen red is a
guard nobody has checked.

- [ ] **Step 6: Restore a real build and confirm green**

```bash
NODE_ENV=production pnpm build   # still the un-chained script at this point
node scripts/assert-prerender-floor.mjs
```

Expected: every row `ok`, exit 0.

The API must be running on `:3001`. If the build dies with `ECONNRESET` partway, that is the
recorded flake — re-run; two of three attempts failed on 2026-09-19. Task 5 addresses it.

- [ ] **Step 7: Chain the guard into `build`**

In `package.json`:

```json
    "build": "next build && node scripts/assert-prerender-floor.mjs",
```

- [ ] **Step 8: Commit**

```bash
git add scripts/assert-prerender-floor.mjs scripts/assert-prerender-floor.test.ts package.json vitest.config.ts
git commit -m "feat(build): assert the prerender floor after every build

An API-less build exits 0 with 124 routes instead of 980 and nothing
noticed. The guard counts named route families rather than a total,
because a total is satisfiable while a whole family is missing.

Chained into build rather than postbuild: pnpm ships pre/post scripts
disabled, so a postbuild guard would silently never run."
```

---

### Task 2: Decide how the Docker build reaches the API

A spike. Its output is a decision plus the one-line compose change that implements it, not code you keep.

**Files:**

- None committed by this task. The finding goes in the PR body and into Task 3.

**Interfaces:**

- Consumes: nothing.
- Produces: the value of `build.network` used in Task 3.

**The constraint:** the `api` service publishes no host ports; it is reachable only on the `cografya-net` bridge. The deploy runs `docker compose -f docker-compose.prod.yml build web` on the host, where `api` is already up.

- [ ] **Step 1: Try the named network**

In a scratch copy of the root compose file, add to the `web` service:

```yaml
build:
  context: ./cografya_web
  dockerfile: Dockerfile
  network: cografya-net
  args:
    API_BASE_URL: http://api:3001
```

Then, with the local stack up:

```bash
docker compose -f docker-compose.prod.yml build web
```

Expected if it works: the build resolves `api` and the floor guard passes inside the image
build. Expected if BuildKit rejects a named network: an error naming `network`.

- [ ] **Step 2: If the named network fails, try host networking**

Publish the API on loopback only, in the `api` service:

```yaml
ports:
  - "127.0.0.1:3001:3001"
```

and on `web`:

```yaml
build:
  context: ./cografya_web
  dockerfile: Dockerfile
  network: host
  args:
    API_BASE_URL: http://127.0.0.1:3001
```

- [ ] **Step 3: Record which one works**

Write the winner, the exact compose block, and the error from the loser into the PR body
under a `### Deploy-side change (apply on the host)` heading. The root compose file is not in
a git repo, so the PR body is where this change is reviewable.

---

### Task 3: Give the image the API and the token

**Files:**

- Modify: `Dockerfile` (the `builder` stage, currently lines 11-17)
- Not committed, recorded in the PR body: the root `docker-compose.prod.yml` `web.build` block from Task 2.

**Interfaces:**

- Consumes: the `build.network` value decided in Task 2.
- Produces: an image whose build runs the Task 1 guard with real data.

**Why the token cannot be an `ARG`.** Build args are recorded in image history and readable
by anyone who can run `docker history`. `INTERNAL_REQUEST_TOKEN` is the shared secret that
exempts the web from the API's throttler; leaking it into every layer listing is not
acceptable. And it genuinely is needed: 980 routes against a 120-request/60-second per-handler
limit is a 429 without it.

- [ ] **Step 1: Take the API base URL as a build arg**

Replace the `builder` stage's env block in `Dockerfile`:

```dockerfile
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# The build PRERENDERS ~980 data routes, so it needs the API. Supplied by
# docker-compose.prod.yml's web.build.args; the default keeps a bare `docker build` working
# against a locally running API.
ARG API_BASE_URL=http://127.0.0.1:3001
ENV API_BASE_URL=${API_BASE_URL}
# INTERNAL_REQUEST_TOKEN is deliberately NOT an ARG: build args land in image history. It is
# mounted as a BuildKit secret for the duration of this one command and is not in any layer.
RUN --mount=type=secret,id=internal_request_token \
    INTERNAL_REQUEST_TOKEN="$(cat /run/secrets/internal_request_token)" pnpm build
```

- [ ] **Step 2: Verify the secret is not in the image**

```bash
docker build --secret id=internal_request_token,env=INTERNAL_REQUEST_TOKEN \
  --build-arg API_BASE_URL=http://127.0.0.1:3001 -t cografya-web-probe ./cografya_web
docker history --no-trunc cografya-web-probe | grep -c INTERNAL_REQUEST_TOKEN || echo "absent — good"
```

Expected: `absent — good`. If the token appears, the `ARG` form crept back in.

- [ ] **Step 3: Verify the build now prerenders**

The `docker build` above must reach the guard and print the `ok` rows. If it prints `FAIL`,
the network choice from Task 2 is not taking effect — fix that before proceeding.

- [ ] **Step 4: Commit the Dockerfile**

```bash
git add Dockerfile
git commit -m "fix(docker): build the image with the API reachable

The image is what production runs and it was built with no API: no
API_BASE_URL at build time, and env.server.ts defaults it to localhost
rather than failing, so 856 routes were missing from every deploy.

The internal token is a BuildKit secret, not a build arg — args are
recorded in image history."
```

- [ ] **Step 5: Write the deploy-side change into the PR body**

The root compose file and `deploy.yml`'s build invocation need the matching change:

```bash
docker compose -f docker-compose.prod.yml build web \
  --build-arg API_BASE_URL=http://api:3001
```

with `INTERNAL_REQUEST_TOKEN` exported from `.env.prod` into the deploy shell so the secret
mount can read it. Spell this out in the PR body; the owner applies it on the host.

---

### Task 4: Build what production builds, in CI

**Files:**

- Modify: `.github/workflows/ci.yml` (the `build` job, currently lines 122-142)

**Interfaces:**

- Consumes: the `build` script from Task 1.
- Produces: a CI job that fails when prerendering collapses.

**Why a full API and not a service image.** `cografya_api` publishes no image anywhere — its
deploy builds on the host — so there is nothing for a `services:` entry to pull. What makes
this workable is that the seed data is committed in-repo with five seed CLIs. Accepted cost:
roughly 3-5 minutes per PR (owner decision, 2026-09-19).

- [ ] **Step 1: Replace the build job**

```yaml
build:
  name: Build
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_USER: cografya
        POSTGRES_PASSWORD: cografya_ci
        POSTGRES_DB: cografya
      ports:
        - 5432:5432
      options: >-
        --health-cmd "pg_isready -U cografya -d cografya"
        --health-interval 10s --health-timeout 5s --health-retries 5
    redis:
      image: redis:7-alpine
      ports:
        - 6379:6379
      options: >-
        --health-cmd "redis-cli ping"
        --health-interval 10s --health-timeout 5s --health-retries 5
  env:
    DATABASE_URL: postgresql://cografya:cografya_ci@127.0.0.1:5432/cografya
    REDIS_URL: redis://127.0.0.1:6379
    # CI-local only. Not a production secret: it guards a throwaway API that exists for the
    # length of this job. It is here rather than in `secrets` so the job is reproducible by
    # anyone reading it.
    INTERNAL_REQUEST_TOKEN: ci-internal-request-token-at-least-32-chars
    API_BASE_URL: http://127.0.0.1:3001
  steps:
    - name: Checkout web
      uses: actions/checkout@v7

    - name: Checkout api
      uses: actions/checkout@v7
      with:
        repository: Sertturk16/cografya_api
        ref: dev
        path: .api

    - name: Install pnpm
      uses: pnpm/action-setup@v4

    - name: Setup Node
      uses: actions/setup-node@v6
      with:
        node-version-file: .nvmrc
        cache: pnpm

    - name: Install api dependencies
      working-directory: .api
      run: pnpm install --frozen-lockfile

    - name: Migrate
      working-directory: .api
      run: pnpm migration:run

    - name: Seed
      working-directory: .api
      run: |
        pnpm db:seed:geography
        pnpm db:seed:regions
        pnpm db:seed:world
        pnpm db:seed:books
        pnpm db:seed:reference

    - name: Boot api
      working-directory: .api
      env:
        NODE_ENV: development
        PORT: 3001
      run: |
        pnpm build
        node dist/main.js &
        for i in $(seq 1 60); do
          if curl -fsS http://127.0.0.1:3001/api/provinces/istanbul > /dev/null; then
            echo "api up after ${i}s"; exit 0
          fi
          sleep 1
        done
        echo "api did not come up in 60s"; exit 1

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Build
      run: pnpm build
```

- [ ] **Step 2: Verify the job fails when the API is absent**

Temporarily change the `Boot api` step's last line to `echo skipped` and push to the branch.

Expected: the `Build` step fails on the floor guard, naming the short families — not on a
timeout, and not silently green.

Revert that change.

- [ ] **Step 3: Verify the job passes with the API present**

Expected: `Build` green, and the guard's `ok` rows visible in the log.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(build): build against a real API

Every CI build this repo has ever run was a broken build: no services
block, so 856 of 980 routes were never prerendered and the job exited 0.
cografya_api publishes no image, so the job stands one up from the
committed seeds."
```

---

### Task 5: Measure the ECONNRESET ceiling and settle it

The build flake is reproducible — two of three API-reachable builds failed on 2026-09-19, at
248/992 and 744/992 — and it will now fail CI, so it has to be settled rather than retried by
hand. Its cause is unmeasured: the one probe run against the API carried no internal token and
so only measured the throttler.

**Files:**

- Modify: `next.config.ts` (add `experimental.cpus`) **or** nothing, depending on the measurement.

**Interfaces:**

- Consumes: a running API.
- Produces: either a pinned worker count with a recorded reason, or a recorded finding that the ceiling is elsewhere.

- [ ] **Step 1: Measure the API's concurrency ceiling with the token attached**

```bash
TOKEN=$(grep '^INTERNAL_REQUEST_TOKEN=' .env.local | cut -d= -f2-)
for N in 4 8 12 16 19 24; do
  fails=$(seq 1 200 | xargs -P "$N" -I{} \
    curl -s -o /dev/null -w '%{http_code}\n' --max-time 20 \
      -H "x-internal-request-token: $TOKEN" \
      http://127.0.0.1:3001/api/provinces/corum | grep -vc '^200$')
  echo "concurrency=$N  non-200: $fails / 200"
done
```

Record the table. A clean run at every level means the ceiling is not raw concurrency and the
next suspect is connection reuse or a keep-alive timeout; say so rather than guessing.

- [ ] **Step 2: If a ceiling appears below 19, pin the build worker count**

In `next.config.ts`, inside the config object:

```ts
  experimental: {
    // `next build` defaults to one worker per core — 19 on the build host — and that many
    // concurrent prerenders reset connections against a single API instance. Measured
    // ceiling: <N> concurrent requests clean, <N+k> resets. See T-048.
    cpus: 8,
  },
```

Replace `8` and the comment's figures with what Step 1 actually measured. Do not copy the 8.

- [ ] **Step 3: Confirm three consecutive clean builds**

```bash
for i in 1 2 3; do NODE_ENV=production pnpm build || echo "attempt $i FAILED"; done
```

Expected: three exit-0 builds with the guard green. Three, because two of three failed before
the change; one pass proves nothing.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "fix(build): cap prerender workers to what the API sustains

Two of three builds died with ECONNRESET at 248/992 and 744/992 before
this. The trigger recorded in TASKS.md was an open browser holding the
API busy; it reproduces with no browser, so the real variable is the
worker count."
```

If Step 1 found no ceiling, skip the commit and record the measurement in the PR body instead.

---

## Branch close

- [ ] `pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] `pnpm build` green three times running, guard rows all `ok`.
- [ ] The guard has been **seen red** against a `127.0.0.1:9` build, and that output is in the PR body.
- [ ] `docker history` on the built image does not contain the internal token.
- [ ] The PR body carries the deploy-side compose change under its own heading, because the root compose file is outside every git repo here.
- [ ] `docs/architecture.md`'s "Known gaps" entry about CI never reaching this error path is updated to say it now does.
- [ ] Open the PR to `dev` (squash), titled `T-048: a build that cannot reach the API fails`.
