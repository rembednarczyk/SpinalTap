import { describe, expect, it } from "vitest";
import { stepsInclineAgainst } from "./steps-incline";

/** The glitch scan's check `steps-incline-against` (G-236) on a slope rising along x by 0.1 m a metre. */

const way = (id: string, tags: Record<string, string>, ...pts: [number, number][]) => ({ id, tags, line: pts.map(([x, z]) => ({ x, z })) });
const slope = (p: { x: number }) => p.x / 10;
const everywhere = () => true;

describe("steps against their incline (G-236)", () => {
  it("finds a flight tagged against the slope by 0.3 m or more, end to end", () => {
    expect(stepsInclineAgainst([way("w1", { highway: "steps", incline: "down" }, [0, 0], [5, 0])], slope, everywhere)).toEqual([
      { at: "0,0", what: "w1 incline=down but the terrain rises 0.50 m end to end" },
    ]);
    expect(stepsInclineAgainst([way("w2", { highway: "steps", incline: "up" }, [5, 0], [2, 4], [0, 0])], slope, everywhere)).toEqual([
      { at: "5,0", what: "w2 incline=up but the terrain falls 0.50 m end to end" },
    ]);
  });

  it("finds nothing along the slope, under 0.3 m against it, untagged, not steps or off the map", () => {
    const up = way("w1", { highway: "steps", incline: "up" }, [0, 0], [5, 0]);
    expect(stepsInclineAgainst([up], slope, everywhere)).toEqual([]);
    expect(stepsInclineAgainst([way("w2", { highway: "steps", incline: "down" }, [0, 0], [2.9, 0])], slope, everywhere)).toEqual([]);
    expect(stepsInclineAgainst([way("w3", { highway: "steps" }, [5, 0], [0, 0])], slope, everywhere)).toEqual([]);
    expect(stepsInclineAgainst([way("w4", { highway: "footway", incline: "up" }, [5, 0], [0, 0])], slope, everywhere)).toEqual([]);
    expect(stepsInclineAgainst([way("w5", { highway: "steps", incline: "up" }, [5, 0], [0, 0])], slope, (p) => p.x < 4)).toEqual([]);
  });
});
