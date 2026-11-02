import { DRESS_FLAG, type MeshSink, hexColor } from "../mesh-sink";
import { type FacadeFrame, hiddenWall, trimMeta } from "./facade-frame";
import { doorwaysOn } from "./facade-plan";
import { DOOR_METAL, DOOR_STONE } from "./prop-door";

/**
 * The surround of the game's doorways (G-270): the clinic's, Neon Koi's (ADR-0038) and the capsule
 * room's (ADR-0063), cut into the facade as openings (ADR-0045). Jambs and a lintel on the wall's
 * face round the opening, never in it (the opening is the solids' and the bodies walk through
 * it), out from the wall so the ink outlines them, and a sill in front of it; the colours of the
 * facades' doors (`prop-door.ts`): aluminium on a shop front, stone on the others. In the
 * building's own mesh: no draw calls. A passage's mouths (ADR-0048) are lined by the passage.
 */

/** The jambs' and lintel's width, how far they stand out from the wall's face, the sill's (m). */
export const DOORWAY_FRAME = { side: 0.14, out: 0.1, sill: { out: 0.16, height: 0.03, below: 0.2 } } as const;

export const doorwayFrames = (sink: MeshSink, f: FacadeFrame): void => {
  const doorways = f.b.doorways ?? [];
  if (doorways.length === 0 || (f.b.passages?.length ?? 0) > 0) return;
  const color = hexColor(f.style.shopfront ? DOOR_METAL : DOOR_STONE, DRESS_FLAG.solid);
  const sill = hexColor("#c9c2b4", DRESS_FLAG.solid);
  const meta = trimMeta(f.style.seed);
  const { side, out } = DOORWAY_FRAME;
  for (const w of f.walls) {
    if (hiddenWall(f, w)) continue;
    const dx = (w.b.x - w.a.x) / w.length;
    const dz = (w.b.z - w.a.z) / w.length;
    const rotY = Math.atan2(-dz, dx);
    // A box `wide` along the wall from `u` and `deep` out from its face, between world y0 and y1.
    const box = (u0: number, u1: number, y0: number, y1: number, deep: number, c = color) =>
      sink.box({ x: w.a.x + dx * ((u0 + u1) / 2) + (w.nx * deep) / 2, y: (y0 + y1) / 2, z: w.a.z + dz * ((u0 + u1) / 2) + (w.nz * deep) / 2 }, u1 - u0, y1 - y0, deep, c, { rotY, uv2: meta, bottom: false });
    for (const o of doorwaysOn(w, doorways)) {
      const lintel = o.top + side;
      box(o.u0 - side, o.u0, o.bottom, lintel, out);
      box(o.u1, o.u1 + side, o.bottom, lintel, out);
      box(o.u0, o.u1, o.top, lintel, out);
      // Down into the paving, so a step to a floor over the street shows no gap.
      box(o.u0 - side, o.u1 + side, o.bottom - DOORWAY_FRAME.sill.below, o.bottom + DOORWAY_FRAME.sill.height, DOORWAY_FRAME.sill.out, sill);
    }
  }
};
