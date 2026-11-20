import { describe, expect, it } from "vitest";
import { LUBLIN_PROP_TABLE } from "../../../packages/sim/src/content/lublin/props.generated.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { Site } from "../src/props-site.ts";

/**
 * The frontages' fills (G-853) are no paving the furniture reads: the lamps of Krakowskie
 * Przedmieście stand at the edge of the deptak's setts, where they stood before the fills reached
 * the walls (`props-site.ts`); with them read as paving the lamps went 0.8 to 2.7 m to the walls and
 * a bin went, which took the walker of G-338 between a lamp and a planter (`flee-wall.test.ts`).
 * The one at the deptak's east end stands at 436.4, 0.9 m short of the zebra there: laid from the
 * kerb (G-836), the zebra starts 0.1 m nearer, the lamp's march out meets it a step sooner and it
 * stands 0.6 m short of that step (`sideSpot`); at 436.9 it stood 0.4 m off the zebra. The one at
 * 255.4 stands on its station since ADR-0094 stage 1: the café's garden it slid 2.5 m away from
 * (to 253) stood in a door's clear zone and is gone. The one at 243.2 stands since stage 2: a garden of
 * the deptak's line (no venue behind it) took its place in the row; the gardens stand by their venues now.
 */
const DEPTAK_LAMPS: readonly (readonly [number, number])[] = [
  [-80.1, -59.7], [-67.1, -69.1], [-55.1, -58.5], [-42.2, -67.8], [-30.2, -57.2], [-17.2, -66.5], [-5.2, -55.8], [7.8, -65.1], [32.2, -53.8],
  [45.2, -63.2], [57.2, -52.5], [70.2, -61.9], [92.4, -61], [104.6, -50.6], [117.4, -60.3], [133.8, -58.4], [140.2, -43.7], [155.1, -50.9],
  [168, -44.9], [178.3, -55.9], [192.5, -50.1], [202.6, -61.6], [216.8, -55.9], [226.9, -67.7], [243.2, -62.9], [255.4, -74.9], [269.7, -70.1], [279.5, -81.8],
  [293.8, -76.7], [304.5, -88.2], [320.1, -80.8], [328.8, -90.2], [352.5, -95.7], [367.2, -99.4], [380.4, -91.6], [389.6, -101.2], [415.9, -101.7],
  [436.4, -32.1], [438.5, -82.1], [438.7, -57], [439.2, -96.1], [447.4, -108.4], [447.4, -44.4], [447.7, -72.7],
];

const deptakLamps = (): [number, number][] =>
  Object.values(LUBLIN_PROP_TABLE).flatMap((kinds) => {
    const a = kinds["lamp-pastoral"] ?? [];
    const out: [number, number][] = [];
    for (let i = 0; i + 4 < a.length; i += 5) if (a[i]! >= -110 && a[i]! <= 450 && a[i + 2]! >= -110 && a[i + 2]! <= -30) out.push([a[i]!, a[i + 2]!]);
    return out;
  });

describe("the furniture by the frontages' fills (G-853)", () => {
  it("leaves the deptak's pastoral lamps where they stood without the fills, within 0.05 m", () => {
    const lamps = deptakLamps().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(lamps).toHaveLength(DEPTAK_LAMPS.length);
    lamps.forEach(([x, z], k) => expect(Math.hypot(x - DEPTAK_LAMPS[k]![0], z - DEPTAK_LAMPS[k]![1]), `${x},${z}`).toBeLessThanOrEqual(0.05));
  });

  it("reads a frontage's piece as no ground", () => {
    const square = [0, 0, 10, 0, 10, 10, 0, 10];
    const chunk = (front: boolean): LublinChunkData =>
      ({
        id: "c",
        district: "shinsekai-7",
        bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
        terrain: { originX: -100, originZ: -100, cell: 200, cols: 2, rows: 2, heights: [0, 0, 0, 0] },
        buildings: [],
        ground: [{ surface: "square", outline: square, ...(front ? { front: true as const } : {}) }],
        streets: [],
        markings: [],
        pois: [],
      }) as LublinChunkData;
    expect(new Site([chunk(false)]).surfaceAt({ x: 5, z: 5 })).toBe("walk");
    expect(new Site([chunk(true)]).surfaceAt({ x: 5, z: 5 })).toBeNull();
  });
});
