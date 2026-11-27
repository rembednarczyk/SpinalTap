import { describe, expect, it } from "vitest";
import { type Pt, pointInRing } from "../src/geometry.ts";
import { weldTJunctions } from "../src/streets/t-junctions.ts";

const r1 = (v: number) => Math.round(v * 10) / 10;
const rounded = (r: readonly Pt[]) => r.map((p) => ({ x: r1(p.x), z: r1(p.z) }));

// Lubartowska's west sidewalk (the curator's review of E3, P1): the mapped sidewalks east of the
// line and the gap closed west of it, the one line given by different ends in the two.
const line = (z: number) => 432.176 + ((z + 79.883) / (-33.185 + 79.883)) * (429.311 - 432.176);
const east: Pt[] = [{ x: line(-79.883), z: -79.883 }, { x: 436, z: -79.883 }, { x: 436, z: -33.185 }, { x: line(-33.185), z: -33.185 }];
const west: Pt[] = [{ x: line(-82.667), z: -82.667 }, { x: line(-54.295), z: -54.295 }, { x: 427, z: -54.295 }, { x: 427, z: -82.667 }];

/** Points along the shared line, a centimetre apart, in neither piece once both are rounded to 0.1 m. */
const seam = (a: readonly Pt[], b: readonly Pt[]) => {
  const [ra, rb] = [rounded(a), rounded(b)];
  let n = 0;
  for (let z = -79; z <= -55.5; z += 0.25)
    for (let d = -0.06; d <= 0.06; d += 0.01) {
      const p = { x: line(z) + d, z };
      if (!pointInRing(p, ra) && !pointInRing(p, rb)) {
        n++;
        break;
      }
    }
  return n;
};

describe("T-junctions welded (`weldTJunctions`)", () => {
  it("leaves no seam between two pieces along one line once rounded to 0.1 m, and no shape changed", () => {
    expect(seam(east, west)).toBeGreaterThan(10);
    const [e, w] = weldTJunctions([east, west]);
    expect(seam(e!, w!)).toBe(0);
    // Only points on the edges are added: the east piece takes the west's end at z −54.295, the west the east's at z −79.883.
    expect(e!.length).toBe(east.length + 1);
    expect(w!.length).toBe(west.length + 1);
    for (const p of [{ x: 434, z: -60 }, { x: 428, z: -70 }]) expect(pointInRing(p, p.x > 431 ? e! : w!)).toBe(true);
  });

  it("adds nothing to rings that only meet at a corner or lie apart", () => {
    const a: Pt[] = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }, { x: 0, z: 1 }];
    const b: Pt[] = [{ x: 1, z: 1 }, { x: 2, z: 1 }, { x: 2, z: 2 }, { x: 1, z: 2 }];
    const c: Pt[] = [{ x: 5, z: 5 }, { x: 6, z: 5 }, { x: 6, z: 6 }];
    expect(weldTJunctions([a, b, c])).toEqual([a, b, c]);
  });
});
