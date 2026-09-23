import { describe, expect, it } from "vitest";
import { nationalPopulation } from "./national-population";

const row = (plateCode: string, population: number | null, populationYear: number | null) => ({
  plateCode,
  population,
  populationYear,
});

const all81 = (population: number, year: number) =>
  Array.from({ length: 81 }, (_, i) => row(String(i + 1).padStart(2, "0"), population, year));

describe("nationalPopulation", () => {
  it("sums the 81 provinces and carries their shared year", () => {
    expect(nationalPopulation(all81(1_000_000, 2025))).toEqual({ total: 81_000_000, year: 2025 });
  });

  it("returns null when fewer than 81 provinces arrived (a degraded fetch)", () => {
    expect(nationalPopulation(all81(1_000_000, 2025).slice(0, 80))).toBeNull();
    expect(nationalPopulation([])).toBeNull();
  });

  it("returns null when any province has no population, rather than a partial sum", () => {
    const rows = all81(1_000_000, 2025);
    rows[40] = row("41", null, 2025);
    expect(nationalPopulation(rows)).toBeNull();
  });

  it("returns null when the provinces disagree on the year", () => {
    const rows = all81(1_000_000, 2025);
    rows[5] = row("06", 1_000_000, 2024);
    expect(nationalPopulation(rows)).toBeNull();
  });
});
