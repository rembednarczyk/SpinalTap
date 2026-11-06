import { METRO_ENTRANCES, metroStation } from "@seki/sim";
import type { Box2 } from "../mapcity/polygon";
import { MAP_SIGN_KIND, signTint } from "../mapcity/sign-plan";
import { quadUv } from "../mapcity/sink-ops";
import { glyphAdvance, glyphCell } from "../mapcity/venue-plan";
import type { MeshSink, Vec } from "../mesh-sink";
import { LINE_AMBER, PYLON, PYLON_PLATE, pylonAt } from "./pavilion-dress";
import { type Entrance, type PavilionFrame, pavilionFrame } from "./pavilion-frame";

/**
 * The names of the metro's entrances (ADR-0071 stage 3) in the map city's signs' mesh, one quad
 * a letter from the glyph atlas (ADR-0064), so no draw call more: the station's name and the
 * entrance's along the fascia of both long sides (not the side against a wall), and the
 * entrance's letter on the plate of the pylon. Lublin's names, the same in every language.
 */

/** Height of the fascia's letters and of the plate's letter, metres. */
const FASCIA_GLYPH = 0.24;
const PLATE_GLYPH = 0.3;
/** Off the fascia and the plate, metres, and the fascia's margin at each end. */
const OUT = 0.02;
const MARGIN = 0.4;

/** What the fascia reads: the station, and the entrance where it has a name of its own. */
export const pavilionTitle = (e: Entrance): string => {
  const station = metroStation(e.station).name;
  return (station === e.name ? station : `${station} · ${e.name}`).toUpperCase();
};

const add = (a: Vec, b: Vec, k: number): Vec => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const UV = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

/** A line of letters centred at `c` on a face looking along `n`, `h` high, squeezed to `room` metres wide. */
export const letters = (sink: MeshSink, text: string, c: Vec, n: Vec, h: number, room: number, tint: string = LINE_AMBER): void => {
  const right: Vec = { x: -n.z, y: 0, z: n.x };
  const natural = [...text].reduce((s, ch) => s + glyphAdvance(ch), 0) * h;
  const squeeze = Math.min(1, room / natural);
  const color = signTint(tint, 1);
  let x = (-natural * squeeze) / 2;
  for (const ch of text) {
    const w = glyphAdvance(ch) * h * squeeze;
    const cell = glyphCell(ch);
    if (cell !== null && ch !== " ") {
      const m = add(add(c, n, OUT), right, x + w / 2);
      const p = (sx: number, sy: number): Vec => ({ x: m.x + right.x * (sx * w) / 2, y: m.y + (sy * h) / 2, z: m.z + right.z * (sx * w) / 2 });
      quadUv(sink, [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)], n, color, UV, [cell + Math.min(glyphAdvance(ch), 0.98), MAP_SIGN_KIND.glyph]);
    }
    x += w;
  }
};

const planOne = (sink: MeshSink, f: PavilionFrame): void => {
  const e = f.e;
  const r = e.roof;
  const text = [...pavilionTitle(e)].filter((ch) => glyphCell(ch) !== null).join("");
  const y = f.top + 0.025;
  const mid = f.length / 2;
  for (const k of [-1, 1] as const) {
    if (e.spot.wall?.side === k) continue;
    // The fascia's outer face: the roof's edge on this side.
    const n: Vec = { x: f.across.x * k, y: 0, z: f.across.z * k };
    const c = f.at(mid, 0, y);
    const edge = f.across.x !== 0 ? (k > 0 ? r.maxX : r.minX) : k > 0 ? r.maxZ : r.minZ;
    const on = f.across.x !== 0 ? { ...c, x: edge } : { ...c, z: edge };
    letters(sink, text, on, n, FASCIA_GLYPH, f.length + 1.2 - 2 * MARGIN);
  }
  const p = pylonAt(f);
  const plate = f.at(p.u - PYLON.size / 2 - 0.03, p.w, f.street + (PYLON_PLATE.bottom + PYLON_PLATE.top) / 2);
  letters(sink, e.label, plate, { x: -f.inward.x, y: 0, z: -f.inward.z }, PLATE_GLYPH, PYLON.size);
};

/**
 * The letters of the pavilions standing in a cell of the map city. The cell builder calls it
 * only for a cell that has signs already, so they never make a mesh of their own.
 */
export const planPavilionSigns = (sink: MeshSink, bounds: Box2, entrances: readonly Entrance[] = METRO_ENTRANCES): number => {
  const here = entrances.filter((e) => e.spot.x >= bounds.minX && e.spot.x < bounds.maxX && e.spot.z >= bounds.minZ && e.spot.z < bounds.maxZ);
  for (const e of here) planOne(sink, pavilionFrame(e));
  return here.length;
};
