import type { TelemetryWheel } from "@seki/core";
import { describe, expect, it } from "vitest";
import { feedTelemetry } from "../src/telemetry-feed";

/** The driven car's telemetry to the renderer (ADR-0097 §3, `?telemetry=1`): nothing on foot. */
describe("the telemetry's feed (ADR-0097 §3)", () => {
  it("sends none on foot", () => {
    const sent: (readonly TelemetryWheel[] | null)[] = [];
    const sim = { session: { driving: null }, world: { with: () => ({ entities: [] }) } } as never;
    feedTelemetry({ update: (w) => sent.push(w) }, sim);
    expect(sent).toEqual([null]);
  });
});
