import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { METRO_ENTRANCES, Simulation, gangerEntity, groundY, heightApart } from "../src";
import { spotFrame } from "../src/content/metro-pavilion";
import { METRO_NAV } from "../src/content/metro-nav";
import { KNEE_HEIGHT } from "../src/systems/ai/steering";
import { lineOfSight } from "../src/world/hitscan";
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

/** Seconds an alerted brawler at `from` takes to get within 2.5 m (and a metre of height) of the player at `to`, or null. */
const chase = (from: Vec3, to: Vec3, chunk: string, seconds: number): number | null => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, to);
  sim.step();
  const p = sim.player()!;
  p.position = { ...to };
  p.prevPosition = p.position;
  const g = gangerEntity(9001, { key: "g368-chaser", position: { ...from }, yaw: 0 }, null, 200, chunk, undefined, "hebi_brawler");
  g.ai!.alerted = true;
  sim.world.add(g);
  for (let i = 0; i < 60 * seconds; i++) {
    sim.step();
    if (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1) return i / 60;
  }
  return null;
};

const KANAL_A = entrance("kanal", "A");
const ALCHEMIA_B = entrance("kanal", "B");
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
