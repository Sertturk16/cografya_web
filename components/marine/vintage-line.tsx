import { getFormatter, getTranslations } from "next-intl/server";
import type { MarineValue } from "@/lib/api/types";
import { MODEL_INSTANT_FORMAT } from "@/lib/marine/model-run";
import { buildMarineVintage, type MarineVintageGroup } from "@/lib/marine/vintage";
import styles from "./marine.module.css";

interface VintageLineProps {
  /** Every value the surrounding block displays; grouping is derived from it. */
  values: readonly MarineValue[];
}

/** Provider → `Marine.source.*`, exhaustive by type (same reasoning as the unit map). */
const SOURCE_KEY: Record<"cmems" | "ecmwf", string> = {
  cmems: "source.cmems",
  ecmwf: "source.ecmwf",
};

/**
 * The künye: which model instant these numbers belong to and which run produced them, ONE
 * LINE PER PROVIDER.
 *
 * A single page-wide "last updated" would be a quiet lie whenever the two providers are an
 * hour apart, which they routinely are — wind is ECMWF, sea temperature is CMEMS, and the
 * Marmara's wave height can come from a different provider than the wave height beside it.
 * The contract carries `source` per field precisely so this cannot be papered over, so the
 * grouping here is read from the data and there is no provider table in this component.
 *
 * Absolute UTC only. A relative phrase ("2 saat önce") is computed once at render and then
 * cached by ISR into being actively wrong; an absolute instant merely gets older.
 *
 * Nothing is rendered when no displayed value carries a künye — an empty "Kaynak:" line is
 * worse than no line.
 */
export async function VintageLine({ values }: VintageLineProps) {
  const tm = await getTranslations("Marine");
  const format = await getFormatter();

  const groups = buildMarineVintage(values);
  if (groups.length === 0) return null;

  const instant = (date: Date) => format.dateTime(date, MODEL_INSTANT_FORMAT);

  /** The one sentence a group can honestly say, given which of its two instants exist. */
  const sentence = (group: MarineVintageGroup, source: string): string | null => {
    if (group.validAt !== null && group.modelRunAt !== null) {
      return tm("vintage.validAtAndRun", {
        source,
        validAt: instant(group.validAt),
        modelRun: instant(group.modelRunAt),
      });
    }
    if (group.validAt !== null) {
      return tm("vintage.validAt", { source, validAt: instant(group.validAt) });
    }
    if (group.modelRunAt !== null) {
      return tm("vintage.runOnly", { source, modelRun: instant(group.modelRunAt) });
    }
    // Unreachable: `buildMarineVintage` drops a group with neither instant. Kept so the
    // "null is omitted, never filled" rule holds even if that ever changes.
    return null;
  };

  return (
    <ul className={styles.vintageList}>
      {groups.map((group) => {
        // Widened deliberately: `tsc` covers today's two providers, this local covers a
        // third one arriving before the web regenerates its types. A provider we cannot
        // name gets no line rather than a line labelled "Marine".
        const sourceKey: string | undefined = SOURCE_KEY[group.source];
        if (sourceKey === undefined) return null;

        const text = sentence(group, tm(sourceKey));
        if (text === null) return null;

        return <li key={group.source}>{text}</li>;
      })}
    </ul>
  );
}
