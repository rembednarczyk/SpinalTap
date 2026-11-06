import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { METRO_ENTRANCES, Simulation, gangerEntity, groundY, heightApart } from "../src";
import { spotFrame } from "../src/content/metro-pavilion";
import { METRO_NAV } from "../src/content/metro-nav";
import { KNEE_HEIGHT } from "../src/systems/ai/steering";
import { EYE_HEIGHT, lineOfSight } from "../src/world/hitscan";
import { LEVEL_GAP } from "../src/world/nav";
import { teleportPlayer } from "./helpers";

/**
 * NPCs chasing the player through a metro entrance (G-368, ADR-0071): an alerted Hebi brawler
 * gets to the player down the pavilion's stairs from the street to the hall and back up, and
 * at an entrance A through the end wall's doorway down the second flight to the platform and
 * back. Stage 2 and 4 drew the stairs as solids in a dug shaft and a vault, and the AI took the
 * shaft's dug floor, a metre under the hall's, for its ground: the hall was the street's floor
 * to it, the stairs a roof, and no level graph led down.
 */

const entrance = (station: string, label: "A" | "B") => METRO_ENTRANCES.find((e) => e.station === station && e.label === label)!;

/**
 * Seconds an alerted brawler (or `kind`) at `from` takes to get within 2.5 m (and a metre of
 * height) of the player at `to`, or to hurt her (a gunner shoots from where it sees her), or null.
 * How far it went from `from` by then is written into `track`.
 */
const chase = (from: Vec3, to: Vec3, chunk: string, seconds: number, kind: "hebi_brawler" | "hebi_ganger" = "hebi_brawler", seed = 3, track = { moved: 0 }): number | null => {
  const sim = Simulation.create({ seed });
  teleportPlayer(sim, to);
  sim.step();
  const p = sim.player()!;
  p.position = { ...to };
  p.prevPosition = p.position;
  const health = p.health!.current;
  const g = gangerEntity(9001, { key: "g368-chaser", position: { ...from }, yaw: 0 }, null, 200, chunk, undefined, kind);
  g.ai!.alerted = true;
  sim.world.add(g);
  for (let i = 0; i < 60 * seconds; i++) {
    sim.step();
    track.moved = Math.hypot(g.position.x - from.x, g.position.z - from.z);
    if (p.health!.current < health) return i / 60;
    if (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1) return i / 60;
  }
  return null;
};

const KANAL_A = entrance("kanal", "A");
const ALCHEMIA_B = entrance("kanal", "B");
/** Chest height of a standing body, as the AI aims (hitscan.ts). */
const CHEST = 1.25;
/** On the street half a metre out of the pavilion's opening, on its axis. */
const outside = (e: typeof KANAL_A): Vec3 => {
  const q = spotFrame(e.spot).point(-0.5, 0);
  return { ...q, y: groundY(q.x, q.z) };
};
const platformOf = (e: typeof KANAL_A): Vec3 => ({ ...spotFrame(e.spot).point(e.platform!.u.back + 2, 0), y: e.platform!.floor });

describe("chasing the player through a metro entrance (G-368)", () => {
  for (const [name, e] of [
    ["Plac Łokietka (kanal A)", KANAL_A],
    ["Alchemia (kanal B)", ALCHEMIA_B],
  ] as const) {
    it(`${name}: from the street down the stairs to the hall`, () => {
      expect(chase(e.door, e.hallSpot, e.chunk, 10)).not.toBeNull();
    });

    it(`${name}: from the hall up the stairs to the street`, () => {
      expect(chase(e.hallSpot, e.door, e.chunk, 10)).not.toBeNull();
    });
  }

  // A gunner takes the head of the stairs for its firing position and stops short of it, within
  // the reach of a node: from there the pavilion's lintel hid the player in the hall (round 2).
  it("Alchemia (kanal B): a gunner at the door gets a shot at the player in the hall", () => {
    for (const seed of [3, 11]) expect(chase(ALCHEMIA_B.door, ALCHEMIA_B.hallSpot, ALCHEMIA_B.chunk, 8, "hebi_ganger", seed), `seed ${seed}`).not.toBeNull();
  });

  // G-377: the ray marched the street chunk's terrain into the shaft up to its next grid line, and
  // hit the street's old surface under the pavilion: a gunner half a metre out of the opening at
  // Alchemia did not see the player in the hall, and went in to the landing or waited for a shot.
  it("a gunner half a metre out of the opening shoots the player in the hall from where it stands", () => {
    for (const e of [ALCHEMIA_B, entrance("shinsekai", "A")]) {
      for (const seed of [3, 5, 11]) {
        const track = { moved: 0 };
        const label = `${e.station} ${e.label} seed ${seed}`;
        expect(chase(outside(e), e.hallSpot, e.chunk, 3, "hebi_ganger", seed, track), label).not.toBeNull();
        expect(track.moved, label).toBeLessThan(0.2);
      }
    }
  });

  it("the street out of the opening and the hall see each other at every entrance (G-377)", () => {
    for (const e of METRO_ENTRANCES) {
      const sim = Simulation.create({ seed: 3 });
      teleportPlayer(sim, e.door);
      sim.step();
      const street = outside(e);
      const eye = { ...street, y: street.y + EYE_HEIGHT };
      const chest = { ...e.hallSpot, y: e.hallSpot.y + CHEST };
      expect(lineOfSight(sim.world, eye, chest), `${e.station} ${e.label} in`).toBe(true);
      expect(lineOfSight(sim.world, { ...e.hallSpot, y: e.hallSpot.y + EYE_HEIGHT }, { ...street, y: street.y + CHEST }), `${e.station} ${e.label} out`).toBe(true);
    }
  });

  it("Plac Łokietka (kanal A): from the hall down the second flight to the platform", () => {
    expect(chase(KANAL_A.hallSpot, platformOf(KANAL_A), KANAL_A.chunk, 12)).not.toBeNull();
  });

  it("Plac Łokietka (kanal A): from the platform up the second flight to the hall", () => {
    expect(chase(platformOf(KANAL_A), KANAL_A.hallSpot, KANAL_A.chunk, 12)).not.toBeNull();
  });

  // Round the pavilion: the street behind it lies over the second flight, which is no way down from there.
  it("Plac Łokietka (kanal A): from the hall to the street behind the pavilion, and back", () => {
    const q = spotFrame(KANAL_A.spot).point(9.5, 0);
    const behind = { ...q, y: groundY(q.x, q.z) };
    expect(chase(KANAL_A.hallSpot, behind, KANAL_A.chunk, 12)).not.toBeNull();
    expect(chase(behind, KANAL_A.hallSpot, KANAL_A.chunk, 12)).not.toBeNull();
  });

  it("Plac Zamkowy (targ A): from the street to the platform, and back", () => {
    const e = entrance("targ", "A");
    expect(chase(e.door, platformOf(e), e.chunk, 12)).not.toBeNull();
    expect(chase(platformOf(e), e.door, e.chunk, 12)).not.toBeNull();
  });

  it("the metro's ways in the level graph are walks in a straight line, clear of the solids", () => {
    const sim = Simulation.create({ seed: 3 });
    const at = new Map(METRO_NAV.nodes.map((n) => [n.id, n.at]));
    for (const e of METRO_ENTRANCES) {
      teleportPlayer(sim, e.door);
      sim.step();
      for (const edge of METRO_NAV.edges.filter((x) => !x.via && x.a.startsWith(`metro-${e.station}-${e.label}-`))) {
        const [a, b] = [at.get(edge.a)!, at.get(edge.b)!];
        expect(lineOfSight(sim.world, { ...a, y: a.y + KNEE_HEIGHT }, { ...b, y: b.y + KNEE_HEIGHT }), `${edge.a} - ${edge.b}`).toBe(true);
      }
    }
  });

  // G-371: the hall in its open shaft and the street by the opening are two floors, 2.7 m apart.
  it("takes the hall and the street for two floors", () => {
    for (const e of METRO_ENTRANCES) {
      const sim = Simulation.create({ seed: 3 });
      expect(heightApart(sim.world, e.hallSpot, e.door), `${e.station} ${e.label}`).toBeGreaterThan(LEVEL_GAP);
    }
  });
});
