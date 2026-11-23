import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES, type Vec3 } from "@seki/core";
import { CONTRACT_SITE_SPAWNS, GANGER_SPAWNS, SITE_PLANS, STEAM_VENTS, drinkerWay } from "../src";
import { BAY_DRAIN, CAR_WASH_DETAIL, YARD_GAP } from "../src/content/car-wash-detail";
import { CAR_WASH_PROPS } from "../src/content/district-car-wash";
import { CAR_WASH_PLACE, PADS } from "../src/content/lublin/sites";
import { groundY } from "../src/content/lublin/terrain";

/*
 * The scene of MYJNIA 24H after its card (`docs/lokacje/myjnia-podworko.md`, ADR-0102 point 5): the people of M0 and
 * of the job `car_wash` on the yard's level ground, the one tight way in from Lubartowska, the wash's models where its
 * solids are and the steam where it has a source.
 */

/** The yard's pad (G-754, T-003): level at the car wash's height. */
const PAD = PADS.find((p) => p.row === "T-051" && p.y === CAR_WASH_PLACE.y)!;
const level = (p: { x: number; z: number }): number => Math.abs(groundY(p.x, p.z) - CAR_WASH_PLACE.y);
const old = (x: number, z: number) => ({ x: CAR_WASH_PLACE.x + x, z: CAR_WASH_PLACE.z + z });

describe("the car wash yard (ADR-0102 point 5)", () => {
  it("has the courier, his guard, the job's crew and the variations' spots on the pad's level ground", () => {
    const plan = SITE_PLANS.car_wash!;
    const people: [string, Vec3][] = [
      ...GANGER_SPAWNS.map((s): [string, Vec3] => [s.key, s.position]),
      ...CONTRACT_SITE_SPAWNS.car_wash.map((p, i): [string, Vec3] => [`crew ${i}`, p]),
      ...[...(plan.guards ?? []), plan.twin!, plan.lookout!].map((p, i): [string, Vec3] => [`variation ${i}`, p]),
    ];
    expect(people.length).toBe(10);
    for (const [who, p] of people) {
      expect(p.x >= PAD.rect.minX && p.x <= PAD.rect.maxX && p.z >= PAD.rect.minZ && p.z <= PAD.rect.maxZ, `${who} on the pad`).toBe(true);
      // On the level ground, not the slope the pad's grid blends into past old z 39 (it stood 0.33 m down it).
      expect(level(p), `${who} at ${p.x},${p.z}`).toBeLessThan(0.02);
    }
  });

  it("is shut off from the car park's east side but for one tight gap, the drinker's way out through it", () => {
    const width = YARD_GAP.to - YARD_GAP.from;
    expect(width).toBeGreaterThanOrEqual(1.2);
    expect(width).toBeLessThanOrEqual(1.6);
    const gap = { x: old(YARD_GAP.x, 0).x, from: old(0, YARD_GAP.from).z, to: old(0, YARD_GAP.to).z };
    const way = drinkerWay("car_wash")!;
    const legs = way.slice(1).map((b, k) => [way[k]!, b] as const);
    const across = legs.find(([a, b]) => (a.x - gap.x) * (b.x - gap.x) < 0)!;
    expect(across).toBeDefined();
    const [a, b] = across;
    const z = a.z + ((b.z - a.z) * (gap.x - a.x)) / (b.x - a.x);
    // A body's half width clear of the container and the barrier either side.
    expect(z).toBeGreaterThan(gap.from + 0.35);
    expect(z).toBeLessThan(gap.to - 0.35);
  });

  it("stands the wash's models on the ground, the gantry on its legs' solids, the tubes under the canopy", () => {
    const keyOf = (variant: number): string => ROOM_DETAIL_SHAPES[variant]!.key;
    for (const item of CAR_WASH_DETAIL) {
      if (item.prop === "room-detail" && keyOf(item.variant) === "rd-cw-tubes") {
        const canopy = CAR_WASH_PROPS.find((p) => p.view.kind === "block" && p.view.size.x === 7 && p.view.material === "metal")!;
        expect(item.y).toBeCloseTo(canopy.center.y - 0.18, 2);
        continue;
      }
      expect(Math.abs(item.y - groundY(item.x, item.z)), `${item.prop} ${item.variant} at ${item.x},${item.z}`).toBeLessThan(0.005);
    }
    const legs = CAR_WASH_PROPS.filter((p) => p.scenery && p.solid && p.view.kind === "block" && p.view.material === "glass");
    expect(legs).toHaveLength(2);
    const gantry = CAR_WASH_DETAIL.find((i) => i.prop === "room-detail" && keyOf(i.variant) === "rd-cw-gantry")!;
    expect(gantry.x).toBeCloseTo((legs[0]!.center.x + legs[1]!.center.x) / 2, 5);
    expect(gantry.z).toBeCloseTo((legs[0]!.center.z + legs[1]!.center.z) / 2, 5);
  });

  it("lets the steam rise from the bay's drain under the canopy, on the ground", () => {
    const vent = STEAM_VENTS[1]!;
    const drain = old(BAY_DRAIN.x, BAY_DRAIN.z);
    expect(vent.x).toBeCloseTo(drain.x, 5);
    expect(vent.z).toBeCloseTo(drain.z, 5);
    expect(vent.y).toBeCloseTo(groundY(vent.x, vent.z), 3);
    const canopy = CAR_WASH_PROPS.find((p) => p.view.kind === "block" && p.view.size.x === 7 && p.view.material === "metal")!;
    const size = canopy.view.kind === "block" ? canopy.view.size : { x: 0, z: 0 };
    expect(Math.abs(vent.x - canopy.center.x)).toBeLessThan(size.x / 2);
    expect(Math.abs(vent.z - canopy.center.z)).toBeLessThan(size.z / 2);
  });
});
