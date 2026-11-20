import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { LUBLIN_PROP_TABLE } from "../../../packages/sim/src/content/lublin/props.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { CENTRE, WALL_PLATE, streetEnds, streetStart } from "../src/props-plates.ts";
import { Site } from "../src/props-site.ts";

/*
 * The streets' name plates at each street's start (ADR-0094 stage 3, the user's decision of 20.11),
 * on the corner walls: the start is the end its house numbers start from, or without addresses the
 * end nearer the town's centre; a street cut by the chunks' edges keeps only its true ends.
 */
describe("the streets' name plates at their starts (ADR-0094 stage 3)", () => {
  // A street cut in two by a chunk's edge at x 50: the cut's ends meet, the street's own do not.
  const lines = [
    [{ x: 0, z: 0 }, { x: 50, z: 0 }],
    [{ x: 50, z: 0 }, { x: 100, z: 0 }],
  ];

  it("finds a street's own ends, not where the chunks cut it", () => {
    const ends = streetEnds(lines);
    expect(ends.map((e) => e.p.x).sort((a, b) => a - b)).toEqual([0, 100]);
    expect(ends.find((e) => e.p.x === 0)!.into).toEqual({ x: 1, z: 0 });
  });

  it("starts a street at the end of its lowest house number", () => {
    const ends = streetEnds(lines);
    const addresses = [
      { street: "X", number: 12, p: { x: 10, z: 8 } },
      { street: "X", number: 1, p: { x: 95, z: 8 } },
    ];
    expect(streetStart(ends, addresses)!.p.x).toBe(100);
  });

  it("starts a street with no addresses at the end nearer the town's centre", () => {
    const far = [[{ x: CENTRE.x + 10, z: CENTRE.z }, { x: CENTRE.x + 300, z: CENTRE.z }]];
    expect(streetStart(streetEnds(far), [])!.p.x).toBe(CENTRE.x + 10);
  });

  it("hangs the city's plates flat on walls, their backs on a facade", () => {
    const site = new Site([...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS]);
    const plates = Object.values(LUBLIN_PROP_TABLE).flatMap((kinds) => {
      const a = kinds["street-plate"] ?? [];
      const out: { x: number; z: number; yaw: number }[] = [];
      for (let i = 0; i + 4 < a.length; i += 5) if (a[i + 4]! % 2 === WALL_PLATE) out.push({ x: a[i]!, z: a[i + 2]!, yaw: a[i + 3]! });
      return out;
    });
    expect(plates.length).toBeGreaterThan(15);
    for (const p of plates) {
      expect(site.surfaceAt(p), `${p.x},${p.z}`).not.toBe("building");
      expect(site.surfaceAt({ x: p.x - Math.sin(p.yaw) * 0.5, z: p.z - Math.cos(p.yaw) * 0.5 }), `${p.x},${p.z}`).toBe("building");
    }
  });
});
