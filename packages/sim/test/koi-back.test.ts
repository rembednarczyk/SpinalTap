import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES, type StreetPropItem, type Vec3 } from "@seki/core";
import { CONTRACT_SITE_SPAWNS, KOI_BACK_DETAIL, KOI_BACK_DOOR, KOI_BACK_PROPS, SITE_PLANS, STEAM_VENTS, drinkerWay } from "../src";
import { surfaceY } from "../src/content/lublin/terrain";
import type { StaticProp } from "../src/content/builders";

/*
 * The yard behind Neon Koi after its card (`docs/lokacje/koi-podworko.md`, ADR-0102 point 5): lights in their fittings
 * that show the ways (§13), big things for cover that leave every post of the contract and the drinker's walk free
 * (§2: density never shuts a way), clutter in clusters where somebody does something (§14), the kitchen's extract
 * steaming (§17). Before it the yard had one bin and nothing else.
 */

const keyOf = (i: StreetPropItem): string => (i.prop === "room-detail" ? (ROOM_DETAIL_SHAPES[i.variant]?.key ?? "") : i.prop);
const lights = KOI_BACK_PROPS.filter((p) => p.view.kind === "neon");
const solids = KOI_BACK_PROPS.filter((p) => p.solid);
const flat = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Horizontal distance from a point to a solid's footprint: its prisms' corners' box, or its block. */
const gap = (p: Vec3, s: StaticProp): number => {
  const pts = s.prisms?.flatMap((q) => q.points.map((c) => ({ x: s.center.x + c.x, z: s.center.z + c.z })));
  const size = s.view.kind === "block" ? s.view.size : { x: 0, z: 0 };
  const minX = pts ? Math.min(...pts.map((c) => c.x)) : s.center.x - size.x / 2;
  const maxX = pts ? Math.max(...pts.map((c) => c.x)) : s.center.x + size.x / 2;
  const minZ = pts ? Math.min(...pts.map((c) => c.z)) : s.center.z - size.z / 2;
  const maxZ = pts ? Math.max(...pts.map((c) => c.z)) : s.center.z + size.z / 2;
  return Math.hypot(Math.max(minX - p.x, 0, p.x - maxX), Math.max(minZ - p.z, 0, p.z - maxZ));
};

/** The least gap from a solid to a walk from `a` to `b`, sampled every 10 cm. */
const gapToWalk = (s: StaticProp, a: Vec3, b: Vec3): number => {
  const n = Math.max(1, Math.ceil(flat(a, b) / 0.1));
  let least = Infinity;
  for (let k = 0; k <= n; k++) least = Math.min(least, gap({ x: a.x + ((b.x - a.x) * k) / n, y: 0, z: a.z + ((b.z - a.z) * k) / n }, s));
  return least;
};

describe("the yard behind Neon Koi", () => {
  it("has three lights, each in its fitting: the back door's bulkhead, the gap's lantern, the annex's batten", () => {
    expect(lights.length).toBe(3);
    const fittings = KOI_BACK_DETAIL.filter((i) => /canopy|lantern|batten/.test(keyOf(i)));
    expect(fittings.map(keyOf).sort()).toEqual(["rd-kb-batten", "rd-kb-canopy", "rd-kb-lantern"]);
    for (const l of lights) expect(Math.min(...fittings.map((f) => flat(f, l.center)))).toBeLessThan(0.6);
    // The bulkhead hangs over the back door, under the canopy, its light out over the yard.
    const door = lights.find((l) => flat(l.center, KOI_BACK_DOOR.at) < 0.3)!;
    expect(door.center.y - KOI_BACK_DOOR.at.y).toBeGreaterThan(KOI_BACK_DOOR.height);
  });

  it("stands its drawn things on the yard's ground", () => {
    for (const i of KOI_BACK_DETAIL.filter((d) => !/bulb|canopy/.test(keyOf(d)))) expect(Math.abs(i.y - surfaceY(i.x, i.z)), keyOf(i)).toBeLessThan(0.01);
  });

  it("keeps every post of the contract, its variants' and the drinker's walk at least 0.7 m clear of the new solids", () => {
    const plan = SITE_PLANS.koi_back!;
    const posts = [...CONTRACT_SITE_SPAWNS.koi_back, ...(plan.guards ?? []), plan.twin, plan.lookout, ...(plan.ambush ?? [])].filter((p): p is Vec3 => p !== undefined);
    for (const p of posts) for (const s of solids) expect(gap(p, s), `${p.x},${p.z}`).toBeGreaterThan(0.7);
    const way = drinkerWay("koi_back")!;
    for (let k = 0; k + 1 < way.length; k++) for (const s of solids) expect(gapToWalk(s, way[k]!, way[k + 1]!), `leg ${k}`).toBeGreaterThan(0.7);
  });

  it("leaves the back door's way out free: nothing solid within 2 m in front of it", () => {
    const out = { x: KOI_BACK_DOOR.at.x, y: 0, z: KOI_BACK_DOOR.at.z - 1.2 };
    for (const s of solids) expect(gap(out, s)).toBeGreaterThan(0.8);
  });

  it("lays the clutter in clusters (§14): the cook's smoke by the back door, three things or more by the bar's bin", () => {
    const smoke = KOI_BACK_DETAIL.find((i) => keyOf(i) === "rd-kb-smoke")!;
    expect(ROOM_DETAIL_SHAPES[smoke.variant]!.clutter).toBeGreaterThanOrEqual(3);
    expect(flat(smoke, KOI_BACK_DOOR.at)).toBeLessThan(2.5);
    const bin = KOI_BACK_DETAIL.filter((i) => (i.prop === "clutter" && i.z < -113.5) || keyOf(i) === "rd-c-cartons");
    expect(bin.length).toBeGreaterThanOrEqual(3);
    for (const i of bin) expect(Math.hypot(i.x - 306, i.z + 114.6)).toBeLessThan(1.2);
  });

  it("steams from the kitchen's extract on the bar's back wall", () => {
    const fan = KOI_BACK_DETAIL.find((i) => keyOf(i) === "rd-kb-extract")!;
    expect(STEAM_VENTS.some((v) => flat(v, fan) < 0.7 && v.y > fan.y + 2)).toBe(true);
  });
});
