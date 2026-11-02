import { describe, expect, it } from "vitest";
import { stepsAcross, stepsRunsBare } from "./steps-runs";

/**
 * The glitch scan's checks `steps-across-run` and `steps-run-bare` (G-213): a band of steps whose
 * long side lies across its run is found, one along it is not; a run with no band across its
 * middle is found, one covered by strips is not.
 */

type P = { x: number; z: number };
const way = (id: string, tags: Record<string, string>, ...pts: [number, number][]) => ({ id, tags, line: pts.map(([x, z]) => ({ x, z })) });
const rect = (x0: number, z0: number, x1: number, z1: number): P[] => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];
const three = () => 3;
const inAny = (rings: readonly P[][]) => (p: P) => rings.some((r) => p.x >= r[0]!.x && p.x <= r[2]!.x && p.z >= r[0]!.z && p.z <= r[2]!.z);

describe("steps drawn across their run (G-213)", () => {
  // A 1.5 m run along x, 3 m wide.
  const run = way("w1", { highway: "steps" }, [0, 0], [1.5, 0]);

  it("finds a whole band shorter along its run than across, and no strips cut along it", () => {
    expect(stepsAcross([run], three, [rect(0, -1.5, 1.5, 1.5)])).toEqual([{ at: "1,0", what: "w1 run 1.5 m drawn across, band 3.0 × 1.5 m" }]);
    expect(stepsAcross([run], three, [rect(0, -1.5, 1.5, 0), rect(0, 0, 1.5, 1.5)])).toEqual([]);
  });

  it("finds nothing off the map's steps, on a sliver the renderer leaves out, or at a turn along the other run", () => {
    expect(stepsAcross([{ ...run, tags: { highway: "footway" } }], three, [rect(0, -1.5, 1.5, 1.5)])).toEqual([]);
    expect(stepsAcross([run], three, [rect(20, -1.5, 21.5, 1.5)])).toEqual([]);
    expect(stepsAcross([run], three, [rect(0, -1.5, 0.3, 1.5)])).toEqual([]);
    // The turn onto a run along z: the band lies along it.
    expect(stepsAcross([run, way("w2", { highway: "steps" }, [1.5, 0], [1.5, 6])], three, [rect(0, -1.5, 1.5, 1.5)])).toEqual([]);
  });

  it("finds a band across a run of a wider flight by its width", () => {
    const wide = way("w3", { highway: "steps", width: "10" }, [0, 0], [4, 0]);
    expect(stepsAcross([wide], () => 10, [rect(0, 1, 4, 5)])).toHaveLength(0);
    expect(stepsAcross([wide], () => 10, [rect(1, 1, 2.5, 4.5)])).toHaveLength(1);
    expect(stepsAcross([wide], three, [rect(1, 1, 2.5, 4.5)])).toEqual([]);
  });

  it("finds a run with no steps across its middle, and none covered, off the map or underground", () => {
    const onMap = () => true;
    expect(stepsRunsBare([run], three, inAny([]), onMap)).toEqual([{ at: "1,0", what: "w1 run 1.5 m without steps" }]);
    expect(stepsRunsBare([run], three, inAny([rect(0, -1.5, 1.5, 0), rect(0, 0, 1.5, 1.5)]), onMap)).toEqual([]);
    // One strip of two dropped.
    expect(stepsRunsBare([run], three, inAny([rect(0, -1.5, 1.5, 0)]), onMap)).toHaveLength(1);
    expect(stepsRunsBare([run], three, inAny([]), () => false)).toEqual([]);
    expect(stepsRunsBare([{ ...run, tags: { highway: "steps", tunnel: "yes" } }], three, inAny([]), onMap)).toEqual([]);
    expect(stepsRunsBare([{ ...run, tags: { highway: "steps", layer: "-1" } }], three, inAny([]), onMap)).toEqual([]);
  });
});
