import { describe, expect, it } from "vitest";
import { VEHICLE_SIZE } from "@seki/core";
import { PARKED_CARS, parkedProp } from "../src/content/parked-cars";
import { GAME_PROPS } from "../src/content/street-props";
import { surfaceLiftAt } from "../src/content/lublin/roads";
import { bridgeDeckAt } from "../src/content/lublin/decks";
import { groundY } from "../src/content/lublin/terrain";

/** The top of what the renderer draws at (x, z): the ground and the highest paving of its level there (a bridge's deck or the terrain). */
const drawn = (x: number, z: number) => {
  const y = groundY(x, z);
  return y + surfaceLiftAt(x, z, bridgeDeckAt(x, z) === y);
};

const grid = (x: number, z: number, ax: number, az: number, bx: number, bz: number) =>
  [-0.5, 0, 0.5].flatMap((a) => [-0.5, 0, 0.5].map((b) => ({ x: x + ax * a + bx * b, z: z + az * a + bz * b })));

/** Every vehicle standing still in the city: its bottom and the points under its corners, the middles of its sides and its centre. */
const vehicles = (): { at: string; bottom: number; under: { x: number; z: number }[] }[] => {
  const parked = PARKED_CARS.map((c) => {
    const { width, length } = VEHICLE_SIZE[c.model];
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    return { at: `${c.model} ${c.x},${c.z}`, bottom: c.y, under: grid(c.x, c.z, fz * width, -fx * width, fx * length, fz * length) };
  });
  const blocks = GAME_PROPS.flatMap((p) => {
    const style = p.view.kind === "block" ? p.view.skin?.style : undefined;
    if (p.view.kind !== "block" || (style !== "car" && style !== "van" && style !== "wreck")) return [];
    const { x, y, z } = p.view.size;
    const bottom = p.center.y - y / 2;
    // The overpass car of the market stands on the overpass, not on the map's paving.
    if (bottom - groundY(p.center.x, p.center.z) > 1) return [];
    return [{ at: `${style} ${p.center.x},${p.center.z}`, bottom, under: grid(p.center.x, p.center.z, x, 0, 0, z) }];
  });
  return [...parked, ...blocks];
};

describe("vehicles on the drawn paving (G-130)", () => {
  it("keeps every parked car and set piece's vehicle out of the paving drawn under it, and off it by little on a slope", () => {
    const all = vehicles();
    expect(all.length).toBeGreaterThan(60);
    for (const v of all) {
      const ys = v.under.map((p) => drawn(p.x, p.z));
      // Sunk at most a tyre's squash (and the centimetre the data rounds to) at its uphill side...
      expect(Math.max(...ys) - v.bottom, v.at).toBeLessThanOrEqual(0.06);
      // ...and its downhill side no more than a kerb's height off the paving.
      expect(v.bottom - Math.min(...ys), v.at).toBeLessThanOrEqual(0.15);
    }
  });

  it("gives a parked car a solid reaching down to the terrain under all of it, with no gap to crawl under", () => {
    for (const c of PARKED_CARS) {
      const { width, length } = VEHICLE_SIZE[c.model];
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const low = Math.min(...grid(c.x, c.z, fz * width, -fx * width, fx * length, fz * length).map((p) => groundY(p.x, p.z)));
      const bottom = Math.min(...(parkedProp(c).prisms ?? []).map((q) => q.bottom));
      expect(c.y + bottom, `${c.model} ${c.x},${c.z}`).toBeLessThanOrEqual(low);
    }
  });

  it("sets the wreck by Pedet on the deptak's paving, not on the bare terrain under it", () => {
    const wreck = GAME_PROPS.find((p) => p.view.kind === "block" && p.view.skin?.style === "wreck");
    if (!wreck || wreck.view.kind !== "block") throw new Error("no wreck");
    const { x, y, z } = wreck.view.size;
    const bottom = wreck.center.y - y / 2;
    for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) expect(drawn(wreck.center.x + x * a, wreck.center.z + z * b) - bottom).toBeLessThanOrEqual(0.05 + 1e-9);
  });
});
