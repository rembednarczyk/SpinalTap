import { DRESS_FLAG, type MeshSink, hexColor } from "../mesh-sink";
import { type HeightAt, SURFACE_CODE, SURFACE_LIFT, drape } from "./ground-plan";
import { type P2, obbLocal, orientedBox } from "./polygon";

/** Worn white road paint, wet like the asphalt under it. */
const PAINT = hexColor("#c9ccc6", DRESS_FLAG.wet);
/** Lublin 2077: a self-lit cyan line along both edges of the zebra, kerb to kerb (ADR-0052). */
const GLOW = hexColor("#2fc6e0", DRESS_FLAG.lit);
const GLOW_WIDTH = 0.07;

/** Width of a zebra's stripe and of the gap between two, metres (Polish P-10). */
export const ZEBRA_STRIPE = 0.5;
/** Stripes stop this short of the kerbs, metres. */
const KERB_GAP = 0.25;

/**
 * A zebra crossing (ADR-0042) on its band across the carriageway: white stripes along the road,
 * `ZEBRA_STRIPE` wide with as wide a gap, repeated from kerb to kerb. The band's long side runs
 * across the road (the importer makes it as long as the road is wide and 3 m along it). Its two
 * edges glow cyan.
 */
export const planCrossing = (sink: MeshSink, ring: readonly P2[], h: HeightAt): void => {
  if (ring.length < 3) return;
  const box = orientedBox(ring);
  const across = box.halfLong - KERB_GAP;
  const along = box.halfShort;
  if (across <= ZEBRA_STRIPE || along < 0.5) return;
  const at = (u: number, v: number): P2 => ({ x: box.cx + box.ux * u - box.uz * v, z: box.cz + box.uz * u + box.ux * v });
  const count = Math.floor((2 * across + ZEBRA_STRIPE) / (2 * ZEBRA_STRIPE));
  const start = -((count * 2 - 1) * ZEBRA_STRIPE) / 2;
  for (let k = 0; k < count; k++) {
    const u0 = start + k * 2 * ZEBRA_STRIPE;
    const u1 = u0 + ZEBRA_STRIPE;
    const stripe = [at(u0, -along), at(u1, -along), at(u1, along), at(u0, along)];
    drape(sink, stripe, h, SURFACE_LIFT.crossing, PAINT, (p) => {
      const l = obbLocal(box, p);
      return [l.u, l.v];
    }, [SURFACE_CODE.road, 0]);
  }
  for (const side of [-1, 1]) {
    const v0 = side * (along + 0.12);
    const edge = [at(-across, v0 - GLOW_WIDTH / 2), at(across, v0 - GLOW_WIDTH / 2), at(across, v0 + GLOW_WIDTH / 2), at(-across, v0 + GLOW_WIDTH / 2)];
    drape(sink, edge, h, SURFACE_LIFT.crossing, GLOW, (p) => [p.x, p.z], [SURFACE_CODE.road, 0]);
  }
};
