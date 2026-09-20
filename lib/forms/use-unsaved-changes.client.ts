"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getUnsavedChangesServerSnapshot,
  getUnsavedChangesSnapshot,
  holdUnsavedChanges,
  subscribeUnsavedChanges,
  type UnsavedChangesState,
} from "./unsaved-changes";

/**
 * The one line a form with unsaved edits adds (T-062).
 *
 * `dirty` is the CALLER's to compute, deliberately. The three settings cards and the registration
 * wizard already seed their fields from a profile object, so "current values ≠ the snapshot they
 * started from" is a comparison they can already make; a hook that owned form state would be a
 * form library, and this repo does not have one. The password card is the shape that shows why
 * the caller must decide: its initial values are empty strings, so dirty there means "anything
 * has been typed", not "differs from the server".
 *
 * While `dirty` is true this component holds a source in the store, which
 * `components/v2/v2-unsaved-changes-dialog.tsx` and the guarded `Link` both read. It releases
 * on `dirty` going false and on unmount — so a form that navigates away after a successful save
 * needs no special handling beyond letting `dirty` go false.
 *
 * ## `beforeunload` is a second channel, not a second truth
 *
 * Tab close, reload and typing a new URL never reach React, so they need the browser's own
 * warning. It is attached here rather than in the dialog because the condition is identical, and
 * two places computing "is anything dirty" is how the two answers start disagreeing. The browser
 * ignores any message a page supplies and shows its own wording, which is why this hook takes no
 * message argument: one of the two channels would silently drop it.
 */
export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const release = holdUnsavedChanges();

    const warn = (event: BeforeUnloadEvent) => {
      // `preventDefault()` is the specified way to ask for the dialog; `returnValue` is the
      // legacy one Safari still needs. Both, because either alone leaves a browser out.
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
      release();
    };
  }, [dirty]);
}

/** The store, for the dialog and the guarded navigation primitives. */
export function useUnsavedChangesState(): UnsavedChangesState {
  return useSyncExternalStore(
    subscribeUnsavedChanges,
    getUnsavedChangesSnapshot,
    getUnsavedChangesServerSnapshot,
  );
}
