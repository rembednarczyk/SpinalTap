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
export type PavilionLook = "plinth" | "glass" | "glass-top" | "frame" | "fascia" | "roof" | "annex" | "door" | "attic" | "metal" | "board" | "neon";

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

/** The triangle's frame: a mullion every 1.6 m along each side and a post at each corner, proud of the glass. */
const mullions = (face: FaceSink): void => {
  const P = ALCHEMIA_PAVILION;
  const top = P.roof - P.fascia;
  PAVILION_CORNERS.forEach((p, i) => {
    const q = PAVILION_CORNERS[(i + 1) % 3]!;
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    const along = { x: (q.x - p.x) / len, z: (q.z - p.z) / len };
    const out = outward(p, q);
    const n = Math.max(2, Math.round(len / 1.6));
    for (let k = 0; k < n; k++) {
      const half = k === 0 ? 0.12 : 0.05;
      const c = { x: p.x + along.x * (len * k) / n + out.x * 0.04, z: p.z + along.z * (len * k) / n + out.z * 0.04 };
      // Counter-clockwise: along the side on its outer face, back along its inner one.
      const corners = [
        { x: c.x - along.x * half + out.x * 0.05, z: c.z - along.z * half + out.z * 0.05 },
        { x: c.x + along.x * half + out.x * 0.05, z: c.z + along.z * half + out.z * 0.05 },
        { x: c.x + along.x * half - out.x * 0.05, z: c.z + along.z * half - out.z * 0.05 },
        { x: c.x - along.x * half - out.x * 0.05, z: c.z - along.z * half - out.z * 0.05 },
      ];
      prism(face, corners, P.floor, top, "frame");
    }
    // The transom over the doors' height, the length of the side.
    const t = [
      { x: p.x + out.x * 0.08, z: p.z + out.z * 0.08 },
      { x: q.x + out.x * 0.08, z: q.z + out.z * 0.08 },
      { x: q.x + out.x * 0.01, z: q.z + out.z * 0.01 },
      { x: p.x + out.x * 0.01, z: p.z + out.z * 0.01 },
    ];
    prism(face, t, P.floor + 2.6, P.floor + 2.7, "frame");
  });
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
  prism(face, tri, P.floor, P.floor + 3.1, "glass", null);
  prism(face, tri, P.floor + 3.1, P.roof - P.fascia, "glass-top", null);
  prism(face, tri, P.roof - P.fascia, P.roof - i, "fascia", "roof");
  box(face, A.minX + i, A.maxX - i, A.minZ + i, A.maxZ - i, P.base, P.roof - i, "annex");
  for (const w of PAVILION_ATTIC) prism(face, thinner(w, i), P.roof - 0.05, P.roof + P.attic - i, "attic");
  sign(face, i, detail);
  if (!detail) return;
  mullions(face);
  ladder(face);
  // The annex's service door on its north face, to the car park.
  box(face, 426.0, 427.1, A.maxZ, A.maxZ + 0.05, P.floor, P.floor + 2.2, "door");
};
