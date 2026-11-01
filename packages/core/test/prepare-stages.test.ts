import { describe, expect, it } from "vitest";
import { PREPARE_STAGES, type PrepareStage, type RenderPort } from "../src";

describe("RenderPort.prepare (ADR-0057)", () => {
  it("names the four stages of the loading screen in their order", () => {
    expect(PREPARE_STAGES).toEqual(["models", "cityKit", "city", "shaders"]);
  });

  it("is optional: a port without it is still a RenderPort", async () => {
    const bare: Pick<RenderPort, "prepare"> = {};
    expect(bare.prepare).toBeUndefined();
    const seen: PrepareStage[] = [];
    const port: Pick<RenderPort, "prepare"> = {
      prepare: async (_at, onProgress) => {
        for (const [i, stage] of PREPARE_STAGES.entries()) onProgress((i + 1) / PREPARE_STAGES.length, stage);
      },
    };
    await port.prepare?.({ x: 0, y: 0, z: 0 }, (_done, stage) => seen.push(stage));
    expect(seen).toEqual([...PREPARE_STAGES]);
  });
});
