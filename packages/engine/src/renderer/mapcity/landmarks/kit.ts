import { DRESS_FLAG, type MeshSink, type Rgba, type Vec, hexColor } from "../../mesh-sink";
import { type FacadeFrame, type Wall, hiddenWall, trimMeta } from "../facade-frame";
import { band } from "../facade-parts";
import { doorwaysOn } from "../facade-plan";
import { type P2, centroid, offsetRing } from "../polygon";
import { type Uv, face, quadUv, vertex } from "../sink-ops";
import type { BlindRow, HelmProfile } from "./recipes";

/**
 * The landmark kit (ADR-0062): stone plinths, brick walls with blind niches, plastered tiers with
 * pilasters and cornices, a skirt roof round a part standing on another, helmets of revolution
 * with a lantern and a spire, clock faces and arched openings. Every element is baked in world
 * space into a cell's sink like the facades, coloured from the kit's swatches (ADR-0022) and
 * painted plain by the facade shader (`trimMeta`: no window grid).
 */

/** The kit's swatches: Lublin's Gothic brick, limestone, white Baroque plaster, the helmet's copper patina. */
export const SWATCH = {
  brick: "#8b4632",
  brickDark: "#6a3323",
  // The dark glazed headers (zendrówki) of the diagonal bands (T-033).
  header: "#4f241a",
  stone: "#a09a8c",
  plaster: "#ebe5d6",
  plasterTrim: "#f7f3ea",
  niche: "#ddd3bd",
  // Brama Grodzka's beige plaster (`building:colour=beige`) and the joints of its rustication.
  beige: "#e0cba3",
  beigeJoint: "#a8916c",
  opening: "#151a22",
  // The painting in the niche over the gate's arch: blue ground, a light figure.
  picture: "#2f5c8f",
  figure: "#e6dcc4",
  // The helmet's copper under its green patina (T-032).
  patina: "#5a9a80",
  tile: "#7a3b2e",
  metal: "#2b2f36",
} as const;

export const solid = (hex: string): Rgba => hexColor(hex, DRESS_FLAG.solid);
export const lit = (hex: string): Rgba => hexColor(hex, DRESS_FLAG.lit);

/** The walls of a frame worth drawing: not hidden by a neighbour up to the top. */
export const shownWalls = (f: FacadeFrame): Wall[] => f.walls.filter((w) => !hiddenWall(f, w) && !w.blind);

/** A point on the wall: `u` metres from its start, at height y, `out` metres off it. */
export const onWall = (w: Wall, u: number, y: number, out: number): Vec => {
  const dx = (w.b.x - w.a.x) / w.length;
  const dz = (w.b.z - w.a.z) / w.length;
  return { x: w.a.x + dx * u + w.nx * out, y, z: w.a.z + dz * u + w.nz * out };
};

/** A quad flat on the wall from (u0, y0) to (u1, y1), `out` metres in front of it. */
export const panel = (sink: MeshSink, w: Wall, u0: number, u1: number, y0: number, y1: number, out: number, color: Rgba, meta: Uv): void => {
  quadUv(sink, [onWall(w, u0, y0, out), onWall(w, u1, y0, out), onWall(w, u1, y1, out), onWall(w, u0, y1, out)], { x: w.nx, y: 0, z: w.nz }, color, [[u0, y0], [u1, y0], [u1, y1], [u0, y1]], meta);
};

/**
 * A pointed (lancet, two arcs of the opening's width) or round-headed panel: a rectangle up to the
 * springing and a head over it, squashed when the panel is too short for a full head.
 */
export const archPanel = (sink: MeshSink, w: Wall, u: number, width: number, y0: number, y1: number, out: number, color: Rgba, meta: Uv, pointed: boolean): void => {
  const full = pointed ? width * 0.866 : width / 2;
  const k = Math.min(1, ((y1 - y0) * 0.6) / full);
  const spring = y1 - full * k;
  panel(sink, w, u - width / 2, u + width / 2, y0, spring, out, color, meta);
  const left: [number, number][] = [];
  for (let s = 0; s <= 3; s++) {
    const t = (s / 3) * (pointed ? Math.PI / 3 : Math.PI / 2);
    left.push(pointed ? [u + width / 2 - width * Math.cos(t), spring + width * Math.sin(t) * k] : [u - (width / 2) * Math.cos(t), spring + (width / 2) * Math.sin(t) * k]);
  }
  const right = left.slice(0, -1).map(([x, y]): [number, number] => [2 * u - x, y]).reverse();
  const n = { x: w.nx, y: 0, z: w.nz };
  const c = vertex(sink, onWall(w, u, spring, out), n, color, [u, spring], meta);
  const ids = [...left, ...right].map(([uu, y]) => vertex(sink, onWall(w, uu, y, out), n, color, [uu, y], meta));
  for (let s = 0; s + 1 < ids.length; s++) face(sink, c, ids[s] as number, ids[s + 1] as number, n);
};

/** The ranges of a wall clear of its doorways (a gate's mouths), `margin` metres off them. */
export const clearOf = (f: FacadeFrame, w: Wall, margin: number): [number, number][] => {
  const openings = f.b.doorways?.length ? doorwaysOn(w, f.b.doorways) : [];
  const out: [number, number][] = [];
  let u = 0;
  for (const o of openings) {
    if (o.u0 - margin > u) out.push([u, o.u0 - margin]);
    u = Math.max(u, o.u1 + margin);
  }
  if (u < w.length) out.push([u, w.length]);
  return out;
};

/** A stone plinth in front of the walls from below the ground to `top`, open at the doorways. */
export const stonePlinth = (sink: MeshSink, f: FacadeFrame, top: number, color: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  const from = f.b.foot - 0.2;
  for (const w of shownWalls(f)) {
    for (const [u0, u1] of clearOf(f, w, 0)) {
      if (u1 - u0 < 0.05) continue;
      panel(sink, w, u0, u1, from, top, 0.07, color, meta);
      // Its sloped top, back to the wall.
      quadUv(sink, [onWall(w, u0, top, 0.07), onWall(w, u1, top, 0.07), onWall(w, u1, top + 0.06, 0), onWall(w, u0, top + 0.06, 0)], { x: w.nx, y: 0.8, z: w.nz }, color, [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
    }
  }
};

/** Rows of blind niches on the shown walls between y0 and y1, kept off the doorways. */
export const blindNiches = (sink: MeshSink, f: FacadeFrame, rows: readonly BlindRow[], y0: number, y1: number, color: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  for (const w of shownWalls(f)) {
    for (const [u0, u1] of clearOf(f, w, 0.6)) {
      const len = u1 - u0;
      for (const row of rows) {
        const n = Math.floor(len / row.pitch);
        if (n < 1) continue;
        const step = len / n;
        const width = Math.min(step * 0.52, 1.3);
        for (let k = 0; k < n; k++) archPanel(sink, w, u0 + step * (k + 0.5), width, y0 + (y1 - y0) * row.from, y0 + (y1 - y0) * row.to, 0.02, color, meta, true);
      }
    }
  }
};

/** Pilasters at the corners of the outline from y0 to y1: flat strips standing proud of the plaster. */
export const pilasters = (sink: MeshSink, f: FacadeFrame, y0: number, y1: number, color: Rgba): void => {
  const ring = f.b.ring;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[(i + ring.length - 1) % ring.length] as P2;
    const c = ring[i] as P2;
    const q = ring[(i + 1) % ring.length] as P2;
    const d1 = Math.hypot(c.x - p.x, c.z - p.z);
    const d2 = Math.hypot(q.x - c.x, q.z - c.z);
    // A corner, not a kink of the simplified outline.
    const turn = Math.abs(Math.atan2((c.x - p.x) * (q.z - c.z) - (c.z - p.z) * (q.x - c.x), (c.x - p.x) * (q.x - c.x) + (c.z - p.z) * (q.z - c.z)));
    if (turn < 0.3 || d1 < 0.6 || d2 < 0.6) continue;
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    sink.box({ x: c.x, y: (y0 + y1) / 2, z: c.z }, 0.42, y1 - y0, 0.2, color, { rotY: Math.atan2(-dz, dx), bottom: false });
  }
};

/** A two-step cornice round the ring under `y`: a deep upper moulding over a thin lower one. */
export const cornice = (sink: MeshSink, f: FacadeFrame, ring: readonly P2[], y: number, color: Rgba, deep = 0.3): void => {
  const meta = trimMeta(f.style.seed);
  band(sink, ring, deep * 0.45, y - 0.55, y - 0.32, color, meta, f.b.base);
  band(sink, ring, deep, y - 0.32, y, color, meta, f.b.base);
};

/** A low skirt roof from the eaves `rise` metres up to the ring `inset` metres inside, flat over that. */
export const skirtRoof = (sink: MeshSink, f: FacadeFrame, rise: number, inset: number, color: Rgba): void => {
  const ring = f.b.ring;
  const meta = trimMeta(f.style.seed);
  const eaves = offsetRing(ring, 0.25) ?? [...ring];
  const ridge = offsetRing(ring, -inset);
  const y0 = f.top - 0.05;
  if (!ridge) {
    slabRing(sink, ring, f.top, color, meta);
    return;
  }
  for (let i = 0; i < ring.length; i++) {
    const a = eaves[i] as P2;
    const b = eaves[(i + 1) % ring.length] as P2;
    const ra = ridge[i] as P2;
    const rb = ridge[(i + 1) % ring.length] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const n = { x: ((b.z - a.z) / len) * rise, y: inset + 0.25, z: (-(b.x - a.x) / len) * rise };
    const l = Math.hypot(n.x, n.y, n.z) || 1;
    quadUv(sink, [{ x: a.x, y: y0, z: a.z }, { x: b.x, y: y0, z: b.z }, { x: rb.x, y: y0 + rise, z: rb.z }, { x: ra.x, y: y0 + rise, z: ra.z }], { x: n.x / l, y: n.y / l, z: n.z / l }, color, [[0, 0], [len, 0], [len, rise], [0, rise]], meta);
  }
  slabRing(sink, ridge, y0 + rise, color, meta);
};

/** A flat polygon facing up (a fan from the centroid: the kit's rings are convex enough). */
export const slabRing = (sink: MeshSink, ring: readonly P2[], y: number, color: Rgba, meta: Uv): void => {
  const up = { x: 0, y: 1, z: 0 };
  const c = centroid(ring);
  const ci = vertex(sink, { x: c.x, y, z: c.z }, up, color, [c.x, c.z], meta);
  const ids = ring.map((p) => vertex(sink, { x: p.x, y, z: p.z }, up, color, [p.x, p.z], meta));
  for (let k = 0; k < ids.length; k++) face(sink, ci, ids[k] as number, ids[(k + 1) % ids.length] as number, up);
};

/** A surface of revolution round (c, y0) with `sides` facets starting at angle `phase`: [radius, height] from the bottom up. */
export const revolve = (sink: MeshSink, c: Vec, profile: readonly (readonly [number, number])[], sides: number, phase: number, color: Rgba, meta: Uv): void => {
  for (let k = 0; k + 1 < profile.length; k++) {
    const [r0, h0] = profile[k] as readonly [number, number];
    const [r1, h1] = profile[k + 1] as readonly [number, number];
    const dr = r1 - r0;
    const dh = h1 - h0;
    const l = Math.hypot(dr, dh) || 1;
    for (let j = 0; j < sides; j++) {
      const a0 = phase + (j / sides) * Math.PI * 2;
      const a1 = phase + ((j + 1) / sides) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p = (r: number, h: number, a: number): Vec => ({ x: c.x + Math.cos(a) * r, y: c.y + h, z: c.z + Math.sin(a) * r });
      const n = { x: Math.cos(am) * (dh / l), y: -dr / l, z: Math.sin(am) * (dh / l) };
      quadUv(sink, [p(r0, h0, a0), p(r0, h0, a1), p(r1, h1, a1), p(r1, h1, a0)], n, color, [[0, h0], [1, h0], [1, h1], [0, h1]], meta);
    }
  }
};

/** Where a helmet stands on a part: the ring's centroid, its inner radius and the facets' phase (along the longest wall). */
export interface HelmBase {
  readonly c: P2;
  readonly r: number;
  readonly phase: number;
}

export const helmBase = (ring: readonly P2[]): HelmBase => {
  const c = centroid(ring);
  let r = Infinity;
  let longest = 0;
  let phase = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as P2;
    const b = ring[(i + 1) % ring.length] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    // Distance from the centre to the edge's line.
    r = Math.min(r, Math.abs((b.x - a.x) * (a.z - c.z) - (b.z - a.z) * (a.x - c.x)) / len);
    if (len > longest) {
      longest = len;
      phase = Math.atan2((a.z + b.z) / 2 - c.z, (a.x + b.x) / 2 - c.x) - Math.PI / 8;
    }
  }
  return { c, r: Number.isFinite(r) ? r : 1, phase };
};

/** The parts of a helmet's profile in metres over its base. */
export interface HelmShape {
  readonly shell: [number, number][];
  readonly lantern: [number, number][];
  readonly onion: [number, number][];
  readonly spire: [number, number][];
  readonly ball: [number, number][];
}

/** The helmet's profile in metres over its base: the bell, the lantern, the onion over it and the spire with its ball up to the mast. */
export const helmProfile = (h: HelmProfile, r: number, height: number): HelmShape => {
  const lr = r * h.lanternRadius;
  const [l0, l1] = h.lantern;
  const at = (t: number) => height * (l1 + (h.onion - l1) * t);
  const neck = Math.max(lr * 0.12, 0.06);
  const rb = Math.max(lr * 0.22, 0.12);
  const yb = height * h.ball;
  return {
    shell: h.shell.map(([k, t]) => [r * k, height * t]),
    lantern: [
      [lr, height * l0 - 0.05],
      [lr, height * l1],
    ],
    // A cornice over the lantern's columns, a neck, the bulb and its point.
    onion: [
      [lr * 1.2, height * l1],
      [lr * 1.2, height * l1 + 0.1],
      [lr * 1.02, height * l1 + 0.16],
      [lr * 1.3, at(0.4)],
      [lr * 0.95, at(0.72)],
      [neck, height * h.onion],
    ],
    spire: [
      [neck, height * h.onion],
      [0.04, height * h.mast],
    ],
    ball: [-1, -0.6, 0, 0.6, 1].map((s): [number, number] => [rb * Math.sqrt(1 - s * s), yb + rb * s]),
  };
};

/** A helmet on the part: the bell, the lantern with dark openings between its columns, the onion and the spire with its ball (the mast is Lublin 2077's). */
export const helmet = (sink: MeshSink, f: FacadeFrame, h: HelmProfile, roof: number, color: Rgba, trim: Rgba, near: boolean): HelmBase => {
  const base = helmBase(f.b.ring);
  const meta = trimMeta(f.style.seed);
  const at = { x: base.c.x, y: f.top, z: base.c.z };
  const p = helmProfile(h, base.r, roof);
  revolve(sink, at, near ? p.shell : [p.shell[0] as [number, number], p.shell[p.shell.length - 1] as [number, number]], 8, base.phase, color, meta);
  revolve(sink, at, p.lantern, 8, base.phase, trim, meta);
  if (near) {
    const lr = (p.lantern[0] as [number, number])[0];
    const [y0, y1] = [(p.lantern[0] as [number, number])[1] + 0.25, (p.lantern[1] as [number, number])[1] - 0.2];
    for (let j = 0; j < 8; j++) {
      const a = base.phase + ((j + 0.5) / 8) * Math.PI * 2;
      const n = { x: Math.cos(a), y: 0, z: Math.sin(a) };
      const t = { x: -n.z, z: n.x };
      const r = lr * Math.cos(Math.PI / 8) + 0.02;
      const w = lr * 0.32;
      const q = (s: number, y: number): Vec => ({ x: at.x + n.x * r + t.x * s, y: at.y + y, z: at.z + n.z * r + t.z * s });
      quadUv(sink, [q(-w, y0), q(w, y0), q(w, y1), q(-w, y1)], n, solid(SWATCH.opening), [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
    }
  }
  revolve(sink, at, near ? p.onion : [p.onion[0] as [number, number], p.onion[3] as [number, number], p.onion[5] as [number, number]], 8, base.phase, color, meta);
  revolve(sink, at, p.spire, near ? 6 : 4, base.phase, color, meta);
  if (near) revolve(sink, at, p.ball, 6, base.phase, color, meta);
  return base;
};

/** A clock face on the wall centred at (u, y): a dial, its ring and two hands at ten past ten. */
export const clockFace = (sink: MeshSink, w: Wall, u: number, y: number, r: number, dial: Rgba, ink: Rgba, meta: Uv): void => {
  const n = { x: w.nx, y: 0, z: w.nz };
  const ring = (r0: number, r1: number, out: number, color: Rgba) => {
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * Math.PI * 2;
      const a1 = ((k + 1) / 12) * Math.PI * 2;
      const q = (rr: number, a: number) => onWall(w, u + Math.cos(a) * rr, y + Math.sin(a) * rr, out);
      quadUv(sink, [q(r0, a0), q(r0, a1), q(r1, a1), q(r1, a0)], n, color, [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
    }
  };
  ring(0, r, 0.05, dial);
  ring(r * 0.86, r, 0.06, ink);
  const hand = (a: number, len: number, width: number) => {
    const tip = { u: u + Math.cos(a) * len, y: y + Math.sin(a) * len };
    const side = { u: -Math.sin(a) * width, y: Math.cos(a) * width };
    quadUv(sink, [onWall(w, u - side.u, y - side.y, 0.07), onWall(w, u + side.u, y + side.y, 0.07), onWall(w, tip.u + side.u, tip.y + side.y, 0.07), onWall(w, tip.u - side.u, tip.y - side.y, 0.07)], n, ink, [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
  };
  hand(Math.PI / 2 - (Math.PI * 2 * 10) / 12 + 0.1, r * 0.5, r * 0.05);
  hand(Math.PI / 2 - (Math.PI * 2 * 2) / 12, r * 0.78, r * 0.035);
};
