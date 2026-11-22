import { describe, expect, it } from "vitest";
import { ALCHEMIA_UNITS, EXIT_FLOORS, EXIT_SIGNS, STAIR_CORES } from "@seki/sim";
import { ALCHEMIA_LAMPS, ALCHEMIA_LAMP_PREFIX } from "../src/renderer/alchemia/alchemia-lights";

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lampOf = (name: string) => ALCHEMIA_LAMPS.find((l) => l.key === `${ALCHEMIA_LAMP_PREFIX}${name}`)!;

/**
 * Functional contrast (`docs/zasady-lokacji.md` §13, the user's rule of 22.11): what the player has
 * business with stands out of its room. In Alchemia the counters of the game's people get a whiter,
 * brighter pool than the food hall's kitchens, and each core's door on every floor its green exit sign
 * with a green light under it.
 */
describe("Alchemia's functional contrast (§13)", () => {
  it("lights the keepers' counters whiter and brighter than the other kitchens", () => {
    const open = ALCHEMIA_UNITS.filter((u) => !u.shut);
    const keepers = open.filter((u) => u.keeper);
    const others = open.filter((u) => !u.keeper);
    expect(keepers.map((u) => u.keeper).sort()).toEqual(["fumiko", "goro", "kenta", "oyaji", "sachiko"]);
    expect(others.length).toBeGreaterThan(0);
    for (const k of keepers) {
      const kl = lampOf(`kitchen-${k.id}`).light;
      for (const o of others) {
        const ol = lampOf(`kitchen-${o.id}`).light;
        expect(kl.intensity, k.id).toBeGreaterThan(ol.intensity * 1.5);
        // Whiter: its blue nearer its red than the kitchens' orange.
        const [kr, , kb] = rgb(kl.color);
        const [or, , ob] = rgb(ol.color);
        expect(kb / kr, k.id).toBeGreaterThan(ob / or + 0.3);
      }
      // Over the counter: inside its unit, by its open side.
      const q = k.rect;
      const p = kl.position;
      expect(p.x).toBeGreaterThanOrEqual(q.minX);
      expect(p.x).toBeLessThanOrEqual(q.maxX);
      expect(p.z).toBeGreaterThanOrEqual(q.minZ);
      expect(p.z).toBeLessThanOrEqual(q.maxZ);
    }
  });

  it("hangs one green sign and one green light over each core's door on every floor it opens onto", () => {
    const floors = STAIR_CORES.reduce((n, c) => n + EXIT_FLOORS(c).length, 0);
    expect(floors).toBeGreaterThanOrEqual(STAIR_CORES.length * 3);
    expect(EXIT_SIGNS).toHaveLength(floors);
    const exits = ALCHEMIA_LAMPS.filter((l) => l.key.startsWith(`${ALCHEMIA_LAMP_PREFIX}exit-`));
    expect(exits).toHaveLength(floors);
    for (const [i, s] of EXIT_SIGNS.entries()) {
      expect(s.kind, `sign ${i}`).toBe("led-green");
      const l = exits[i]!.light;
      const [r, g, b] = rgb(l.color);
      expect(g, `exit ${i}`).toBeGreaterThan(1.5 * Math.max(r, b));
      // At the sign, on its own floor only.
      expect(l.position.x).toBeGreaterThanOrEqual(s.box.x0 - 0.01);
      expect(l.position.x).toBeLessThanOrEqual(s.box.x1 + 0.01);
      expect(l.clip.maxY - l.clip.minY).toBeLessThan(2.8);
    }
  });
});
