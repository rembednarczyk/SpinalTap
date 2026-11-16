import { describe, expect, it } from "vitest";
import { GroundField, MAX_WALK_SLOPE } from "../src";
import { BRIDGE_DECKS } from "../src/content/lublin/decks";
import { WORLD_CHUNKS } from "../src/content/world-map";
import { STEP_HEIGHT, offTheBank } from "../src/systems/movement-system";
import { deckHeight, makeDeck } from "../src/world/deck";
import { gridOf } from "./terrain-world";

/**
 * A small floor like the side of the lower bridge of Mełgiewska's deck at its end (G-898): a bank
 * falling 2:1 to the south, `lip` metres below a deck at y = 0 at its edge z = 10, and the deck
 * level on it to the north. With `deck` false the bank only, rising on to y = 0 at z = 10.
 */
const floor = (lip: number, deck = true): GroundField => {
  const bounds = { minX: 0, maxX: 4, minZ: 8, maxZ: 12 };
  const top = 10 + lip / 2;
  const terrain = gridOf(0, 8, 0.05, 81, 81, (_x, z) => (deck ? (z < top ? 2 * (z - top) : 0) : Math.min(0, 2 * (z - 10))));
  const decks = deck ? [makeDeck([0, 10, 4, 10, 4, 12, 0, 12], [0, 11, 4, 11], () => 0)] : [];
  return new GroundField([{ bounds, terrain, decks }]);
};

/** Where feet on the bank just under the deck's edge get, going 6 cm north at it (a ganger's step of 60 Hz). */
const stepNorth = (field: GroundField, z: number) => {
  const feet = field.heightAt(2, z, -Infinity);
  const to = offTheBank(field, { x: 2, y: feet, z }, 2, z + 0.06, feet);
  return { feet, rise: field.heightAt(to.x, to.z, feet + STEP_HEIGHT) - feet, moved: to.z - z };
};

describe("the edge of a bridge's deck a step or less over the bank beside it (G-898)", () => {
  it("is a step up onto the deck, not a bank: the slope there over half a metre is the bank's", () => {
    const field = floor(0.12);
    const z = 9.98;
    // The deck past the edge reads as steep, the movement's own measure.
    expect(field.steepAt(2, z + 0.06, field.heightAt(2, z, -Infinity) + STEP_HEIGHT)).toBe(true);
    const { feet, rise, moved } = stepNorth(field, z);
    expect(feet).toBeLessThan(-0.1);
    expect(moved).toBeCloseTo(0.06, 6);
    expect(rise).toBeCloseTo(-feet, 6);
  });

  it("but an edge higher than a step stays a wall, and the bank alone stays a bank", () => {
    for (const field of [floor(STEP_HEIGHT + 0.15), floor(0, false)]) {
      const { moved } = stepNorth(field, 9.98);
      expect(moved).toBeCloseTo(0, 6);
    }
  });

  it("lets feet up onto every bridge's deck in Lublin from the terrain beside its edge a step or less below", () => {
    const field = new GroundField(WORLD_CHUNKS, WORLD_CHUNKS.flatMap((c) => c.cuts ?? []), WORLD_CHUNKS.flatMap((c) => c.vaults ?? []));
    const held: string[] = [];
    let lips = 0;
    for (const [chunk, decks] of BRIDGE_DECKS)
      for (const d of decks.filter((e) => e.flight !== true))
        d.ring.forEach((a, i) => {
          const b = d.ring[(i + 1) % d.ring.length]!;
          const len = Math.hypot(b.x - a.x, b.z - a.z);
          const [nx, nz] = [(b.z - a.z) / len, (a.x - b.x) / len];
          // Every 25 cm along the side, 3 cm either side of it: the ring's winding left open.
          for (let s = 0.1; s < len - 0.1; s += 0.25)
            for (const k of [0.03, -0.03]) {
              const [px, pz] = [a.x + ((b.x - a.x) * s) / len, a.z + ((b.z - a.z) * s) / len];
              const [out, into] = [{ x: px + nx * k, z: pz + nz * k }, { x: px - nx * k, z: pz - nz * k }];
              const feet = field.heightAt(out.x, out.z, -Infinity);
              const deck = deckHeight(d, into.x, into.z);
              const climb = deck - feet;
              if (climb <= 0.02 || climb > STEP_HEIGHT || field.heightAt(into.x, into.z, feet + STEP_HEIGHT) !== deck) continue;
              lips++;
              const to = offTheBank(field, { x: out.x, y: feet, z: out.z }, into.x, into.z, feet);
              if (Math.hypot(to.x - into.x, to.z - into.z) > 1e-9) held.push(`${chunk} ${out.x.toFixed(1)},${out.z.toFixed(1)} +${climb.toFixed(2)}`);
            }
        });
    expect(lips).toBeGreaterThan(100);
    expect(held).toEqual([]);
  });

  it("nor is a deck itself a bank anywhere in Lublin: no bridge's deck rises along its axis steeper than a walk", () => {
    for (const [chunk, decks] of BRIDGE_DECKS)
      for (const d of decks.filter((e) => e.flight !== true)) expect(Math.abs(d.yb - d.ya), chunk).toBeLessThanOrEqual(MAX_WALK_SLOPE * Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z));
  });
});
