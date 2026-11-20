import { describe, expect, it } from "vitest";
import { ALCHEMIA_PROPS, ALCHEMIA_TIER_PIECES, MALL, MALL_RAIL, type AlchemiaPiece } from "../src";
import { prismsAt } from "../src/world/prism";

/**
 * The storeys' rounded corners in the simulation (ADR-0074, the board 1:1 on 19.11): a slab, its
 * glass and its balustrade are prisms of one rounded outline, so nobody stands on a corner the
 * drawing has cut away. Since ADR-0093 O1 the gallery's slabs are rings round its atrium, a few
 * pieces each, only their outer north corners rounded (`alchemia-mall.test.ts`); the front's storeys
 * keep a slab and a glass each.
 */

const isSlab = (p: AlchemiaPiece): boolean => p.kind === "roof" && p.box.y1 - p.box.y0 <= 0.31 && (p.box.x1 - p.box.x0) * (p.box.z1 - p.box.z0) >= 30;
const slabs = ALCHEMIA_TIER_PIECES.filter(isSlab);
/** The gallery's (ADR-0093 O1) stand on its outline, south of the front's. */
const ofGallery = (p: AlchemiaPiece): boolean => p.box.x0 >= MALL.x0 - 0.31 && p.box.x1 <= MALL.x1 + 0.31 && p.box.z0 >= MALL.z0 - 0.01;
const frontSlabs = slabs.filter((s) => !ofGallery(s));
const prisms = ALCHEMIA_PROPS.flatMap((p) => prismsAt(p.prisms ?? [], p.center));
const solidAt = (x: number, y: number, z: number): boolean =>
  prisms.some((q) => y > q.bottom && y < q.top && q.points.every((p, i) => {
    const n = q.points[(i + 1) % q.points.length]!;
    return (n.x - p.x) * (z - p.z) - (n.z - p.z) * (x - p.x) >= 0;
  }));

describe("Alchemia's rounded storeys (19.11)", () => {
  it("gives every storey's slab and glass a rounded outline, the glass's within the slab's", () => {
    // The front's six (L1's three wings, L2's two bars, L3); tiers A and B went with ADR-0093 O1.
    expect(frontSlabs.length).toBeGreaterThanOrEqual(6);
    // Every slab has an outline; the front's round some corner.
    for (const s of slabs) expect(s.outline!.length, `${s.box.x0},${s.box.z0}`).toBeGreaterThanOrEqual(4);
    expect(frontSlabs.filter((s) => s.outline!.length > 4).length).toBeGreaterThanOrEqual(frontSlabs.length - 1);
    // Since ADR-0093 O5 the glass is a wall 0.2 m deep round each storey's rooms (a solid box of its outline until then): its
    // pieces run along a slab's outline, under the slab, within it.
    const glass = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "pane" && p.outline && p.box.z1 <= MALL.z0 + 0.01);
    expect(glass.length).toBeGreaterThan(frontSlabs.length * 4);
    for (const g of glass) {
      const slab = frontSlabs.find((s) => Math.abs(s.box.y0 - g.box.y1) < 0.01 && g.outline!.every((p) => p.x >= s.box.x0 - 1e-6 && p.x <= s.box.x1 + 1e-6 && p.z >= s.box.z0 - 1e-6 && p.z <= s.box.z1 + 1e-6));
      expect(slab, `${g.box.x0},${g.box.z0}`).toBeDefined();
    }
  });

  it("holds nobody over a cut corner: on a slab's middle there is floor, on its box's rounded corner none", () => {
    let cut = 0;
    for (const s of slabs) {
      const b = s.box;
      const y = b.y1 - 0.1;
      expect(solidAt((b.x0 + b.x1) / 2, y, (b.z0 + b.z1) / 2), `${b.x0},${b.z0}`).toBe(true);
      // The box's corners the outline rounds: none of the outline's points there.
      for (const [x, z] of [
        [b.x0 + 0.1, b.z0 + 0.1],
        [b.x1 - 0.1, b.z0 + 0.1],
        [b.x1 - 0.1, b.z1 - 0.1],
        [b.x0 + 0.1, b.z1 - 0.1],
      ] as const) {
        const square = s.outline!.some((p) => Math.abs(p.x - (x < (b.x0 + b.x1) / 2 ? b.x0 : b.x1)) < 1e-6 && Math.abs(p.z - (z < (b.z0 + b.z1) / 2 ? b.z0 : b.z1)) < 1e-6);
        // A corner under or in another storey (a wing's under L2) is that one's floor.
        const covered = ALCHEMIA_TIER_PIECES.some((o) => o !== s && o.solid && x > o.box.x0 && x < o.box.x1 && z > o.box.z0 && z < o.box.z1 && y > o.box.y0 && y < o.box.y1);
        if (square || covered) continue;
        cut++;
        expect(solidAt(x, y, z), `${x},${z}`).toBe(false);
      }
    }
    expect(cut).toBeGreaterThanOrEqual(12);
  });

  it("rails the gallery's roof and the front's terraces with solid balustrades round their rounded edges", () => {
    // Until ADR-0093 O1 the solid ones were the terraces of A and B; the front's were drawn only until O5, when one walks
    // out onto L2's terrace from L3 and onto L3's roof from the gallery's.
    const rails = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "parapet" && p.outline);
    expect(rails.filter((p) => p.solid).length).toBeGreaterThan(30);
    expect(rails.filter((p) => !p.solid)).toEqual([]);
    for (const r of rails) expect(r.box.y1 - r.box.y0).toBeCloseTo(r.box.z0 >= MALL.z0 && r.box.x0 >= MALL.x0 - 0.4 ? MALL_RAIL : 1, 6);
  });
});
