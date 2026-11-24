import { KATEDRALNY_BEACON } from "@seki/sim";
import type { MeshSink, Vec } from "../mesh-sink";
import type { Box2 } from "./polygon";
import { MAP_SIGN_KIND, signTint } from "./sign-plan";
import { type Uv, quadUv } from "./sink-ops";

/*
 * Obstruction lights on the city's masts (Plac Katedralny's Trinitarian Tower, a broadcast mast in 2077, 24.11): a
 * small cross of the signs' strobe (blinking in pairs, steady at half with flashes reduced), seen from any side, in the
 * signs' mesh of the cell holding it; no draw call more. As the building sites' crane beacons (`site-signs.ts`).
 */

/** A beacon's half size (m): a lamp seen at night from far, larger than its housing. */
const HALF = 0.35;
const BRIGHTNESS = 1;

const UV: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

export interface Beacon {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly color: string;
}

/** The beacons standing in a cell of the map city; their count. */
export const planBeacons = (sink: MeshSink, bounds: Box2, beacons: readonly Beacon[] = [KATEDRALNY_BEACON]): number => {
  let count = 0;
  for (const b of beacons) {
    if (b.x < bounds.minX || b.x >= bounds.maxX || b.z < bounds.minZ || b.z >= bounds.maxZ) continue;
    const color = signTint(b.color, BRIGHTNESS);
    for (const [ax, az] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const p = (s: number, t: number): Vec => ({ x: b.x + ax * s * HALF, y: b.y + t * HALF, z: b.z + az * s * HALF });
      const n: Vec = { x: az, y: 0, z: -ax };
      const c = [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)] as const;
      quadUv(sink, c, n, color, UV, [0.2, MAP_SIGN_KIND.strobe]);
      quadUv(sink, [c[1], c[0], c[3], c[2]], { x: -n.x, y: 0, z: -n.z }, color, UV, [0.2, MAP_SIGN_KIND.strobe]);
    }
    count++;
  }
  return count;
};
