import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { bollardChains } from "../../../packages/sim/src/content/lublin/furniture.ts";
import { LUBLIN_STREET_PROPS } from "../../../packages/sim/src/content/lublin/index.ts";
import { loadBollardLines, loadFurniture } from "../src/furniture.ts";
import { kerbBollardDoubleRow } from "../../glitch-scan/test/kerb-bollards.ts";
import { BARE_SPACING, GAP_INSET, SPACING, stretchPosts } from "../src/props-kerb-bollards.ts";
import { KERB_SET, inRowArea, joinPieces, onGround, sampleSide } from "../src/props-kerb-lines.ts";

const posts = Object.values(LUBLIN_STREET_PROPS)
  .flat()
  .filter((i) => i.prop === "bollard");
const inBox = (minX: number, maxX: number, minZ: number, maxZ: number) => (i: { x: number; z: number }) => i.x >= minX && i.x <= maxX && i.z >= minZ && i.z <= maxZ;
const chained = (of: readonly StreetPropItem[]) => of.filter((i) => bollardChains(i).length > 0).length / of.length;

describe("the rule of the kerb rows of bollards (G-820)", () => {
  it("spaces a stretch's posts evenly, GAP_INSET off a break, on an anchor and half a spacing off a change of look", () => {
    const gaps = stretchPosts({ arc: 0, kind: "gap" }, { arc: 10, kind: "gap" }, SPACING);
    expect(gaps).toHaveLength(6);
    expect(gaps[0]).toBeCloseTo(GAP_INSET, 9);
    expect(gaps[5]).toBeCloseTo(10 - GAP_INSET, 9);
    // An anchor (a lamp, an OSM bollard) is a post of the row already: none on it.
    const anchored = stretchPosts({ arc: 0, kind: "anchor" }, { arc: 9, kind: "anchor" }, SPACING);
    expect(anchored).toEqual([1.8, 3.6, 5.4, 7.2].map((v) => expect.closeTo(v, 9)));
    const bare = stretchPosts({ arc: 0, kind: "look" }, { arc: 7, kind: "gap" }, BARE_SPACING);
    expect(bare[0]).toBeCloseTo(BARE_SPACING / 2, 9);
    // A stretch with no room for a post between its insets has none; one with room for one keeps it.
    expect(stretchPosts({ arc: 0, kind: "gap" }, { arc: 0.8, kind: "gap" }, SPACING)).toEqual([]);
    expect(stretchPosts({ arc: 0, kind: "gap" }, { arc: 1.4, kind: "gap" }, SPACING)).toEqual([expect.closeTo(0.7, 9)]);
  });

  it("joins a street the chunks clipped and samples its kerb KERB_SET out, on the ground's edge of the carriageway", () => {
    const pieces = joinPieces([
      { pts: [{ x: 10, z: 0 }, { x: 20, z: 0 }], half: [3, 3, 3, 3] },
      { pts: [{ x: 0, z: 0 }, { x: 10, z: 0 }], half: [3, 3, 3, 3] },
    ]);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.pts.map((p) => p.x)).toEqual([0, 10, 20]);
    const left = sampleSide(pieces[0]!, 1);
    expect(left[0]!.p.z).toBeCloseTo(3 + KERB_SET, 9);
    expect(left.at(-1)!.arc).toBeCloseTo(20, 9);
    // The ground draws the carriageway 0.8 m wider than its widths: the kerb moves out with it.
    const moved = onGround(left, (p) => p.z < 3.8);
    expect(moved[5]!.kerb.z).toBeCloseTo(3.8, 1);
    expect(moved[5]!.p.z).toBeCloseTo(3.8 + KERB_SET, 1);
    // Road all over the reach (another carriageway, a junction): it stays.
    expect(onGround(left, () => true)[5]!.p.z).toBeCloseTo(left[5]!.p.z, 9);
  });

  it("keeps out of the town walls and out of Podzamcze", () => {
    expect(inRowArea({ x: 600, z: -200 })).toBe(true);
    expect(inRowArea({ x: 560, z: -30 })).toBe(false);
    expect(inRowArea({ x: 900, z: 300 })).toBe(false);
  });
});

describe("the kerb rows in the committed table (G-820, T-303)", () => {
  it("lines Królewska past the walls and Narutowicza, where OSM maps few posts, with chained posts", () => {
    const krolewska = posts.filter(inBox(470, 610, -224, -150));
    expect(krolewska.length).toBeGreaterThan(80);
    expect(chained(krolewska)).toBeGreaterThan(0.7);
    const narutowicza = posts.filter(inBox(70, 270, -272, -155));
    expect(narutowicza.length).toBeGreaterThan(100);
    expect(chained(narutowicza)).toBeGreaterThan(0.7);
  });

  it("stands the posts of Podwale's narrow pavement under the walls closer, with no chain (Wyszyńskiego's look)", () => {
    const row = posts.filter(inBox(640, 740, -216, -168));
    expect(row.length).toBeGreaterThan(40);
    expect(chained(row)).toBeLessThan(0.1);
    const gaps = row.map((p) => Math.min(...row.filter((q) => q !== p).map((q) => Math.hypot(q.x - p.x, q.z - p.z))));
    const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]!;
    expect(median).toBeGreaterThan(1.2);
    expect(median).toBeLessThan(1.6);
  });

  it("keeps every OSM bollard of Plac Wolności, with no post of the rule doubling it", () => {
    const square = inBox(275, 375, -205, -150);
    const nodes = loadFurniture().filter((f) => f.tag === "barrier=bollard" && square(f.p));
    expect(nodes.length).toBeGreaterThan(5);
    // The row on OSM's nodes within 1 m (n8264571992 at a zebra's mouth slid 3 m off it before the rule, G-032).
    const kept = nodes.filter((n) => posts.some((i) => Math.hypot(i.x - n.p.x, i.z - n.p.z) < 1));
    expect(kept.length / nodes.length).toBeGreaterThan(0.95);
    const here = posts.filter(square);
    for (const p of here) expect(here.filter((q) => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 0.9), `${p.x},${p.z}`).toEqual([]);
  });
});

describe("the kerb rows after the review of 15.11 (G-820 round 2)", () => {
  it("lays no second row beside a row OSM maps off the kerb line (P1)", () => {
    const found = kerbBollardDoubleRow(
      posts,
      loadFurniture()
        .filter((f) => f.tag === "barrier=bollard")
        .map((f) => f.p),
      loadBollardLines().map((l) => l.pts),
      inRowArea,
    );
    // The two left stand on main already: the plan's posts of 29.10 by Brama Krakowska (483,5; −169,4), (487,6; −173,0).
    expect(found.map((f) => f.at).sort()).toEqual(["484,-169", "488,-173"]);
  });

  it("keeps an 18 m trolleybus's kerb clear back from the stop's post against the traffic (P3, Lubartowska (454; 16))", () => {
    expect(posts.filter(inBox(446, 453, -2, 4))).toEqual([]);
  });

  it("hangs no chain on Wyszyńskiego's west side, 2 m of paving and no ground to the houses (P4)", () => {
    const west = posts.filter(inBox(604, 614, -240, -220));
    expect(west.length).toBeGreaterThan(5);
    expect(chained(west)).toBe(0);
  });

  it("runs Plac Wolności's chained row on to the corner of Dolna Panny Marii by the square (P5)", () => {
    expect(posts.filter((i) => Math.hypot(i.x - 329.5, i.z + 181) < 2 && bollardChains(i).length > 0).length).toBeGreaterThanOrEqual(2);
  });
});
