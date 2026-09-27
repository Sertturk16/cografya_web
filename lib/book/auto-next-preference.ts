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
