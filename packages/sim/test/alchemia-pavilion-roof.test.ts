import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES, type GroundPoint } from "@seki/core";
import {
  ALCHEMIA_PAVILION,
  PAVILION_ATTIC,
  PAVILION_CAMP_LAMP,
  PAVILION_LADDER,
  PAVILION_NAV_LAMP,
  PAVILION_OUTLINE,
  PAVILION_ROOF_DETAIL,
  PAVILION_ROOF_PROP,
  PAVILION_SIGN,
  PAVILION_TARP,
  REN_SPOT,
  TARG_ROOF_STASH,
  ROOM_DETAIL_SCENERY,
} from "../src";
import { ACTOR_ACTIVITIES } from "../src/content/actor-activities";
import { isConvex } from "../src/world/prism";

/**
 * The pavilion's roof dressed as Ren's camp after its card (`docs/lokacje/alchemia-pawilon-dach.md`, ADR-0102): his camp
 * and the roof's services inside the attic, solid where one stops, the way from the ladder's head to him and to the bag
 * free, the tarp over his head, the two lamps in their fittings, and Ren sitting rather than asleep.
 */

const R = ALCHEMIA_PAVILION.roof;

/** Distance from p to the segment ab. */
const toSegment = (p: GroundPoint, a: GroundPoint, b: GroundPoint): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};

/** Inside the roof's outline (even-odd). */
const inOutline = (p: GroundPoint): boolean => {
  let inside = false;
  const pts = PAVILION_OUTLINE;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/** Off every attic wall's line by at least its thickness: on the roof, not in the attic. */
const clearOfAttic = (p: GroundPoint): number => Math.min(...PAVILION_ATTIC.map((w) => toSegment(p, w.a, w.b)));

/** The camp's solids in world metres. */
const solids = (): { readonly points: GroundPoint[]; readonly bottom: number; readonly top: number }[] =>
  PAVILION_ROOF_PROP.prisms!.map((q) => ({ points: q.points.map((p) => ({ x: p.x + PAVILION_ROOF_PROP.center.x, z: p.z + PAVILION_ROOF_PROP.center.z })), bottom: q.bottom + PAVILION_ROOF_PROP.center.y, top: q.top + PAVILION_ROOF_PROP.center.y }));

/** Distance from p to a convex footprint (0 inside). */
const toFootprint = (p: GroundPoint, pts: readonly GroundPoint[]): number => {
  let inside = true;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    if ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x) < 0) inside = false;
  }
  return inside ? 0 : Math.min(...pts.map((a, i) => toSegment(p, a, pts[(i + 1) % pts.length]!)));
};

const key = (variant: number): string => ROOM_DETAIL_SHAPES[variant]?.key ?? "";

describe("the pavilion's roof as Ren's camp (docs/lokacje/alchemia-pawilon-dach.md)", () => {
  it("stands the camp and the services on the roof inside the attic, solid where one stops", () => {
    const s = solids();
    expect(s).toHaveLength(8);
    for (const q of s) {
      expect(isConvex(q.points)).toBe(true);
      expect(q.bottom).toBeCloseTo(R - 0.05, 5);
      for (const p of q.points) {
        expect(inOutline(p), `${p.x},${p.z}`).toBe(true);
        expect(clearOfAttic(p), `${p.x},${p.z}`).toBeGreaterThanOrEqual(ALCHEMIA_PAVILION.atticThick - 1e-6);
      }
    }
    const onRoof = PAVILION_ROOF_DETAIL.filter((p) => p.y === R);
    expect(onRoof.length).toBeGreaterThanOrEqual(11);
    for (const p of onRoof) {
      expect(inOutline(p), `${p.prop} ${p.x},${p.z}`).toBe(true);
      expect(clearOfAttic(p), `${p.prop} ${p.x},${p.z}`).toBeGreaterThan(ALCHEMIA_PAVILION.atticThick);
    }
    // Blender's models of the card, every one of them placed, the three with a sound among them (§17).
    const keys = PAVILION_ROOF_DETAIL.filter((p) => p.prop === "room-detail").map((p) => key(p.variant));
    for (const k of ["rd-ren-bed", "rd-ren-table", "rd-ren-mast", "rd-ren-pole", "rd-ren-bucket", "rd-pav-extractor", "rd-pav-neon-box", "rd-pav-bulkhead", "rd-pav-hebi", "rd-pav-carabiner"]) expect(keys).toContain(k);
    expect(keys.map((k) => ROOM_DETAIL_SHAPES.find((s) => s.key === k)?.sound).filter(Boolean).sort()).toEqual(["drip", "tubes", "vent"]);
    // The scenery's last view, so every scenery id before it stays.
    expect(ROOM_DETAIL_SCENERY[ROOM_DETAIL_SCENERY.length - 1]!.view).toEqual({ kind: "street-props", items: PAVILION_ROOF_DETAIL });
  });

  it("keeps Ren's place, the bag and the way to them from the ladder's head free", () => {
    const s = solids();
    const head = PAVILION_LADDER.exit;
    for (const q of s) {
      // Ren sits on a box under him (0.42 x 0.4): a hand round it.
      expect(toFootprint(REN_SPOT, q.points)).toBeGreaterThan(0.45);
      expect(toFootprint(TARG_ROOF_STASH.at, q.points)).toBeGreaterThan(0.4);
      expect(toFootprint(head, q.points)).toBeGreaterThan(0.8);
      // The walk from the head to Ren goes through the gap where the box meets the triangle: nothing of the camp in it.
      for (let t = 0; t <= 1; t += 0.05) {
        const p = { x: 428.4 + (REN_SPOT.x - 428.4) * t, z: -3.15 + (REN_SPOT.z + 3.15) * t };
        expect(toFootprint(p, q.points), `${p.x},${p.z}`).toBeGreaterThan(0.3);
      }
    }
  });

  it("ties the tarp over Ren and the bag, above a standing head, its south edge on the sign's board", () => {
    const [sw, se, ne, nw] = PAVILION_TARP;
    for (const c of PAVILION_TARP) expect(c.y - R).toBeGreaterThanOrEqual(1.7);
    expect(sw.z).toBeCloseTo(se.z, 5);
    expect(sw.z).toBeGreaterThan(PAVILION_SIGN.z);
    expect(sw.y).toBeLessThanOrEqual(PAVILION_SIGN.top);
    for (const p of [sw, se]) {
      expect(p.x).toBeGreaterThan(PAVILION_SIGN.x0);
      expect(p.x).toBeLessThan(PAVILION_SIGN.x1);
    }
    // Ren and the bag under it (in plan within its four corners).
    const quad = [sw, se, ne, nw];
    for (const p of [REN_SPOT, TARG_ROOF_STASH.at]) expect(toFootprint(p, quad)).toBe(0);
  });

  it("puts the camp's lantern on the crate and the green lamp on the box's wall over the ladder's foot", () => {
    expect(PAVILION_CAMP_LAMP.y - R).toBeGreaterThan(0.42);
    expect(PAVILION_CAMP_LAMP.y - R).toBeLessThan(0.7);
    const table = PAVILION_ROOF_DETAIL.find((p) => key(p.variant) === "rd-ren-table")!;
    expect(Math.hypot(PAVILION_CAMP_LAMP.x - table.x, PAVILION_CAMP_LAMP.z - table.z)).toBeLessThan(0.35);
    const lamp = PAVILION_ROOF_DETAIL.find((p) => key(p.variant) === "rd-pav-bulkhead")!;
    expect(Math.hypot(PAVILION_NAV_LAMP.x - lamp.x, PAVILION_NAV_LAMP.z - lamp.z)).toBeLessThan(0.2);
    expect(PAVILION_NAV_LAMP.y - lamp.y).toBeLessThan(0.16);
    expect(Math.hypot(PAVILION_NAV_LAMP.x - PAVILION_LADDER.x, PAVILION_NAV_LAMP.z - PAVILION_LADDER.z)).toBeLessThan(2);
  });

  it("has Ren sit and smoke under the tarp, not sleep", () => {
    const plan = ACTOR_ACTIVITIES["ren"];
    expect(plan).toEqual({ cycle: ["sit", "sit", "smoke"], minutes: 20 });
  });
});
