import { describe, expect, it } from "vitest";
import { Simulation, groundY } from "../src";
import { BRIDGE_DECKS, bridgeDeckAt, deckGroundAt, flightDeckAt } from "../src/content/lublin/decks";
import { chunkScenery } from "../src/content/lublin/city";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { SHAPED_TERRAIN } from "../src/content/lublin/terrain";
import { TRAFFIC_ROUTES, pointAt } from "../src/content/traffic";
import { type GroundDeck, deckAt, deckHeight, flightGradientAt, groundOver, makeDeck, onFlight } from "../src/world/deck";
import { terrainHeightAt } from "@seki/core";
import { input, teleportPlayer } from "./helpers";

const pointInRing = (p: { x: number; z: number }, ring: readonly { x: number; z: number }[]): boolean => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
};

/** Mełgiewska over the Bystrzyca: its two carriageways' bridges, the river some 5 m below. */
const OVER_RIVER = { x: 2428, z: 262 };

describe("bridges' decks (ADR-0053)", () => {
  it("run level from abutment to abutment, level across, nothing off the deck", () => {
    const d = makeDeck([0, -5, 40, -5, 40, 5, 0, 5], [0, 0, 40, 0], (x) => (x === 0 ? 2 : 4));
    expect(deckAt([d], 20, 3)).toBeCloseTo(3, 5);
    expect(deckAt([d], 20, -3)).toBeCloseTo(3, 5);
    expect(deckAt([d], 0, 0)).toBeCloseTo(2, 5);
    expect(deckAt([d], 20, 8)).toBeNull();
  });

  it("carry Mełgiewska over the Bystrzyca: the ground, the traffic and the player stay up on the deck", () => {
    expect([...BRIDGE_DECKS.values()].flat().length).toBeGreaterThan(4);
    const terrain = terrainHeightAt(SHAPED_TERRAIN.get("nabrzeze-0-0")!, OVER_RIVER.x, OVER_RIVER.z);
    const deck = groundY(OVER_RIVER.x, OVER_RIVER.z);
    expect(deck - terrain).toBeGreaterThan(3);
    const sim = Simulation.create({ seed: 1 });
    expect(sim.streamer.ground.heightAt(OVER_RIVER.x, OVER_RIVER.z)).toBeCloseTo(deck, 5);
    // The cars along Mełgiewska never dip into the valley: the road keeps within a metre of the abutments' level.
    for (const r of TRAFFIC_ROUTES.filter((x) => x.street === "Mełgiewska" && x.use === "cars")) {
      for (let s = 0; s < r.length; s += 2) {
        const p = pointAt(r.points, s);
        if (Math.hypot(p.x - OVER_RIVER.x, p.z - OVER_RIVER.z) < 15) expect(sim.streamer.ground.heightAt(p.x, p.z), `${r.id} at ${s}`).toBeGreaterThan(deck - 1.5);
      }
    }
  });

  it("stay the ground over a flight of steps hung off them, which is the ground on its band off them even under the terrain (G-255, G-274)", () => {
    // A flight 2 m wide down from y 3 at x 10 to y 1 at x 0, beside a deck at y 3 reaching 1 m over its band.
    const ring = [
      { x: 0, z: -1 },
      { x: 10, z: -1 },
      { x: 10, z: 1 },
      { x: 0, z: 1 },
    ];
    const flight: GroundDeck = { ring, a: { x: 0, z: 0 }, b: { x: 10, z: 0 }, ya: 1, yb: 3, box: { minX: 0, maxX: 10, minZ: -1, maxZ: 1 }, flight: true };
    const deck: GroundDeck = makeDeck([0, 0, 20, 0, 20, 8, 0, 8], [0, 4, 20, 4], () => 3);
    // In the deck's outline the deck, drawn there, is the ground; off it the flight.
    expect(groundOver([deck, flight], 5, 0.5, 0)).toBeCloseTo(3, 5);
    expect(groundOver([deck, flight], 5, -0.5, 0)).toBeCloseTo(2, 5);
    expect(onFlight([deck, flight], 5, 0.5)).toBe(false);
    expect(onFlight([deck, flight], 5, -0.5)).toBe(true);
    // Cut into a bank: the terrain over the flight is not the ground there.
    expect(groundOver([deck, flight], 2, -0.5, 2)).toBeCloseTo(1.4, 5);
    // Off the flight's band the deck and the terrain are the ground as before.
    expect(groundOver([deck, flight], 5, 3, 0)).toBeCloseTo(3, 5);
    expect(groundOver([deck, flight], 5, -3, 0.5)).toBeCloseTo(0.5, 5);
    // No room under the flight, as under a bridge: feet far under it get it too, and a body
    // walking up to it from below finds a bank too steep to walk, not a way under it.
    expect(groundOver([deck, flight], 9, -0.5, 0, 0.45)).toBeCloseTo(2.8, 5);
    expect(groundOver([deck, flight], 2, -0.5, 0, 0.45)).toBeCloseTo(1.4, 5);
    const out = { x: 0, z: 0 };
    // On it within reach, its own grade (0.2), not the seam with the terrain beside it.
    expect(flightGradientAt([deck, flight], 5, -0.9, 2.5, out)).toEqual({ x: 0.2, z: 0 });
    expect(flightGradientAt([deck, flight], 5, -0.9, 1.5, out)).toBeNull();
    expect(flightGradientAt([deck, flight], 5, 0.5, Infinity, out)).toBeNull();
    expect(flightGradientAt([deck, flight], 5, 3, Infinity, out)).toBeNull();
  });

  it("let the steps from the viaduct of Zamkowa down beside it on their grade, for the walkers as for the ground (G-255)", () => {
    const sim = Simulation.create({ seed: 1 });
    // On the run from the bend (729.5, 159.9) up to the deck's edge (734.1, 163.9): its middle on
    // the flight's grade, its side in the map's outline of the viaduct on the bend's landing, in
    // the niche the steps have in the viaduct's sidewalk (G-274).
    for (const [x, z, y] of [
      [731.8, 161.9, -14.55],
      [730.8, 159.6, -15.31],
    ] as const) {
      expect(groundY(x, z), `${x}, ${z}`).toBeCloseTo(y, 1);
      expect(sim.streamer.ground.heightAt(x, z), `${x}, ${z}`).toBeCloseTo(groundY(x, z), 5);
    }
  });

  it("lay no steps on a flight's grade where a bridge's deck is the ground, nor a deck over the steps: one or the other, drawn as walked (G-274)", () => {
    const both: string[] = [];
    for (const c of MAP_CHUNKS) {
      for (const item of chunkScenery(c, [])) {
        const v = item.view;
        if (v.kind !== "ground" || !v.deck) continue;
        const { a, b } = v.deck;
        const drawn: GroundDeck = { ring: v.outline, a, b, ya: a.y, yb: b.y, box: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 } };
        const xs = v.outline.map((p) => p.x);
        const zs = v.outline.map((p) => p.z);
        for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25) {
          for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.25) {
            if (!pointInRing({ x, z }, v.outline)) continue;
            // A band of steps on a flight's grade over a bridge's deck, or a bridge's piece over a flight.
            // A flight's run that stays on the deck lies on the deck (G-330).
            const bridge = bridgeDeckAt(x, z);
            if (v.surface === "steps" && flightDeckAt(x, z) === null && bridge !== null && Math.abs(deckHeight(drawn, x, z) - bridge) > 0.05) both.push(`steps over the deck at (${x.toFixed(2)}, ${z.toFixed(2)})`);
            if (v.surface !== "steps" && flightDeckAt(x, z) !== null) both.push(`deck over the flight at (${x.toFixed(2)}, ${z.toFixed(2)})`);
          }
        }
      }
    }
    expect(both).toEqual([]);
  });

  it("are the ground on the seams of chunks as off them, whichever chunk the seam is looked up in (G-278)", () => {
    const ground = Simulation.create({ seed: 1 }).streamer.ground;
    // On the viaduct of Zamkowa on z = 160 and on Mełgiewska's bridges on z = 270: the deck, not the terrain under it.
    expect(ground.heightAt(735, 160)).toBeCloseTo(-13.54, 2);
    expect(ground.heightAt(2410, 270)).toBeCloseTo(-25.52, 2);
    const seams = { x: new Set<number>(), z: new Set<number>() };
    for (const c of MAP_CHUNKS) {
      if ((BRIDGE_DECKS.get(c.id) ?? []).length === 0) continue;
      for (const v of [c.bounds.minX, c.bounds.maxX]) seams.x.add(v);
      for (const v of [c.bounds.minZ, c.bounds.maxZ]) seams.z.add(v);
    }
    const off: string[] = [];
    let on = 0;
    const at = (x: number, z: number, dx: number, dz: number): void => {
      if (bridgeDeckAt(x, z) === null) return;
      on++;
      const here = ground.heightAt(x, z);
      const want = [deckGroundAt(x, z, terrainHeightAt(ground.gridAt(x, z)!, x, z))];
      // Each side of the seam a hair off it where the deck goes on there: a deck may end on a seam.
      for (const s of [-1, 1]) if (bridgeDeckAt(x + s * dx, z + s * dz) !== null) want.push(ground.heightAt(x + s * dx, z + s * dz));
      for (const y of want) if (Math.abs(here - y) > 1e-3) off.push(`(${x}, ${z}): ${here.toFixed(2)} for ${y.toFixed(2)}`);
    };
    for (const c of MAP_CHUNKS) {
      for (const z of seams.z) if (z >= c.bounds.minZ && z <= c.bounds.maxZ) for (let x = c.bounds.minX; x <= c.bounds.maxX; x += 0.25) at(x, z, 0, 1e-6);
      for (const x of seams.x) if (x >= c.bounds.minX && x <= c.bounds.maxX) for (let z = c.bounds.minZ; z <= c.bounds.maxZ; z += 0.25) at(x, z, 1e-6, 0);
    }
    expect(on).toBeGreaterThan(100);
    expect(off).toEqual([]);
  });

  it("carry a walker across Mełgiewska's bridges between the carriageway and the sidewalk, both ways: one deck, level within a kerb (G-340, G-344)", () => {
    type P = { readonly x: number; readonly z: number };
    const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    // The axes of the carriageways w172992144, w50733068 and of the sidewalks w230881194, w230881193 (OSM).
    const north = { road: [{ x: 2407, z: 277.6 }, { x: 2449.6, z: 251 }], walk: [{ x: 2404.7, z: 267.3 }, { x: 2447.4, z: 241.2 }] };
    const south = { road: [{ x: 2458.7, z: 302.7 }, { x: 2419, z: 316.5 }], walk: [{ x: 2459.3, z: 312.5 }, { x: 2413.5, z: 328.9 }] };
    const crossings = [north, south].flatMap((b) =>
      [0.05, 0.2, 0.4, 0.6, 0.8, 0.9].flatMap((t): [P, P][] => {
        const [road, walk] = [lerp(b.road[0]!, b.road[1]!, t), lerp(b.walk[0]!, b.walk[1]!, t)];
        return [[road, walk], [walk, road]];
      }),
    );
    // From the carriageway to the sidewalk the deck rises a kerb at most, nowhere a step to walk under (G-062).
    for (const [from, to] of crossings.filter((_, i) => i % 2 === 0)) {
      let kerb = 0;
      for (let k = 1; k <= 100; k++) {
        const [p, q] = [lerp(from, to, (k - 1) / 100), lerp(from, to, k / 100)];
        kerb = Math.max(kerb, Math.abs((bridgeDeckAt(q.x, q.z) ?? -Infinity) - (bridgeDeckAt(p.x, p.z) ?? -Infinity)));
      }
      expect(kerb, `(${from.x.toFixed(1)}, ${from.z.toFixed(1)})`).toBeLessThan(0.2);
    }
    for (const [from, to] of crossings) {
      const sim = Simulation.create({ seed: 3 });
      const deck = (p: P) => bridgeDeckAt(p.x, p.z)!;
      teleportPlayer(sim, { x: from.x, y: deck(from), z: from.z }, Math.atan2(to.x - from.x, to.z - from.z));
      // How far the feet get under the deck under them, or off every deck: in the valley.
      let under = -Infinity;
      for (let i = 0; i < 60 * 8; i++) {
        const p = sim.player()!.position;
        if (Math.hypot(to.x - p.x, to.z - p.z) < 0.5) break;
        sim.player()!.yaw = Math.atan2(to.x - p.x, to.z - p.z);
        sim.step(input({ moveZ: 1 }));
        const q = sim.player()!.position;
        under = Math.max(under, (bridgeDeckAt(q.x, q.z) ?? Infinity) - q.y);
      }
      const p = sim.player()!.position;
      const where = `(${from.x.toFixed(1)}, ${from.z.toFixed(1)}) to (${to.x.toFixed(1)}, ${to.z.toFixed(1)})`;
      expect(Math.hypot(to.x - p.x, to.z - p.z), where).toBeLessThan(0.5);
      expect(under, where).toBeLessThan(0.2);
    }
  });

  it("take a walker off Andersa onto Mełgiewska's south bridge and back across the whole carriageway, within a kerb (G-349)", () => {
    // The carriageway's deck (w50733068) to its west abutment, 13 m wide; the terrain of the
    // street before it fell across it 0.4 m below the deck, the walker stopping 4.75-6 m south of the axis.
    const [east, west] = [{ x: 2458.7, z: 302.7 }, { x: 2412.6, z: 318.7 }];
    const len = Math.hypot(west.x - east.x, west.z - east.z);
    const u = { x: (east.x - west.x) / len, z: (east.z - west.z) / len };
    const n = { x: -u.z, z: u.x };
    const fails: string[] = [];
    for (const off of [-6, -4.5, -3, -1.5, 0, 1.5, 3, 4.5, 4.75, 5.25, 5.75, 6.25]) {
      const edge = { x: west.x + n.x * off, z: west.z + n.z * off };
      const [street, deck] = [{ x: edge.x - u.x * 8, z: edge.z - u.z * 8 }, { x: edge.x + u.x * 8, z: edge.z + u.z * 8 }];
      expect(bridgeDeckAt(deck.x, deck.z), `${off}`).not.toBeNull();
      for (const [from, to] of [[street, deck], [deck, street]] as const) {
        const sim = Simulation.create({ seed: 3 });
        teleportPlayer(sim, { x: from.x, y: sim.streamer.ground.heightAt(from.x, from.z), z: from.z }, Math.atan2(to.x - from.x, to.z - from.z));
        let [step, prev] = [0, sim.player()!.position.y];
        for (let i = 0; i < 60 * 6; i++) {
          const p = sim.player()!.position;
          if (Math.hypot(to.x - p.x, to.z - p.z) < 0.5) break;
          sim.player()!.yaw = Math.atan2(to.x - p.x, to.z - p.z);
          sim.step(input({ moveZ: 1 }));
          step = Math.max(step, Math.abs(sim.player()!.position.y - prev));
          prev = sim.player()!.position.y;
        }
        const p = sim.player()!.position;
        const left = Math.hypot(to.x - p.x, to.z - p.z);
        if (left >= 0.5 || step >= 0.15) fails.push(`${off} m off the axis, ${from === street ? "on" : "off"}: ${left.toFixed(1)} m short at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}), a step of ${step.toFixed(2)}`);
      }
    }
    expect(fails).toEqual([]);
  });
});
