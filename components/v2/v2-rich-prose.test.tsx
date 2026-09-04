import { describe, it, expect } from "vitest";
import { cleanAndSplitParagraphs } from "./v2-rich-prose";

describe("cleanAndSplitParagraphs", () => {
  it("strips leading > blockquote markers from lines", () => {
    const raw =
      "> First line\n> Second line of same paragraph.\n\n> Second paragraph\n> continues here.";
    const result = cleanAndSplitParagraphs(raw);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("First line\nSecond line of same paragraph.");
    expect(result[1]).toBe("Second paragraph\ncontinues here.");
  });

  it("handles text with no blockquote markers", () => {
    const raw = "Paragraph 1\n\nParagraph 2";
    const result = cleanAndSplitParagraphs(raw);
    expect(result).toEqual(["Paragraph 1", "Paragraph 2"]);
  });

  it("normalizes Windows CRLF line endings", () => {
    const raw = "> Para 1\r\n\r\n> Para 2";
    const result = cleanAndSplitParagraphs(raw);
    expect(result).toEqual(["Para 1", "Para 2"]);
  });

  it("ignores extra empty newlines", () => {
    const raw = "\n\n\n> Para 1\n\n\n\n> Para 2\n\n";
    const result = cleanAndSplitParagraphs(raw);
    expect(result).toEqual(["Para 1", "Para 2"]);
  });
});
