import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import {
  ALCHEMIA_PROPS,
  DEPTAK_NIGHT_CROWD,
  DEPTAK_NIGHT_PROPS,
  DEPTAK_NIGHT_SOLID_PROPS,
  PAVILION_ROOF_PROPS,
  DEPTAK_NIGHT_STRINGS,
  DEPTAK_KIOSKS,
  Simulation,
  YATAI,
  deptakNightPieces,
  groundY,
  stringY,
} from "../src";
import { PAVILION_CORNERS } from "../src/content/alchemia/pavilion";
import { teleportPlayer } from "./helpers";

/*
 * The deptak's south end at night (user's notes of 22.11, `deptak-night.ts`): the chōchin strung
 * from the pavilion's attic to the tenement's wall over the way, the yatai at its east edge, the way
 * past it open. Measured by its pieces and a stepped player.
 */

const PIECES = deptakNightPieces();
const LANTERNS = PIECES.filter((p) => p.kind === "lantern");
const mid = (b: { x0: number; x1: number; z0: number; z1: number }) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 });

/** The deptak's axis (w216497220, T-324) and the trolleybus's line 1.6 m east of it (`deptak-checks.ts`). */
const AXIS = [
  { x: 442.9, z: -9.9 },
  { x: 454.9, z: 42.8 },
] as const;
const offAxis = (x: number, z: number): number => {
  const [a, b] = AXIS;
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  return ((x - a.x) * dz - (z - a.z) * dx) / Math.hypot(dx, dz);
};

describe("the deptak's south end at night (22.11)", () => {
  it("strings three lines of chōchin from the pavilion's attic to the tenement's wall", () => {
    expect(DEPTAK_NIGHT_STRINGS).toHaveLength(3);
    const [, a, b] = PAVILION_CORNERS;
    for (const s of DEPTAK_NIGHT_STRINGS) {
      // On the pavilion's east face, within its attic (roof 3.85 to 4.85).
      expect(Math.abs(s.a.x - (a.x + ((b.x - a.x) * (s.a.z - a.z)) / (b.z - a.z)))).toBeLessThan(0.1);
      expect(s.a.y).toBeGreaterThan(3.85);
      expect(s.a.y).toBeLessThan(4.85);
      // On the tenement w66286394's wall, its west face south of the bay or the bay's front.
      const wall = s.b.z <= -4 ? 452.7 + (1.5 * (s.b.z + 11.6)) / 7.6 : 454.1;
      expect(Math.abs(s.b.x - wall)).toBeLessThan(0.1);
    }
  });

  it("hangs every string's lantern from it, high over a walker's head", () => {
    const onString = LANTERNS.filter((l) => l.box.y0 > 2.5);
    expect(onString.length).toBeGreaterThanOrEqual(30);
    for (const l of onString) {
      const c = mid(l.box);
      const s = DEPTAK_NIGHT_STRINGS.find((q) => Math.abs(q.a.z - c.z) < 0.01)!;
      expect(c.x).toBeGreaterThan(s.a.x + 1);
      expect(c.x).toBeLessThan(s.b.x - 1);
      expect(stringY(s, c.x) - l.box.y1).toBeCloseTo(0.22, 1);
      expect(l.box.y0 - groundY(c.x, c.z)).toBeGreaterThan(3.2);
      expect(l.solid).toBe(false);
    }
  });

  it("stands the yatai by the deptak's east edge, clear of the trolleybus's line, the way past it open", () => {
    const solids = PIECES.filter((p) => p.solid);
    expect(solids.map((p) => p.kind).sort()).toEqual(["chair", "chair", "counter", "crate", "crate", "crate", "lightbox"]);
    // `deptak-stall-clear`'s room from the line (1.6 m east of the axis) and more.
    for (const p of solids) expect(Math.min(offAxis(p.box.x0, p.box.z0), offAxis(p.box.x0, p.box.z1))).toBeGreaterThan(1.6 + 2);
    // From the MPK kiosk's east face (a hand over a metre from its middle) to the stools: a way of 4 m and more.
    const mpk = DEPTAK_KIOSKS.find((k) => Math.abs(k.z + 5) < 1)!;
    const west = Math.min(...solids.map((p) => p.box.x0));
    expect(west - (mpk.x + 1.2)).toBeGreaterThan(4);
    // The cart's solids among Alchemia's last, so every id above stays.
    expect(ALCHEMIA_PROPS.slice(-DEPTAK_NIGHT_SOLID_PROPS.length - PAVILION_ROOF_PROPS.length, -PAVILION_ROOF_PROPS.length)).toEqual(DEPTAK_NIGHT_SOLID_PROPS);
  });

  it("puts its cook behind the cart and the two at it out of every solid", () => {
    const [cook] = DEPTAK_NIGHT_PROPS;
    expect(cook!.x).toBeGreaterThan(YATAI.x1 + 0.3);
    const solids = PIECES.filter((p) => p.solid).map((p) => p.box);
    for (const s of DEPTAK_NIGHT_CROWD) for (const b of solids) expect(s.at.x > b.x0 - 0.25 && s.at.x < b.x1 + 0.25 && s.at.z > b.z0 - 0.25 && s.at.z < b.z1 + 0.25).toBe(false);
  });

  it("stops a player walking into the cart", () => {
    const sim = Simulation.create({ seed: 5 });
    const [x, z] = [447.5, -6.0];
    teleportPlayer(sim, { x, y: groundY(x, z) + 0.05, z }, Math.PI / 2);
    sim.step();
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    for (let i = 0; i < 60 * 4; i++) sim.step({ ...EMPTY_INPUT, moveZ: 1 });
    expect(sim.player()!.position.x).toBeLessThan(YATAI.x0 - 0.2);
  });
});
