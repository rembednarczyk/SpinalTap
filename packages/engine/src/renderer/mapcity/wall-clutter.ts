import { prng } from "../city-kit-data";
import { type MeshSink, type Rgba, type Vec, hexColor } from "../mesh-sink";
import { type FacadeFrame, type Wall, hiddenWall } from "./facade-frame";

/**
 * What vertical Lublin 2077 bolts onto the walls (ADR-0051), in the near facade mesh: pipes,
 * air conditioners and scaffolding on the firewalls that rise over lower neighbours, and air
 * conditioners and drainpipes under the windows of the upper floors of the street walls. The
 * amount follows the building's `clutter`; landmarks (no clutter) get none.
 */

const PIPE: readonly string[] = ["#5c626b", "#6f5848", "#4d5a52"];
const UNIT: Rgba = hexColor("#9aa1a8");
const GRILLE: Rgba = hexColor("#23262c");
const SCAFFOLD: Rgba = hexColor("#7a6a4a");
const PLANK: Rgba = hexColor("#5b4a33");

/** A point on the wall: `u` metres from its start, at height y, `out` metres off it. */
const on = (w: Wall, u: number, y: number, out: number): Vec => ({ x: w.a.x + ((w.b.x - w.a.x) / w.length) * u + w.nx * out, y, z: w.a.z + ((w.b.z - w.a.z) / w.length) * u + w.nz * out });

/** Turn of a box whose local x runs along the wall. */
const yawOf = (w: Wall): number => Math.atan2(-(w.b.z - w.a.z), w.b.x - w.a.x);

/** An air conditioner on the wall: the unit and its dark fan grille facing out. */
const airCon = (sink: MeshSink, w: Wall, u: number, y: number): void => {
  const yaw = yawOf(w);
  sink.box(on(w, u, y, 0.24), 0.85, 0.55, 0.45, UNIT, { rotY: yaw });
  sink.box(on(w, u + 0.1, y, 0.47), 0.42, 0.42, 0.02, GRILLE, { rotY: yaw, bottom: false });
};

/** Scaffolding over part of a wall: standards, ledgers and planks every storey. */
const scaffold = (sink: MeshSink, w: Wall, u0: number, u1: number, y0: number, y1: number): void => {
  const yaw = yawOf(w);
  for (let u = u0; u <= u1 + 0.01; u += 2) {
    for (const out of [0.4, 1.4]) {
      const p = on(w, u, (y0 + y1) / 2, out);
      sink.box(p, 0.06, y1 - y0, 0.06, SCAFFOLD, { rotY: yaw });
    }
  }
  for (let y = y0 + 2; y <= y1; y += 2) {
    const mid = (u0 + u1) / 2;
    sink.box(on(w, mid, y, 1.4), u1 - u0, 0.06, 0.06, SCAFFOLD, { rotY: yaw });
    sink.box(on(w, mid, y - 0.05, 0.9), u1 - u0, 0.05, 1.0, PLANK, { rotY: yaw });
  }
};

/** Pipes, air conditioners and at times scaffolding on the part of a firewall over its neighbour. */
const firewall = (sink: MeshSink, f: FacadeFrame, w: Wall, c: number, rand: () => number): void => {
  const from = Math.max(w.coveredTo, f.b.base);
  const exposed = f.top - from;
  if (exposed < 2.5 || w.length < 3) return;
  const pipes = 1 + Math.floor(rand() * 3 * c);
  for (let k = 0; k < pipes; k++) {
    const u = 0.6 + rand() * (w.length - 1.2);
    sink.prism(on(w, u, from, 0.2), 0.08 + rand() * 0.1, exposed + 0.8, 6, hexColor(PIPE[Math.floor(rand() * PIPE.length)] ?? "#5c626b"), true);
  }
  if (rand() < c) {
    const y = from + 1 + rand() * (exposed - 1.5);
    sink.box(on(w, w.length / 2, y, 0.12), w.length * (0.4 + rand() * 0.5), 0.16, 0.16, hexColor(PIPE[0] ?? "#5c626b"), { rotY: yawOf(w) });
  }
  const units = Math.floor(c * 4 * rand());
  for (let k = 0; k < units; k++) airCon(sink, w, 0.8 + rand() * (w.length - 1.6), from + 0.8 + rand() * (exposed - 1.2));
  if (exposed >= 6 && w.length >= 6 && rand() < c * 0.35) {
    const span = Math.min(w.length - 1, 4 + Math.floor(rand() * 4) * 2);
    const u0 = 0.5 + rand() * (w.length - 1 - span);
    scaffold(sink, w, u0, u0 + span, from, Math.min(f.top, from + 2 + Math.floor(rand() * 3) * 2));
  }
};

/** Air conditioners under the upper windows and a drainpipe down one end of a street wall. */
const streetWall = (sink: MeshSink, f: FacadeFrame, w: Wall, c: number, rand: () => number): void => {
  if (w.bay <= 0 || w.length < 3) return;
  const rows = Math.max(0, Math.floor((f.eave - f.b.base - f.ground) / f.storey));
  const units = Math.round(c * (w.length / 4) * rows * 0.3 * rand() * 2);
  for (let k = 0; k < units; k++) {
    const row = Math.floor(rand() * rows);
    const bays = Math.max(1, Math.round(w.length / w.bay));
    const u = (Math.floor(rand() * bays) + 0.5) * w.bay;
    airCon(sink, w, u, f.b.base + f.ground + row * f.storey + 0.35);
  }
  if (rand() < c * 0.6) {
    const u = rand() < 0.5 ? 0.25 : w.length - 0.25;
    sink.prism(on(w, u, f.b.base, 0.12), 0.06, f.eave - f.b.base, 6, hexColor("#4a4e55"), false);
  }
};

/** The wall clutter of one building. */
export const planWallClutter = (sink: MeshSink, f: FacadeFrame): void => {
  const c = f.b.clutter ?? 0;
  if (c <= 0) return;
  const rand = prng((f.b.look ^ 0xa1c) >>> 0);
  for (const w of f.walls) {
    if (hiddenWall(f, w)) continue;
    if (w.blind) firewall(sink, f, w, c, rand);
    else streetWall(sink, f, w, c, rand);
  }
};
