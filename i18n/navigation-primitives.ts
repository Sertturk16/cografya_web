import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * next-intl's raw navigation primitives.
 *
 * NOTHING OUTSIDE `i18n/navigation.ts` AND `i18n/guarded-navigation.client.tsx`
 * SHOULD IMPORT FROM HERE. This file exists only so the unsaved-changes guard (T-062) can wrap
 * `Link` and `useRouter` without importing the module that re-exports its own wrappers, which
 * would be a cycle. `i18n/navigation.ts` stays the one public door, and
 * `lib/forms/navigation-import-discipline.test.ts` keeps this file's consumer list at those two.
 */
export const {
  Link: RawLink,
  redirect,
  usePathname,
  useRouter: useRawRouter,
  getPathname,
} = createNavigation(routing);
