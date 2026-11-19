import type { GroundPoint, Vec3 } from "@seki/core";
import { type AtticWall, ALCHEMIA_PAVILION, PAVILION_ANNEX, PAVILION_ATTIC, PAVILION_CORNERS, PAVILION_LADDER, PAVILION_SIGN, atticFootprint, atticInward } from "@seki/sim";
import { neonText } from "./neon-letters";

/**
 * The triangular pavilion on Alchemia's corner (ADR-0074 stage 3) as faces, for both its meshes:
 * the detailed one in Alchemia's outside (`pavilion-geometry.ts`) and the stand-in from afar in the
 * street furniture's blocks (`pavilion-far.ts`). The simulation's footprint and levels
 * (`content/alchemia/pavilion.ts`): a plinth, the glass on its frame, a dark fascia, the roof, the
 * back-of-house box with its door, the attic, the service ladder and the neon ALCHEMIA on its board.
 * Pure data, no Babylon.
 */

/** What a face is, for the sinks' swatches and colours. */
export type PavilionLook = "plinth" | "glass" | "glass-top" | "frame" | "fascia" | "roof" | "annex" | "door" | "attic" | "metal" | "board" | "neon" | "plaster" | "lettering";

/** Takes a face: four corners in order round it (a triangle repeats its last), its outward normal. */
export type FaceSink = (corners: readonly [Vec3, Vec3, Vec3, Vec3], n: Vec3, look: PavilionLook) => void;

const UP: Vec3 = { x: 0, y: 1, z: 0 };
const DOWN: Vec3 = { x: 0, y: -1, z: 0 };
const v = (p: GroundPoint, y: number): Vec3 => ({ x: p.x, y, z: p.z });

/** The outward normal of the side from p to q of a counter-clockwise outline. */
const outward = (p: GroundPoint, q: GroundPoint): Vec3 => {
  const len = Math.hypot(q.x - p.x, q.z - p.z);
  return { x: (q.z - p.z) / len, y: 0, z: -(q.x - p.x) / len };
};

/** A convex counter-clockwise outline stood up from y0 to y1: its sides, its top, and its bottom when asked. */
const prism = (face: FaceSink, pts: readonly GroundPoint[], y0: number, y1: number, look: PavilionLook, top: PavilionLook | null = look, bottom = false): void => {
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    face([v(p, y0), v(q, y0), v(q, y1), v(p, y1)], outward(p, q), look);
  });
  for (let i = 1; i + 1 < pts.length; i += 2) {
    const fan = [pts[0]!, pts[i]!, pts[i + 1]!, pts[Math.min(i + 2, pts.length - 1)]!] as const;
    if (top) face([v(fan[0], y1), v(fan[1], y1), v(fan[2], y1), v(fan[3], y1)], UP, top);
    if (bottom) face([v(fan[0], y0), v(fan[1], y0), v(fan[2], y0), v(fan[3], y0)], DOWN, top ?? look);
  }
};

/** A box of the world's axes. */
const box = (face: FaceSink, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, look: PavilionLook): void =>
  prism(
    face,
    [
      { x: x0, z: z0 },
      { x: x1, z: z0 },
      { x: x1, z: z1 },
      { x: x0, z: z1 },
    ],
    y0,
    y1,
    look,
    look,
    true,
  );

/** The outline moved in by `d` (scaled about its middle: near enough for a few centimetres). */
const shrink = (pts: readonly GroundPoint[], d: number): GroundPoint[] => {
  if (d === 0) return [...pts];
  const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length };
  const r = Math.min(...pts.map((p, i) => distanceToLine(c, p, pts[(i + 1) % pts.length]!)));
  const k = Math.max(0, 1 - d / r);
  return pts.map((p) => ({ x: c.x + (p.x - c.x) * k, z: c.z + (p.z - c.z) * k }));
};

/** An attic wall's footprint, its outer and inner faces moved `d` towards each other. */
const thinner = (w: AtticWall, d: number): GroundPoint[] => {
  if (d === 0) return atticFootprint(w);
  const n = atticInward(w);
  const by = (p: GroundPoint, k: number): GroundPoint => ({ x: p.x + n.x * k, z: p.z + n.z * k });
  return [by(w.a, d), by(w.b, d), by(w.b2, -d), by(w.a2, -d)];
};

const distanceToLine = (c: GroundPoint, p: GroundPoint, q: GroundPoint): number => Math.abs((q.x - p.x) * (c.z - p.z) - (q.z - p.z) * (c.x - p.x)) / Math.hypot(q.x - p.x, q.z - p.z);

/** The arcade's bays (B2, the board's pale corner house): an arch this wide, a pier between two, its springing over the floor. */
const ARCH = 1.8;
const PIER = 0.9;
const SPRING = 1.9;
/** How far the lit glass stands back in an arch, and the wall's top (the cornice under the roof). */
const RECESS = 0.25;
const SEGMENTS = 6;

/**
 * One side of the triangle as an arcade (ADR-0074 B2, decisions of 19.11): a pale wall from the
 * floor to the cornice with round arches on piers, the restaurant's warm light in them a hand back,
 * and over the arches a band with ALCHEMIA in warm letters on the two street sides.
 */
const arcadeSide = (face: FaceSink, p: GroundPoint, q: GroundPoint, lettered: boolean): void => {
  const P = ALCHEMIA_PAVILION;
  const top = P.roof - P.fascia;
  const len = Math.hypot(q.x - p.x, q.z - p.z);
  const u = { x: (q.x - p.x) / len, z: (q.z - p.z) / len };
  const n = outward(p, q);
  const at = (s: number, y: number, back = 0): Vec3 => ({ x: p.x + u.x * s - n.x * back, y, z: p.z + u.z * s - n.z * back });
  const wall = (s0: number, s1: number, y0: number, y1: number) => face([at(s0, y0), at(s1, y0), at(s1, y1), at(s0, y1)], n, "plaster");
  const bays = Math.max(1, Math.floor((len - PIER) / (ARCH + PIER)));
  const margin = (len - bays * ARCH - (bays - 1) * PIER) / 2;
  wall(0, margin, P.floor, top);
  let s = margin;
  for (let k = 0; k < bays; k++) {
    const r = ARCH / 2;
    const c = s + r;
    // The arch's head: strips of wall from its curve up to the cornice, the lit glass under it a hand back.
    for (let i = 0; i < SEGMENTS; i++) {
      const a0 = Math.PI - (Math.PI * i) / SEGMENTS;
      const a1 = Math.PI - (Math.PI * (i + 1)) / SEGMENTS;
      const [s0, y0] = [c + r * Math.cos(a0), P.floor + SPRING + r * Math.sin(a0)];
      const [s1, y1] = [c + r * Math.cos(a1), P.floor + SPRING + r * Math.sin(a1)];
      face([at(s0, y0), at(s1, y1), at(s1, top), at(s0, top)], n, "plaster");
      face([at(c, P.floor + SPRING, RECESS), at(s1, y1, RECESS), at(s0, y0, RECESS), at(s0, y0, RECESS)], n, "glass");
      // The reveal under the curve, from the face back to the glass.
      face([at(s0, y0), at(s0, y0, RECESS), at(s1, y1, RECESS), at(s1, y1)], { x: 0, y: -1, z: 0 }, "plaster");
    }
    face([at(s, P.floor, RECESS), at(s + ARCH, P.floor, RECESS), at(s + ARCH, P.floor + SPRING, RECESS), at(s, P.floor + SPRING, RECESS)], n, "glass");
    // The jambs either side of the opening.
    face([at(s, P.floor, RECESS), at(s, P.floor), at(s, P.floor + SPRING), at(s, P.floor + SPRING, RECESS)], { x: u.x, y: 0, z: u.z }, "plaster");
    face([at(s + ARCH, P.floor), at(s + ARCH, P.floor, RECESS), at(s + ARCH, P.floor + SPRING, RECESS), at(s + ARCH, P.floor + SPRING)], { x: -u.x, y: 0, z: -u.z }, "plaster");
    s += ARCH;
    const next = k + 1 < bays ? s + PIER : len;
    wall(s, next, P.floor, top);
    s = next;
  }
  if (!lettered) return;
  // ALCHEMIA over the arches, warm letters a hand proud of the band.
  const height = 0.36;
  const foot = top - height - 0.12;
  for (const l of neonText("ALCHEMIA", height)) {
    const s0 = len / 2 + l.x0;
    const s1 = len / 2 + l.x1;
    const out = (ss: number, y: number): Vec3 => ({ x: p.x + u.x * ss + n.x * 0.03, y, z: p.z + u.z * ss + n.z * 0.03 });
    face([out(s0, foot + l.y0), out(s1, foot + l.y0), out(s1, foot + l.y1), out(s0, foot + l.y1)], n, "lettering");
  }
};

/** The arcade round the triangle: its two street sides lettered, the third towards the passage plain. */
const arcade = (face: FaceSink): void => {
  PAVILION_CORNERS.forEach((p, i) => arcadeSide(face, p, PAVILION_CORNERS[(i + 1) % 3]!, i < 2));
};

/** The service ladder on the annex's west face (ADR-0021): two rails and rungs on the world's 0.3 m grid (the climber's hands, `ladder-hands.ts`). */
const ladder = (face: FaceSink): void => {
  const l = PAVILION_LADDER;
  const x0 = l.x + 0.29;
  const x1 = l.x + 0.35;
  for (const dz of [-0.28, 0.28]) box(face, x0, x1, l.z + dz - 0.03, l.z + dz + 0.03, l.bottom, l.top + 1, "metal");
  for (let k = Math.ceil(l.bottom / 0.3 - 0.5); 0.3 * (k + 0.5) < l.top; k++) {
    const y = 0.3 * (k + 0.5);
    if (y <= l.bottom + 0.05) continue;
    box(face, x0, x1, l.z - 0.25, l.z + 0.25, y - 0.02, y + 0.02, "metal");
  }
};

/** The sign's posts and board, and the neon letters on both its faces, read left to right from either side. */
const sign = (face: FaceSink, inset: number, detail: boolean): void => {
  const S = PAVILION_SIGN;
  const half = S.thick / 2;
  if (detail) for (const x of S.posts) box(face, x - S.post / 2, x + S.post / 2, S.z - S.post / 2, S.z + S.post / 2, ALCHEMIA_PAVILION.roof, S.bottom, "board");
  box(face, S.x0 + inset, S.x1 - inset, S.z - half + inset, S.z + half - inset, S.bottom + inset, S.top - inset, "board");
  const mid = (S.x0 + S.x1) / 2;
  const height = 0.9;
  const foot = (S.bottom + S.top - height) / 2;
  const proud = detail ? 0.04 : 0.02;
  const thin = detail ? 0 : 0.01;
  for (const side of [-1, 1] as const) {
    // From the south (side -1) a reader's right is east, from the north west.
    const face0 = S.z + side * (half - inset);
    for (const s of neonText("ALCHEMIA", height)) {
      const xa = mid - side * s.x0;
      const xb = mid - side * s.x1;
      box(face, Math.min(xa, xb) + thin, Math.max(xa, xb) - thin, Math.min(face0, face0 + side * proud), Math.max(face0, face0 + side * proud), foot + s.y0 + thin, foot + s.y1 - thin, "neon");
    }
  }
};

/**
 * Every face of the pavilion. `inset` moves the stand-in's faces that far inside the detailed
 * ones; `detail` adds what the far view does without (the frame, the door, the ladder, the posts).
 */
export const pavilionFaces = (face: FaceSink, inset = 0, detail = true): void => {
  const P = ALCHEMIA_PAVILION;
  const tri = shrink(PAVILION_CORNERS, inset);
  const A = PAVILION_ANNEX;
  const i = inset;
  prism(face, tri, P.base, P.floor, "plinth", null);
  // From afar the arcade's wall as one pale prism with a warm band where the arches are; near, the arcade itself.
  if (!detail) {
    // Behind the arches' glass: the stand-in also stands near, in its block, and must not show through them.
    const back = shrink(PAVILION_CORNERS, inset + RECESS + 0.05);
    prism(face, back, P.floor, P.floor + SPRING, "glass", null);
    prism(face, back, P.floor + SPRING, P.roof - P.fascia, "plaster", null);
  } else arcade(face);
  prism(face, tri, P.roof - P.fascia, P.roof - i, "fascia", "roof");
  box(face, A.minX + i, A.maxX - i, A.minZ + i, A.maxZ - i, P.base, P.roof - i, "annex");
  for (const w of PAVILION_ATTIC) prism(face, thinner(w, i), P.roof - 0.05, P.roof + P.attic - i, "attic");
  sign(face, i, detail);
  if (!detail) return;
  ladder(face);
  // The annex's service door on its north face, to the car park.
  box(face, 426.0, 427.1, A.maxZ, A.maxZ + 0.05, P.floor, P.floor + 2.2, "door");
};
