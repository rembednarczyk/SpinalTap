import { describe, expect, it } from "vitest";
import { Simulation, gangerEntity, groundY } from "../src";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { teleportPlayer } from "./helpers";

/**
 * NPCs chasing the player over the steps from the viaduct of Zamkowa (G-255, OSM w56965515), on
 * the AI's own way (the navigation field, ADR-0025): an alerted Hebi brawler gets to the player
 * within 40 s between the viaduct, the foot, the bend, the middle of the upper run and the
 * square beside it, either way, its feet never under the ground the treads are drawn on. The
 * other flights of the map's steps and the ways over and under the viaduct keep theirs.
 */

type P = { readonly x: number; readonly z: number };

/** Seconds an alerted brawler at `from` takes to get within 2.5 m (and a metre of height) of the player at `to`, or null; and how far its feet sank under the drawn ground. */
const chase = (from: P, to: P, chunk: string, seconds = 40): { readonly time: number | null; readonly sunk: number } => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, { x: to.x, y: 0, z: to.z });
  sim.step();
  const ground = sim.streamer.ground;
  const p = sim.player()!;
  p.position = { x: to.x, y: ground.heightAt(to.x, to.z), z: to.z };
  p.prevPosition = p.position;
  const g = gangerEntity(9001, { key: "g255-chaser", position: { x: from.x, y: ground.heightAt(from.x, from.z), z: from.z }, yaw: 0 }, null, 200, chunk, undefined, "hebi_brawler");
  g.ai!.alerted = true;
  sim.world.add(g);
  let sunk = 0;
  for (let i = 0; i < 60 * seconds; i++) {
    sim.step();
    sunk = Math.max(sunk, groundY(g.position.x, g.position.z) - g.position.y);
    if (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1) return { time: i / 60, sunk };
  }
  return { time: null, sunk };
};

const FOOT = { x: 725.5, z: 167 };
const TOP = { x: 742, z: 163 };
const MID = { x: 731.8, z: 161.9 };
const BESIDE = { x: 730.4, z: 164.6 };
const BEND = { x: 729.0, z: 160.5 };

describe("chasing the player over the steps from the viaduct of Zamkowa (G-255)", () => {
  for (const [name, a, b] of [
    ["the viaduct and the foot", TOP, FOOT],
    ["the foot and the middle", FOOT, MID],
    ["the foot and the bend", FOOT, BEND],
    ["the bend and the viaduct", BEND, TOP],
    ["the square beside them and the middle", BESIDE, MID],
  ] as const) {
    it(`gets between ${name}, either way`, () => {
      for (const [from, to] of [
        [a, b],
        [b, a],
      ] as const) {
        const c = chase(from, to, "stare-miasto-1-1");
        expect(c.time, `(${from.x}, ${from.z}) → (${to.x}, ${to.z})`).not.toBeNull();
        expect(c.sunk).toBeLessThan(0.05);
      }
    }, 120_000);
  }

  it("keeps the ways up and down the other flights of the map", () => {
    let n = 0;
    for (const c of MAP_CHUNKS) {
      for (const f of c.flights ?? []) {
        if (n >= 3 || f.id === "w56965515" || f.line.length !== 4) continue;
        const a = { x: f.line[0]!, z: f.line[1]! };
        const b = { x: f.line[2]!, z: f.line[3]! };
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 8 || len > 20 || Math.abs(groundY(a.x, a.z) - groundY(b.x, b.z)) < 1.5) continue;
        n++;
        expect(chase(a, b, c.id).time, `${f.id} up`).not.toBeNull();
        expect(chase(b, a, c.id).time, `${f.id} down`).not.toBeNull();
      }
    }
    expect(n).toBe(3);
  }, 120_000);

  it("keeps the ways over and under the viaduct of Zamkowa: Zamkowa on its deck, Podwale under it", () => {
    for (const [name, a, b, chunk] of [
      ["Zamkowa", { x: 758.5, z: 183.1 }, { x: 732.6, z: 157 }, "podzamcze-1-0"],
      ["Podwale", { x: 751.1, z: 162.2 }, { x: 735.9, z: 176.6 }, "podzamcze-1-0"],
    ] as const) {
      expect(chase(a, b, chunk).time, `${name} one way`).not.toBeNull();
      expect(chase(b, a, chunk).time, `${name} back`).not.toBeNull();
    }
  }, 120_000);

  // From the viaduct's deck east of the flight's top to the foot: on main about
  // 7 s, the time to walk it. A wall in the ground there is measured cell to cell, not from the
  // feet, which on the treads lie off the cells' heights (round 6 stopped by the lower run).
  it("gets from the viaduct's deck east of the flight to the foot in the time to walk it", () => {
    for (const from of [
      { x: 743, z: 168 },
      { x: 745, z: 172 },
      { x: 744, z: 171 },
    ]) {
      const c = chase(from, FOOT, "podzamcze-1-0", 12);
      expect(c.time, `(${from.x}, ${from.z}) → foot`).not.toBeNull();
      expect(c.sunk).toBeLessThan(0.05);
    }
  }, 120_000);
});
