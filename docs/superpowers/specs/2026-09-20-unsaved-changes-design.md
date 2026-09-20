# T-062 — One unsaved-changes pattern for the whole site

**Status:** designed and implemented. Verified in the browser on the registration wizard in both
locales; the settings page itself was not reachable locally (see "What was not verified").

## The problem

`/hesabim/ayarlar` has four sections, three of them forms. A member who edits their phone number
and leaves via a header link — without pressing Kaydet — loses the edit with no warning. The same
holds for step 2 of the registration wizard and for the profile card.

This is the Web Interface Guidelines item _"Warn before navigation with unsaved changes"_. T-061
left it out of scope deliberately: the site has no such pattern anywhere, and a solution built for
one page would be built in the wrong place.

`beforeunload` catches only tab close. There is no App Router navigation event to hook, so
catching in-site navigation needs either click interception or a link wrapper. That makes this a
decision about a **site-wide dirty-form pattern**, with the settings page as its first consumer.

## Decisions taken

| Question                | Answer                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What happens on leave?  | A confirmation dialog: "unsaved changes — leave or stay". Navigation blocks until the member chooses.                                                                                                                     |
| Which exits are caught? | In-site links and programmatic `router.push`/`replace`, plus tab close via `beforeunload`. Browser back/forward is **out of scope** — catching it needs a synthetic history entry, which degrades the back button itself. |
| Approach                | Guarded navigation primitives, not a global click listener and not per-consumer wrappers.                                                                                                                                 |

## Why guarded primitives

- **`i18n/navigation.ts` is already the single door for links.** 56 files import `Link` from it and
  nothing in the tree imports `next/link`. Wrapping there covers every existing call site without
  editing one of them.
- **A global capture-phase `click` listener** would catch plain `<a>` too, but never sees
  `router.push` and races React's own event system.
- **A per-consumer `<GuardedLink>`** cannot work: the navigation a member actually takes is a
  header link, and the header renders outside the form's tree.

### Correction to the first draft of this spec

That draft claimed six files "violate" the `CLAUDE.md` rule by importing `useRouter` from
`next/navigation`. Reading them, most do it **deliberately and correctly**:
`v2-login-card.tsx`, `v2-verify-email-card.tsx` and `v2-register-card.tsx` push a path the BFF has
already resolved (`safeReturnPath()`, `result.redirectTo`), and next-intl's router would prefix it
a second time. Two of the six had no such reason and were converted — and `v2-hero.tsx` turned out
to be a real bug, not a style violation: it pushed unprefixed route keys (`/turkiye`), so an `/en`
reader was sent to a path that does not exist under that locale.

The allowed list is now recorded, with each entry's reason, in
`lib/forms/navigation-import-discipline.test.ts`.

## Section 1 — the dirty-state API

**`useUnsavedChanges(dirty: boolean)`** is the only thing a form calls. While `dirty` is true the
component holds a source in a module-level registry; it releases on `dirty` going false and on
unmount.

**Computing "dirty" belongs to the caller.** The settings cards already seed their state from
`profile`, so dirty is "current fields ≠ a baseline". The baseline is state, not the prop: it moves
to the saved values on success, because `router.refresh()` does not remount the card and a
comparison against the prop would keep claiming unsaved edits after the save that produced them.
The password card is the shape that shows why the caller must decide — its fields start empty, so
dirty there is "anything has been typed".

**The registry counts sources, it does not hold a flag.** Three independent forms sit on the
settings page and any subset can be dirty. A boolean would be written by whichever re-rendered
last. Each release is idempotent, because React 19 Strict Mode double-invokes effect cleanups.

**Module singleton, not context.** The guard lives in the wrapped `Link`, which renders in the
header of both route groups — outside any provider a form could mount. Read through
`useSyncExternalStore`, the same shape `lib/auth/auth-modal.client.ts` uses.

**No callbacks in module state**, which that file's docblock states as a rule and a reason. The
pending navigation is held as a PATH, a plain string, and the dialog performs the navigation.

**`message` was dropped from the hook.** The first draft had `useUnsavedChanges(dirty, message?)`.
`beforeunload` ignores any message a page supplies and shows the browser's own wording, so one of
the two channels would have silently discarded it.

## Section 2 — dialog behaviour and copy

**One mount, in `app/[locale]/layout.tsx`** — the only point above both `(site)` and `(play)`. The
auth dialog is mounted there for the same reason, recorded in that file.

**The safe answer is the default.** Focus opens on "stay"; Escape and the backdrop both mean stay;
`showCloseButton={false}` removes a fourth exit whose meaning is ambiguous. The member's intent was
to leave, so this looks backwards for a moment — but an accidental Enter on "leave" costs the edit
this pattern exists to protect, and on "stay" costs one click.

**Focus returns to the link.** Base UI restores focus to a dialog's trigger, and this dialog has
none — it opens because a store changed. Without handling, "stay" left focus on `<body>` and the
next Tab restarted at the top of the page (WCAG 2.4.3). The dialog captures `document.activeElement`
when it opens and passes it as `finalFocus`; a prevented click never moves focus, so that is the
link.

**Copy** lives at `Common.unsavedChanges.*` — `Common`, not `Settings`, because the pattern is
site-wide and should not carry its first consumer's name.

| Key     | TR                                                         | EN                                                      |
| ------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `title` | Kaydedilmemiş değişikliklerin var                          | You have unsaved changes                                |
| `body`  | Bu sayfadan ayrılırsan yaptığın değişiklikler kaydedilmez. | If you leave this page, your changes will not be saved. |
| `stay`  | Sayfada kal                                                | Stay on this page                                       |
| `leave` | Yine de ayrıl                                              | Leave anyway                                            |

`title` is the `DialogTitle` and `body` the `DialogDescription`, so both are wired to
`aria-labelledby`/`aria-describedby` by the primitive.

## Section 3 — what a test holds, and what it cannot

The vitest environment here is `node` with no jsdom, so nothing in this repo can render a dialog
and click it. That shapes the split:

**Held by unit tests** (`lib/forms/unsaved-changes.test.ts`, 14 cases). The store is deliberately
free of React and the DOM so its rules are directly testable: a clean store lets navigation
through; a held source blocks it and parks the path; `confirmLeave` returns the path exactly once;
cancel forgets the path but keeps the hold; a second blocked click overwrites the pending path; the
count survives a double release; `releaseAll` unblocks the confirmed leave; the server snapshot is
empty so SSR never renders the dialog.

**Held by a structural test** (`lib/forms/navigation-import-discipline.test.ts`, 5 cases). Exactly
two files may import the raw primitives; `useRouter` from `next/navigation` is allowed only in the
recorded files; nothing imports `next/link`; `i18n/navigation.ts` exports the guarded pair. This is
the test the rule needed — `CLAUDE.md` had stated it since before this task and nothing enforced it.

**Not held by any test, and verified by hand instead.** That a click actually opens the dialog,
that focus lands on "stay" and returns to the link, that Escape means stay, and that the pushed
path is not double-prefixed under `/en`. All four were exercised in the browser on
`/kayit` and `/en/register`; the measurements are in the commit message.

## What was not verified

`/hesabim/ayarlar` itself. It is behind a verified account, and reaching one locally needs the
API's `MAIL_TRANSPORT` flipped to `noop` and the dev API restarted — it runs in a container as
root, which is a bigger intervention than this task warrants. The three settings cards call the
same hook the registration wizard does, through the same guarded `Link`; what is unverified is
each card's own dirty comparison, not the mechanism.

The first person who can sign in locally should type into each of the three cards, click a header
link, and confirm the dialog appears — and that saving first makes it stop appearing.
