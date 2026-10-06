/**
 * The message namespaces client components read, and the one function that cuts a catalogue down
 * to them for `NextIntlClientProvider` in `app/[locale]/layout.tsx`.
 *
 * Without a `messages` prop next-intl serialises the WHOLE catalogue into every page's RSC
 * payload, so a page carried `Privacy`, `Deniz`, `CountryDetail` and every other server-only
 * namespace in its HTML. Server components read the full catalogue through the request config
 * either way; only the client side is scoped here.
 *
 * `client-messages.test.ts` walks the runtime import closure of every `"use client"` file and
 * fails when a client `useTranslations("X")` namespace is missing here, when an entry here has no
 * client reader left, or when a client file reaches messages any other way (`useMessages`, a
 * computed namespace, `useTranslations()` with none). A dotted entry ships that sub-tree only.
 */
export const CLIENT_MESSAGE_NAMESPACES = [
  "Auth",
  "BookDetail",
  "Common",
  "Error",
  "Favorites",
  "Map",
  "MapExplorer",
  "Measurements",
  "Search",
  "Settings",
  "ToolWorkbench",
] as const satisfies readonly string[];

type MessageTree = { [key: string]: unknown };

/**
 * `messages` reduced to the dotted `paths` (default {@link CLIENT_MESSAGE_NAMESPACES}), each
 * kept at its own position in the tree. A path the catalogue lacks is skipped; the test above
 * pins that every listed entry exists in both catalogues.
 */
export function pickClientMessages<M extends MessageTree>(
  messages: M,
  paths: readonly string[] = CLIENT_MESSAGE_NAMESPACES,
): M {
  const picked: MessageTree = {};
  for (const path of paths) {
    const parts = path.split(".");
    let source: unknown = messages;
    for (const part of parts) {
      source =
        typeof source === "object" && source !== null ? (source as MessageTree)[part] : undefined;
    }
    if (source === undefined) continue;

    let target = picked;
    for (const part of parts.slice(0, -1)) {
      const next = target[part];
      target = (
        typeof next === "object" && next !== null ? next : (target[part] = {})
      ) as MessageTree;
    }
    target[parts.at(-1)!] = source;
  }
  return picked as M;
}
