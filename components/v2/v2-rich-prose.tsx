import React, { type ComponentProps } from "react";
import { Link } from "@/i18n/navigation";

interface V2RichProseProps {
  text?: string | null;
  className?: string;
  paragraphClassName?: string;
}

type LinkHref = ComponentProps<typeof Link>["href"];

/**
 * Parses markdown inline formats:
 * - Links: [Text](/url) -> <Link href="/url">Text</Link>
 * - Bold: **Text** -> <strong className="font-semibold text-foreground">Text</strong>
 * - Inline code: `code` -> <code className="...">code</code>
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  // Regex to find links, bold, or code
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      // Link [text](href)
      const label = match[2];
      const href = match[3];
      nodes.push(
        <Link
          key={`link-${match.index}`}
          href={href as unknown as LinkHref}
          className="text-primary font-medium underline underline-offset-2 hover:text-primary/80 transition-colors"
        >
          {label}
        </Link>,
      );
    } else if (match[4]) {
      // Bold **text**
      nodes.push(
        <strong key={`bold-${match.index}`} className="font-semibold text-foreground">
          {match[4]}
        </strong>,
      );
    } else if (match[5]) {
      // Code `code`
      nodes.push(
        <code
          key={`code-${match.index}`}
          className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-foreground border border-border"
        >
          {match[5]}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Cleans text from raw markdown quotes, normalizes newlines, and splits into paragraphs.
 */
export function cleanAndSplitParagraphs(raw: string): string[] {
  return (
    raw
      .replace(/\r\n/g, "\n")
      // Strip leading `> ` or `>` from any line
      .replace(/^[ \t]*>[ \t]?/gm, "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
  );
}

export function V2RichProse({
  text,
  className = "space-y-4",
  paragraphClassName = "text-sm sm:text-base text-muted-foreground leading-relaxed",
}: V2RichProseProps) {
  if (!text) return null;

  const paragraphs = cleanAndSplitParagraphs(text);

  return (
    <div className={className}>
      {paragraphs.map((para, idx) => (
        <p key={idx} className={paragraphClassName}>
          {parseInlineMarkdown(para)}
        </p>
      ))}
    </div>
  );
}
