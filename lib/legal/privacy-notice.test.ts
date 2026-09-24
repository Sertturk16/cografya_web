import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import tr from "@/messages/tr.json";

/**
 * T-101: `/gizlilik` reads its lists through `t.raw`, which `key-existence.test.ts` cannot see,
 * so the two locales' SHAPES are pinned here — and the facts the notice must carry are pinned
 * in the binding (Turkish) text, so an edit that drops a provider or a retention period is red.
 */
function shape(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(shape);
  if (node && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, shape(value)]));
  }
  return typeof node;
}

describe("Privacy namespace", () => {
  it("has the same keys, list lengths and nesting in both locales", () => {
    expect(shape(en.Privacy)).toEqual(shape(tr.Privacy));
  });

  it("names every provider the site's data reaches, with its country", () => {
    const names = tr.Privacy.recipients.map((recipient) => recipient.name).join(" | ");
    for (const provider of ["Hetzner Online GmbH", "Amazon SES", "Cloudflare, Inc.", "YouTube"]) {
      expect(names).toContain(provider);
    }
    const locations = tr.Privacy.recipients.map((recipient) => recipient.location).join(" | ");
    expect(locations).toContain("Avrupa Birliği");
    expect(locations).toContain("eu-north-1");
    expect(locations).toContain("ABD");
  });

  it("states the retention periods the api enforces and the 5651 log period", () => {
    const retention = tr.Privacy.retentionItems.join(" ");
    expect(retention).toContain("hesabını silene kadar");
    expect(retention).toContain("10 dakika");
    expect(retention).toContain("30 dakika");
    expect(retention).toContain("1 gün");
    expect(retention).toContain("5651");
    expect(retention).toContain("2 yıl");
  });

  it("cites the legal grounds, consent only for commercial messages", () => {
    const grounds = tr.Privacy.legalItems.join(" ");
    for (const ground of ["5/2-c", "5/2-ç", "5/2-f", "5/1"]) expect(grounds).toContain(ground);
    expect(tr.Privacy.legalItems.find((item) => item.includes("5/1"))).toContain(
      "ticari elektronik ileti",
    );
  });

  it("no longer embeds the KVKK text in the terms", () => {
    expect(Object.keys(tr.Terms).filter((key) => key.startsWith("kvkk"))).toEqual([]);
    expect(tr.Terms.scopeBody).not.toContain("telemetri");
  });
});
