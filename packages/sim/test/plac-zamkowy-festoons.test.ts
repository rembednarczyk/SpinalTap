import { describe, expect, it } from "vitest";
import { FESTOON_HANG, PLAC_ZAMKOWY_FESTOONS, PLAC_ZAMKOWY_STALLS, WORLD_STREET_PROPS, festoonAt, groundY, inBuilding } from "../src";
import { surfacesAt } from "../src/content/lublin/roads";

/*
 * The flea market's festoons on Plac Zamkowy (decision of the user 24.11): cables from the square's lamp posts over
 * its stalls, high enough to walk and to park under, clear of the trees, the buildings and the carriageways.
 */
const all = Object.values(WORLD_STREET_PROPS).flat();
const posts = all.filter((i) => i.prop === "lamp-candelabra" || i.prop === "lamp-park");
const trees = all.filter((i) => i.prop === "tree");
const flat = (p: { x: number; z: number }) => ({ x: p.x, z: p.z });

describe("Plac Zamkowy's festoons (24.11)", () => {
  it("hang over the whole market, bulbs and neon strips both", () => {
    expect(PLAC_ZAMKOWY_STALLS.length).toBeGreaterThanOrEqual(20);
    expect(PLAC_ZAMKOWY_FESTOONS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(PLAC_ZAMKOWY_FESTOONS.map((s) => s.style))).toEqual(new Set(["bulbs", "strip"]));
    const zs = PLAC_ZAMKOWY_FESTOONS.map((s) => (s.a.z + s.b.z) / 2);
    // From the market's south end to its north end, not in one corner.
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(50);
  });

  it.each(PLAC_ZAMKOWY_FESTOONS.map((s, i) => [i, s] as const))("%i: from post to post, 9-22 m, its middle over a stall", (_i, s) => {
    for (const end of [s.a, s.b]) {
      const post = posts.find((p) => p.x === end.x && p.z === end.z);
      expect(post).toBeDefined();
      expect(end.y).toBeCloseTo(post!.y + FESTOON_HANG, 6);
    }
    const length = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
    expect(length).toBeGreaterThanOrEqual(9);
    expect(length).toBeLessThanOrEqual(22);
    const mid = festoonAt(s, 0.5);
    expect(Math.min(...PLAC_ZAMKOWY_STALLS.map((t) => Math.hypot(t.x - mid.x, t.z - mid.z)))).toBeLessThanOrEqual(10);
  });

  it.each(PLAC_ZAMKOWY_FESTOONS.map((s, i) => [i, s] as const))("%i: 2.7 m over the ground at least, over no building, carriageway or tree", (_i, s) => {
    for (let t = 0.02; t < 1; t += 0.02) {
      const p = festoonAt(s, t);
      expect(p.y - groundY(p.x, p.z)).toBeGreaterThanOrEqual(2.7);
      expect(inBuilding(p.x, p.z)).toBe(false);
      expect(surfacesAt(p.x, p.z)).not.toContain("road");
      for (const tree of trees) expect(Math.hypot(tree.x - p.x, tree.z - p.z)).toBeGreaterThan(2.7);
    }
  });

  it("never cross one another, two at most on a post", () => {
    const spans = PLAC_ZAMKOWY_FESTOONS.map((s) => [flat(s.a), flat(s.b)] as const);
    const side = (o: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
    for (let i = 0; i < spans.length; i++)
      for (let j = i + 1; j < spans.length; j++) {
        const [[a, b], [c, d]] = [spans[i]!, spans[j]!];
        const shared = [a, b].some((p) => [c, d].some((q) => p.x === q.x && p.z === q.z));
        if (!shared) expect(side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0, `${i} ${j}`).toBe(false);
      }
    const ends = spans.flat().map((p) => `${p.x},${p.z}`);
    for (const e of new Set(ends)) expect(ends.filter((x) => x === e).length).toBeLessThanOrEqual(2);
  });
});
