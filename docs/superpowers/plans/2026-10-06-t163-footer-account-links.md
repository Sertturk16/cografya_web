# T-163 Footer and Header Account Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in reader never sees "Giriş Yap / Ücretsiz Kayıt Ol" in the footer or
"Giriş Yap / Üye Ol" in the header, not even for the moment the session check runs.

**Architecture:** The footer stays a server component; its two account `<li>` rows move into a
client island `components/v2/v2-footer-account-links.tsx` (a pure `V2FooterAccountLinksView` for
`renderToStaticMarkup` tests plus a thin `useAuthSession()` wrapper). The header's desktop cluster
and drawer footer get a third branch: `"checking"` renders an `aria-hidden` placeholder of the
guest pair's size, and the guest branch is gated on `"anonymous"`, never on
`!== "authenticated"` (T-162's rule: `"checking"` is not `"anonymous"`).

**Tech Stack:** Next.js 16 App Router (server footer, client island), React 19.2, vitest node.

**Spec:** `/home/sertturk16/cografya_v4/TASKS.md` → T-163 (Olgu, Kriter, Grooming, Karar).

## Global Constraints

- Footer and `(site)` layout stay static: no `cookies()`/`getSession` there (25 ISR pages).
- Guest: the two current links unchanged ("Giriş Yap" `/giris`, "Ücretsiz Kayıt Ol" `/kayit`).
- Signed in: "Hesabım" `/hesabim`, "Ayarlar" `/hesabim/ayarlar`; NO "Çıkış Yap" in the footer.
- Checking: two `aria-hidden` placeholder rows of the link rows' height; header shows neither
  branch.
- No new copy beyond the two labels the header already uses.

## Review Focus

- Server render (= `"checking"`) of the island holds no "Giriş Yap" (no flash for members).
- The placeholder rows keep the footer column's height (no jump when the state settles).
- Desktop header cluster keeps its width while checking (placeholder sized to the guest pair).
- Drawer: checking shows neither the guest buttons nor the account links.
- `v2-header-account-menu.test.ts` and `v2-auth-ports.test.ts` stay green.

---

### Task 1: footer island

**Files:** Create `components/v2/v2-footer-account-links.tsx`,
`components/v2/v2-footer-account-links.test.tsx`; Modify `components/v2/v2-footer.tsx`.

- [ ] Failing tests: view per state (anonymous: both links and hrefs; authenticated: `/hesabim`,
      `/hesabim/ayarlar`, no "Giriş Yap", no "Çıkış"; checking: two `aria-hidden="true"` `<li>`, no
      link); `<V2FooterAccountLinks />` server render equals checking; footer source has no `/giris`,
      `/kayit`, `cookies(`, `getSession` and renders `<V2FooterAccountLinks`.
- [ ] Implement; run; commit.

### Task 2: header checking branch

**Files:** Modify `components/v2/v2-header.tsx`; Test `components/v2/v2-header-account-menu.test.ts`.

- [ ] Failing tests: no `authState !== "authenticated"` in the header; both guest branches sit
      under `authState === "anonymous"`; a `authState === "checking"` placeholder is `aria-hidden`.
- [ ] Implement; run; browser check (session held 5 s, desktop + 390 drawer); sweep; commit; PR.
