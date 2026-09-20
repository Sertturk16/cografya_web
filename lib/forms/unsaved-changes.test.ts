import { describe, expect, it, vi } from "vitest";
import { createUnsavedChangesStore } from "./unsaved-changes";

/**
 * The unsaved-changes store (T-062), exercised through the factory rather than the module
 * singleton so each case starts clean. Everything here is plain values — the point of keeping the
 * DOM out of this file is that these rules are testable at all in a `node` vitest environment
 * with no jsdom.
 */
describe("the unsaved-changes store", () => {
  describe("with nothing dirty", () => {
    it("lets a navigation through and records nothing", () => {
      const store = createUnsavedChangesStore();
      expect(store.guard("/hesabim")).toBe(true);
      expect(store.getSnapshot().pendingPath).toBeNull();
    });

    it("has a server snapshot that is the empty state, so SSR never renders the dialog", () => {
      const store = createUnsavedChangesStore();
      store.hold();
      expect(store.getServerSnapshot().dirtyCount).toBe(0);
      expect(store.getServerSnapshot().pendingPath).toBeNull();
    });
  });

  describe("with a form holding edits", () => {
    it("blocks the navigation and parks where it was going", () => {
      const store = createUnsavedChangesStore();
      store.hold();

      expect(store.guard("/kitaplar")).toBe(false);
      expect(store.getSnapshot().pendingPath).toBe("/kitaplar");
    });

    it("hands the parked path back exactly once on confirm", () => {
      const store = createUnsavedChangesStore();
      store.hold();
      store.guard("/kitaplar");

      expect(store.confirmLeave()).toBe("/kitaplar");
      expect(store.confirmLeave()).toBeNull();
      expect(store.getSnapshot().pendingPath).toBeNull();
    });

    it("forgets the parked path on cancel, and the form is still held", () => {
      const store = createUnsavedChangesStore();
      store.hold();
      store.guard("/kitaplar");

      store.cancelLeave();

      expect(store.getSnapshot().pendingPath).toBeNull();
      expect(store.getSnapshot().dirtyCount).toBe(1);
      // Still guarded: cancelling means "stay", not "stop asking".
      expect(store.guard("/oyun")).toBe(false);
    });

    it("honours the member's latest intent when a second link is clicked", () => {
      const store = createUnsavedChangesStore();
      store.hold();

      store.guard("/kitaplar");
      store.guard("/oyun");

      expect(store.getSnapshot().pendingPath).toBe("/oyun");
    });

    it("keeps the query and hash of the path it was given", () => {
      const store = createUnsavedChangesStore();
      store.hold();
      store.guard("/turkiye?il=34#nufus");
      expect(store.confirmLeave()).toBe("/turkiye?il=34#nufus");
    });
  });

  describe("counting sources rather than flagging one", () => {
    /**
     * `/hesabim/ayarlar` renders three independent forms and any subset can be dirty at once. A
     * boolean would be written by whichever of them re-rendered last, so the third form saving
     * would clear a warning the first form still needs.
     */
    it("stays guarded while any one of three forms is still dirty", () => {
      const store = createUnsavedChangesStore();
      const personal = store.hold();
      const education = store.hold();
      store.hold();

      personal();
      education();

      expect(store.getSnapshot().dirtyCount).toBe(1);
      expect(store.guard("/hesabim")).toBe(false);
    });

    it("lets navigation through once the last form releases", () => {
      const store = createUnsavedChangesStore();
      const first = store.hold();
      const second = store.hold();

      first();
      second();

      expect(store.getSnapshot().dirtyCount).toBe(0);
      expect(store.guard("/hesabim")).toBe(true);
    });

    /**
     * React 19 Strict Mode double-invokes effects, so a cleanup runs twice in development. A
     * release that decremented a counter would take the count negative and un-guard a page that
     * still has two dirty forms on it.
     */
    it("survives a release being called twice", () => {
      const store = createUnsavedChangesStore();
      const release = store.hold();
      store.hold();

      release();
      release();

      expect(store.getSnapshot().dirtyCount).toBe(1);
      expect(store.guard("/hesabim")).toBe(false);
    });

    it("drops every source on releaseAll, so the confirmed leave is not itself blocked", () => {
      const store = createUnsavedChangesStore();
      store.hold();
      store.hold();
      store.guard("/kitaplar");
      const path = store.confirmLeave();

      store.releaseAll();

      expect(path).toBe("/kitaplar");
      expect(store.getSnapshot().dirtyCount).toBe(0);
      expect(store.guard("/kitaplar")).toBe(true);
    });
  });

  describe("subscriptions", () => {
    it("notifies on hold, release, guard, confirm and cancel", () => {
      const store = createUnsavedChangesStore();
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      const release = store.hold();
      store.guard("/kitaplar");
      store.cancelLeave();
      store.guard("/oyun");
      store.confirmLeave();
      release();

      expect(listener).toHaveBeenCalledTimes(6);
      unsubscribe();
      store.hold();
      expect(listener).toHaveBeenCalledTimes(6);
    });

    it("does not notify for a cancel with nothing pending", () => {
      const store = createUnsavedChangesStore();
      const listener = vi.fn();
      store.subscribe(listener);

      store.cancelLeave();

      expect(listener).not.toHaveBeenCalled();
    });

    it("returns a stable snapshot object between commits, so useSyncExternalStore settles", () => {
      const store = createUnsavedChangesStore();
      store.hold();
      const first = store.getSnapshot();
      expect(store.getSnapshot()).toBe(first);
    });
  });
});
