import { describe, expect, it } from "vitest";
import { RendererStats, type RendererStatsDeps } from "../src/renderer/renderer-stats";

/** The parts `citySettled` reads: the map's cells, the wet probe, the metro and the moon shadow. */
const stats = (shadowSettled: boolean, mapSettled = true): RendererStats =>
  new RendererStats({ map: { current: { settled: mapSettled } }, wet: null, metro: { active: false }, shadow: { settled: shadowSettled } } as unknown as RendererStatsDeps);

describe("renderer stats", () => {
  it("the city is settled for a sample only once the moon shadow keeps its statics, drawn (#553)", () => {
    expect(stats(true).citySettled).toBe(true);
    expect(stats(false).citySettled).toBe(false);
    expect(stats(true, false).citySettled).toBe(false);
  });
});
