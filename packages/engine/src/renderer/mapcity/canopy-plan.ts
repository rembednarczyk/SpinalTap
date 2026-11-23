import { DRESS_FLAG, type MeshSink, hexColor } from "../mesh-sink";
import { type FacadeFrame, frameRoofMeta, hiddenWall, trimMeta } from "./facade-frame";
import { DOWN, band, slab, wallQuad } from "./facade-parts";
import { triangulate } from "./polygon";
import { polygon } from "./sink-ops";

/**
 * A roof on posts of the map (G-063): the bus platform's shelter, the market's stall roofs, the
 * museum's well. A plain slab over the outline (a fascia round its edge, no storeys or windows),
 * its underside, and square steel posts from the ground to it where the simulation's solids
 * stand. The same near and far: a few faces and boxes.
 */

/** The posts' paint and the fascia's: galvanised steel and a painted sheet edge. */
const STEEL = hexColor("#5a6068", DRESS_FLAG.solid);
const FASCIA = hexColor("#3d4752", DRESS_FLAG.solid);
const UNDERSIDE = hexColor("#2b3036", DRESS_FLAG.solid);

export const planCanopy = (sink: MeshSink, f: FacadeFrame): void => {
  const b = f.b;
  const c = b.canopy;
  if (!c) return;
  const meta = trimMeta(f.style.seed);
  const [bottom, top] = [b.foot, f.top];
  for (const w of f.walls) if (!hiddenWall(f, w)) wallQuad(sink, w.a, w.b, { x: w.nx, z: w.nz }, bottom, top, b.base, FASCIA, meta);
  slab(sink, b.ring, top, FASCIA, frameRoofMeta(f));
  polygon(sink, b.ring.map((q) => ({ x: q.x, y: bottom, z: q.z })), triangulate(b.ring), DOWN, UNDERSIDE, (q) => [q.x, q.z], meta);
  // A drip edge round the slab's top.
  band(sink, b.ring, 0.05, top - 0.12, top + 0.04, STEEL, meta, b.base);
  // The posts from under the paving (the foot of the lowest ground) to the underside.
  const ground = b.base - 0.2;
  for (const p of c.posts) sink.box({ x: p.x, y: (ground + bottom) / 2, z: p.z }, c.post, bottom - ground, c.post, STEEL, { bottom: false });
};
