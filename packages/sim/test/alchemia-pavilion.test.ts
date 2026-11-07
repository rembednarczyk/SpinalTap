import { describe, expect, it } from "vitest";
import type { GroundPoint } from "@seki/core";
import {
  ALCHEMIA_PROPS,
  ALCHEMIA_PAVILION,
  PAVILION_ANNEX,
  PAVILION_ATTIC,
  PAVILION_CORNERS,
  PAVILION_LADDER,
  PAVILION_OUTLINE,
  PAVILION_PROPS,
  P1_RAMP_PROPS,
  PAVILION_SIGN,
  REN_SPOT,
  TARG_ROOF_STASH,
  atticFootprint,
  atticInward,
  groundY,
} from "../src";
import { MAP_CHUNKS, rawHeight } from "../src/content/lublin/sites";
import { isConvex } from "../src/world/prism";

/**
 * The triangular pavilion on the corner of Bajkowskiego and Lubartowska (ADR-0074 stage 3): in the
 * car park's notch off both sidewalks, on the NMT, one storey of 5 m with its attic, the ladder
 * onto its roof and Ren with the Hebi bag up there.
 */

const flat = (f: readonly number[]): GroundPoint[] => {
  const out: GroundPoint[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]!, z: f[i + 1]! });
  return out;
};

/** Distance from p to the segment ab. */
const toSegment = (p: GroundPoint, a: GroundPoint, b: GroundPoint): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};

/** Is p inside the triangle (either winding)? */
const inTriangle = (p: GroundPoint): boolean => {
  const s = [0, 1, 2].map((i) => {
    const a = PAVILION_CORNERS[i]!;
    const b = PAVILION_CORNERS[(i + 1) % 3]!;
    return Math.sign((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));
  });
  return s.every((v) => v >= 0) || s.every((v) => v <= 0);
};
const inAnnex = (p: GroundPoint): boolean => p.x >= PAVILION_ANNEX.minX && p.x <= PAVILION_ANNEX.maxX && p.z >= PAVILION_ANNEX.minZ && p.z <= PAVILION_ANNEX.maxZ;
const inFootprint = (p: GroundPoint): boolean => inTriangle(p) || inAnnex(p);

/** Points of the footprint every 0.25 m. */
const footprint = (): GroundPoint[] => {
  const out: GroundPoint[] = [];
  for (let x = 419; x <= 438; x += 0.25) for (let z = -10; z <= 7; z += 0.25) if (inFootprint({ x, z })) out.push({ x, z });
  return out;
};

/** Points along the outline every 0.25 m. */
const alongOutline = (): GroundPoint[] =>
  PAVILION_OUTLINE.flatMap((a, i) => {
    const b = PAVILION_OUTLINE[(i + 1) % PAVILION_OUTLINE.length]!;
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25);
    return Array.from({ length: n }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n }));
  });

describe("the triangular pavilion on the corner (ADR-0074 stage 3)", () => {
  it("stands in the car park's notch, off the paving of Bajkowskiego's and Lubartowska's sidewalks and off every street", () => {
    const chunk = MAP_CHUNKS.find((c) => c.id === "krakowskie-2-1")!;
    const walks = (chunk.footWays ?? []).map((w) => ({ line: flat(w.line), half: w.width / 2 })).filter((w) => w.line.some((p) => Math.hypot(p.x - 430, p.z + 2) < 30));
    expect(walks.length).toBeGreaterThanOrEqual(2);
    let nearest = Infinity;
    for (const p of alongOutline()) for (const w of walks) for (let i = 0; i + 1 < w.line.length; i++) nearest = Math.min(nearest, toSegment(p, w.line[i]!, w.line[i + 1]!) - w.half);
    expect(nearest).toBeGreaterThanOrEqual(0.39);
    expect(nearest).toBeLessThan(0.8);
    const streets = MAP_CHUNKS.flatMap((c) => c.streets.map((s) => flat(s.line)));
    for (const p of alongOutline()) for (const s of streets) for (let i = 0; i + 1 < s.length; i++) expect(toSegment(p, s[i]!, s[i + 1]!)).toBeGreaterThan(5);
    // Within the box of ADR-0074 §1 (x 422..441, z -12..4) give or take the notch's west edge and its north tip.
    for (const p of PAVILION_OUTLINE) {
      expect(p.x).toBeGreaterThanOrEqual(420);
      expect(p.x).toBeLessThanOrEqual(441);
      expect(p.z).toBeGreaterThanOrEqual(-12);
      expect(p.z).toBeLessThanOrEqual(6.5);
    }
  });

  it("leaves the ground on the NMT (no pad), its floor a step over the highest point, 5 m from it to the attic's top", () => {
    const pts = footprint();
    expect(pts.length).toBeGreaterThan(1000);
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pts) {
      const y = groundY(p.x, p.z);
      expect(Math.abs(y - rawHeight(p.x, p.z)), `${p.x},${p.z}`).toBeLessThan(1e-6);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    expect(ALCHEMIA_PAVILION.floor - hi).toBeGreaterThan(0.1);
    expect(ALCHEMIA_PAVILION.floor - hi).toBeLessThan(0.2);
    expect(lo - ALCHEMIA_PAVILION.base).toBeGreaterThan(0.25);
    expect(ALCHEMIA_PAVILION.roof + ALCHEMIA_PAVILION.attic - ALCHEMIA_PAVILION.floor).toBeCloseTo(5, 5);
    // Bajkowskiego, Lubartowska and their sidewalks round the corner keep the NMT within 0.3 m (ADR-0042).
    for (const c of MAP_CHUNKS) {
      for (const line of [...c.streets.map((s) => s.line), ...(c.footWays ?? []).map((w) => w.line)]) {
        for (const p of flat(line)) if (Math.hypot(p.x - 430, p.z + 2) < 40) expect(Math.abs(groundY(p.x, p.z) - rawHeight(p.x, p.z))).toBeLessThanOrEqual(0.3);
      }
    }
  });

  it("rings the roof with its attic, open only at the ladder's head, the outline counter-clockwise", () => {
    let area = 0;
    PAVILION_OUTLINE.forEach((a, i) => {
      const b = PAVILION_OUTLINE[(i + 1) % PAVILION_OUTLINE.length]!;
      area += a.x * b.z - b.x * a.z;
    });
    expect(area / 2).toBeGreaterThan(80);
    for (const w of PAVILION_ATTIC) {
      const n = atticInward(w);
      const mid = { x: (w.a.x + w.b.x) / 2 + n.x * 0.3, z: (w.a.z + w.b.z) / 2 + n.z * 0.3 };
      expect(inFootprint(mid), `${mid.x},${mid.z}`).toBe(true);
      expect(isConvex(atticFootprint(w))).toBe(true);
      for (const p of [w.a2, w.b2]) expect(inFootprint(p), `${p.x},${p.z}`).toBe(true);
    }
    // The only way off the roof is the gap at the ladder: a walker crossing the attic's line anywhere else meets a wall.
    const open = alongOutline().filter((p) => !PAVILION_ATTIC.some((w) => toSegment(p, w.a, w.b) < 0.05));
    expect(open.length).toBeGreaterThan(0);
    for (const p of open) expect(Math.hypot(p.x - PAVILION_ANNEX.minX, p.z - PAVILION_LADDER.z)).toBeLessThanOrEqual(0.66);
  });

  it("hangs the ladder from the ground by the car park up to the roof, its head in the attic's gap", () => {
    const l = PAVILION_LADDER;
    expect(inFootprint(l)).toBe(false);
    expect(l.bottom).toBeCloseTo(groundY(l.x, l.z), 5);
    expect(l.top).toBe(ALCHEMIA_PAVILION.roof);
    expect(inAnnex(l.exit)).toBe(true);
    expect(l.exit.y).toBe(ALCHEMIA_PAVILION.roof);
    const ladder = PAVILION_PROPS.find((p) => p.mechanism?.kind === "ladder")!;
    // Drawn with the pavilion, no entity's view of its own.
    expect(ladder.scenery).toBe(true);
    expect(PAVILION_PROPS.filter((p) => p.mechanism?.kind === "ladder-end")).toHaveLength(2);
    // After stages 1 and 2's solids, before stage 4's (two props and the ramp's wedges) and stage 7's (one): their ids (from ROOM_ID_BASE, in order) stay.
    const from = ALCHEMIA_PROPS.indexOf(PAVILION_PROPS[0]!);
    expect(ALCHEMIA_PROPS.slice(from, from + PAVILION_PROPS.length)).toEqual(PAVILION_PROPS);
    expect(ALCHEMIA_PROPS.slice(from + PAVILION_PROPS.length)).toHaveLength(2 + P1_RAMP_PROPS.length + 1);
  });

  it("puts Ren and the Hebi bag on the roof, inside the attic and clear of the sign", () => {
    for (const p of [REN_SPOT, TARG_ROOF_STASH.at]) {
      expect(p.y).toBe(ALCHEMIA_PAVILION.roof);
      expect(inTriangle(p)).toBe(true);
      for (const w of PAVILION_ATTIC) expect(toSegment(p, w.a, w.b)).toBeGreaterThan(1);
      expect(Math.abs(p.z - PAVILION_SIGN.z)).toBeGreaterThan(2);
    }
    expect(Math.hypot(REN_SPOT.x - TARG_ROOF_STASH.at.x, REN_SPOT.z - TARG_ROOF_STASH.at.z)).toBeLessThan(2);
  });
});
