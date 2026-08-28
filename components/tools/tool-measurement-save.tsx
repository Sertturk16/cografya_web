"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { MeasurementType } from "@/lib/api/types";
import type { AuthSessionState } from "@/lib/auth/use-session.client";
import { saveMeasurement, type MeasurementRecord } from "@/lib/measurements/client";
import type { GeoPoint } from "@/lib/map/measure";
import { LockIcon } from "@/components/lock-icon";
import styles from "./tools.module.css";

/**
 * The login-gated "save this measurement" control (UYELIK-12 plan §5.5) — modelled on
 * `GameRoundSaveControl`'s shape (`idle -> pending -> saved | failed` states,
 * `aria-disabled` throughout — never real `disabled`, for the same A11Y96-I1 reason: this
 * is one persistent node whose meaning changes over time without unmounting; a sr-only
 * `role="status"` announcement mirroring the visible label change; the shared
 * `components/lock-icon.tsx` `compact` variant + `aria-label` in the anonymous branch;
 * `getPathname({ locale, href: "/kayit" })` + `next/navigation`'s own `useRouter`, not
 * `@/i18n/navigation`'s — the `CODE85-M5` reasoning every sibling already carries).
 *
 * `mode` is typed {@link MeasurementType}, not `tool-island.tsx`'s own `ToolMode` (plan
 * §5.1's deliberate choice, restated here): the two are structurally identical three-
 * literal unions, and typing this prop from the leaf `lib/api/types` alias — rather than
 * importing a type from the sibling that itself imports THIS component — avoids a
 * circular module reference for no behavioral difference. The actual drift gate is the
 * `saveMeasurement({ type: mode, ... })` call below: if the contract's own `type` enum
 * ever diverges from `ToolMode`'s three literals, that call site fails `tsc`.
 *
 * A GENUINE ADDITION BEYOND the `GameRoundSaveControl` shape (a round is always
 * "complete" when its save control mounts; a tool's points are not): an optional title
 * input, and `aria-disabled` also covers "too few points to save yet" — folded into the
 * SAME single boolean the pending/saved reasons already compute, rather than adopting
 * `tool-island.tsx`'s sibling undo/clear/download buttons' real-`disabled` convention
 * (those buttons never carry an in-flight async status the way this one does).
 */
export function ToolMeasurementSave({
  mode,
  points,
  minPoints,
  authState,
  locale,
  getPendingSaveId,
  setPendingSaveId,
  onSaved,
}: {
  readonly mode: MeasurementType;
  readonly points: readonly GeoPoint[];
  readonly minPoints: number;
  readonly authState: AuthSessionState;
  readonly locale: Locale;
  readonly getPendingSaveId: () => string | null;
  readonly setPendingSaveId: (id: string) => void;
  readonly onSaved: (measurement: MeasurementRecord) => void;
}) {
  const t = useTranslations("Measurements");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "saved" | "failed" | "quota-exceeded">(
    "idle",
  );

  /**
   * NOT part of the plan's own enumerated lifecycle (§5.4 item 6 only names when the
   * PARENT-owned pending-save id is cleared), but load-bearing for correctness: unlike
   * `GameRoundSaveControl` — whose docblock states a genuine replay unmounts/remounts the
   * whole control, resetting it for free — this component stays mounted across an
   * arbitrary number of point mutations on the same tool page. Without this reset, a
   * `"saved"` (or `"failed"`/`"quota-exceeded"`) status from one geometry would otherwise
   * stick permanently once the reader placed a DIFFERENT set of points, showing a
   * permanently-disabled "Kaydedildi" button for geometry that was never saved.
   *
   * "Adjusting state when a prop changes", done DURING RENDER rather than inside a
   * `useEffect` (react.dev's own recommended pattern, and the one
   * `react-hooks/set-state-in-effect` — this repo's ESLint rule set — asks for): a
   * conditional `setState` call here runs before the browser paints, with no extra
   * effect-triggered render. Never resets WHILE a save is genuinely in flight
   * (`"pending"`), so an undo/clear that fires mid-request does not stomp the eventual
   * `handleClick` result.
   */
  const [previousPoints, setPreviousPoints] = useState(points);
  if (points !== previousPoints) {
    setPreviousPoints(points);
    if (status !== "pending") setStatus("idle");
  }

  const belowMinPoints = points.length < minPoints;

  async function handleClick() {
    if (authState === "checking" || status === "pending" || status === "saved" || belowMinPoints) {
      return;
    }
    if (authState === "anonymous") {
      const dest = getPathname({ locale, href: "/kayit" });
      router.push(`${dest}?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setStatus("pending");
    let clientMeasurementId = getPendingSaveId();
    if (clientMeasurementId === null) {
      clientMeasurementId = crypto.randomUUID();
      setPendingSaveId(clientMeasurementId);
    }
    const trimmedTitle = title.trim();
    const result = await saveMeasurement({
      type: mode,
      points,
      title: trimmedTitle.length > 0 ? trimmedTitle : undefined,
      clientMeasurementId,
    });
    if (result.ok) {
      onSaved(result.measurement);
      setStatus("saved");
      return;
    }
    // The pending-id ref is deliberately NOT cleared here (plan §5.4 item 6/§10 item 1) —
    // a genuinely-changed point set clears it on its own via the effect above's sibling
    // mutation handlers in `tool-island.tsx`; the SAME points stay retriable with the SAME
    // idempotency key once the reader frees quota elsewhere or the transport recovers.
    setStatus(result.code === "quota-exceeded" ? "quota-exceeded" : "failed");
  }

  const pending = status === "pending";
  const saved = status === "saved";

  return (
    <div className={styles.savePanel}>
      <div className={styles.titleField}>
        <label className={styles.label} htmlFor="tool-measurement-title">
          {t("titleLabel")}
        </label>
        <input
          id="tool-measurement-title"
          className={styles.input}
          type="text"
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      {authState === "checking" ? (
        // Renders in the SAME interactive shape the authenticated/not-yet-saved branch
        // below does — never the lock-icon shape, which would assert "sign-in required"
        // before the real state is even known.
        <button type="button" className="btn btn-primary" aria-disabled={true}>
          {t("saveLabel")}
        </button>
      ) : authState === "anonymous" ? (
        <button
          type="button"
          className="btn btn-ghost"
          aria-label={t("signInRequiredAria")}
          onClick={() => void handleClick()}
        >
          <LockIcon variant="compact" />
          {t("saveLabel")}
        </button>
      ) : saved ? (
        // A11Y96-I1 posture: NEVER a real `disabled` attribute — this is the SAME DOM node
        // the reader just clicked and is still focused; a real `disabled` yanks focus
        // silently with no AT announcement (WCAG 4.1.3).
        <button type="button" className="btn btn-primary" aria-disabled={true}>
          {t("savedLabel")}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          aria-disabled={pending || belowMinPoints}
          onClick={() => void handleClick()}
        >
          {t("saveLabel")}
        </button>
      )}

      {saved && (
        // The visible label change alone is not reliably announced by AT — the same
        // mechanism `GameRoundSaveControl`'s own sr-only paragraph uses for the identical
        // "Kaydet" -> "Kaydedildi" transition.
        <p role="status" className={styles.srOnly}>
          {t("savedLabel")}
        </p>
      )}
      {status === "failed" && (
        <p role="status" className={styles.error}>
          {t("saveError")}
        </p>
      )}
      {status === "quota-exceeded" && (
        // Distinct copy from the generic failure above (plan §5.5/§10 item 2) — a quota
        // failure will not be fixed by retrying the same click.
        <p role="status" className={styles.error}>
          {t("saveQuotaError")}
        </p>
      )}
    </div>
  );
}
