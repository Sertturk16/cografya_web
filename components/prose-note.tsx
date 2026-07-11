/**
 * ProseNote — renders a plain note-field string as one or more <p> paragraphs.
 *
 * PARAGRAPH-BREAK CONVENTION (locked 2026-07-11, → task il-detay-paragraf):
 * the plain-string note fields on detail entities — `landformNoteTr`,
 * `hydrographyNoteTr`, `settlementNoteTr`, and any future string-note field — MAY
 * use a DOUBLE-NEWLINE ("\n\n") as a paragraph separator, exactly like a blank line
 * in markdown. This is a content-formatting convention WITHIN the string; the DTO
 * stays a plain `string | null`, so there is no schema/contract change (the api still
 * sends one string). Use it when a single field genuinely covers distinct topics —
 * e.g. `landformNoteTr` carrying a general-relief paragraph AND a separate
 * earthquake/KAF-risk paragraph — so they read as two blocks, not one wall of text.
 *
 * A field with NO "\n\n" yields exactly one paragraph and renders identically to a
 * bare <p>{text}</p>. So every province whose notes don't use the convention (all of
 * them today) is visually unchanged — this ships as capability first, content follows.
 *
 * SEO: this is a server component (no "use client") — a pure server-side string
 * split, so the <p> tags are in the first HTML response (CONVENTIONS §6 #1, never
 * client-only). A11y: emitting distinct <p> elements for distinct topics is more
 * semantically correct than one giant paragraph, not a regression.
 *
 * The pure split is exported separately so it is unit-testable once the web test
 * harness lands (Faz-2).
 */
export function splitNoteParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n") // normalize Windows line endings before splitting
    .split(/\n{2,}/) // a paragraph break is a blank line ("\n\n", tolerant of 3+)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

interface ProseNoteProps {
  /** Raw note-field string; may embed "\n\n" paragraph separators (see above). */
  text: string;
  /** CSS-module class applied to every rendered <p> (e.g. the section's `prose`). */
  className?: string;
}

export function ProseNote({ text, className }: ProseNoteProps) {
  const paragraphs = splitNoteParagraphs(text);

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        // Static, server-rendered content derived once from `text` and never
        // re-ordered at runtime, so the array index is a stable key here (same
        // pattern as Breadcrumb's list).
        <p key={index} className={className}>
          {paragraph}
        </p>
      ))}
    </>
  );
}
