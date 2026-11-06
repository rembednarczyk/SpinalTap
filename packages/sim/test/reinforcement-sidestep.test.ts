import { describe, expect, it } from "vitest";
import type { HeatLevel, HeatState, SaveSnapshot } from "@seki/core";
import { Simulation, docks, stateHash } from "../src";
import { alleySim, teleportPlayer } from "./helpers";

/**
 * The side a reinforcement first leans to when it gets stuck (ADR-0025, G-208): by which of the
 * heat's it is (`security.n`), not by its id, which a loaded game gives otherwise. With the
 * player on the roof of a warehouse in the docks the Tessen's reinforcements have no repath and
 * lean to the side, so the rule shows in the game without any save.
 */

const ROOF = docks(-28, 9, 107);
const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

/** The snapshot as v30 wrote it, before the style and bad luck (ADR-0059, stage 6): the progression without them. */
const beforeV31 = (s: SaveSnapshot): SaveSnapshot => {
  const { style: _s, unlucky: _u, ...progression } = s.domain.progression;
  return { ...s, domain: { ...s.domain, progression } } as unknown as SaveSnapshot;
};

/** The snapshot as v28 wrote it, before item levels (ADR-0059, stage 4): the pieces without them. */
const beforeV29 = (v31: SaveSnapshot): SaveSnapshot => {
  const s = beforeV31(v31);
  const strip = <T extends object>(p: T): T => {
    const { level: _l, traits: _t, ...rest } = p as T & { level?: number; traits?: unknown };
    return rest as T;
  };
  const containers = s.domain.loot.containers.map((c) => ({ ...c, lines: c.lines.map(strip) }));
  return { ...s, domain: { ...s.domain, inventory: { ...s.domain.inventory, items: s.domain.inventory.items.map(strip) }, loot: { ...s.domain.loot, containers } } };
};

const onTheRoof = (seed: number, level: HeatLevel): Simulation => {
  const start = alleySim({ seed });
  teleportPlayer(start, ROOF);
  const fresh = start.snapshot(null, "t", "");
  const heat: HeatState = { level, faction: "tessen", searching: true, lastKnown: ROOF, searchLeft: 30, cooldown: 0 };
  const sim = Simulation.fromSnapshot(roundTrip({ ...fresh, domain: { ...fresh.domain, heat } }));
  // The reinforcements' ids follow the city's entities, so a building more in the map (G-098)
  // flips their parity. Ids spent here give the first one (number 1) an even id: by its id it
  // would lean the other way, whatever the map.
  if (sim.streamer.takeId() % 2 === 0) sim.streamer.takeId();
  return sim;
};

describe("a reinforcement leans to the side of its number (G-208)", () => {
  // With the hashes of the run as schemas v28 and v27 wrote it: the item levels of v29 (ADR-0059,
  // stage 4) are fields of the starter kit here; G-233 and the market move (v30) change only the version. Re-recorded for
  // ADR-0059, stage 5, a new rule: the Tessen reinforcements are of the docks' level 16, tougher
  // (and saved with their maximum health). Re-recorded for the v31 style and bad luck (ADR-0059,
  // stage 6), fields: as v30 the runs hash to the goldens of before. Re-recorded for the v32
  // version of the cyberdeck's grades: nobody here has a deck, so as v31 they hash as before.
  for (const [seed, level, golden, v31, v30, v28, v27] of [
    [21, 2, "4ba6c2d7", "1dcd58a8", "86fb3887", "96f59679", "5b25c2ac"],
    [5, 3, "e4cb37dd", "f462c19c", "4b807e73", "87e672a5", "ff83146a"],
  ] as const) {
    it(`seed ${seed}, ${level} stars, the player on a roof in the docks`, () => {
      const sim = onTheRoof(seed, level);
      const first = new Map<number, 1 | -1>();
      let leaningOtherwise = 0;
      for (let i = 0; i < 900; i++) {
        sim.step();
        for (const e of sim.world.with("security")) {
          if (e.walk && !first.has(e.id)) first.set(e.id, e.walk.side);
          const leaning = e.walk && !e.walk.plan && sim.tick < e.walk.unstickUntil;
          // One whose id and number differ in parity: by its id it would lean the other way.
          if (leaning && e.security.n % 2 !== e.id % 2) leaningOtherwise++;
        }
      }
      expect(leaningOtherwise).toBeGreaterThan(0);
      for (const e of sim.world.with("security")) {
        expect({ n: e.security.n, side: first.get(e.id) }).toEqual({ n: e.security.n, side: e.security.n % 2 === 0 ? 1 : -1 });
      }
      // The run with the rule (seed 21: by the ids it parts otherwise some 510 steps in).
      const snap = sim.snapshot(null, "t", "");
      expect(stateHash({ ...snap, version: 31 } as unknown as SaveSnapshot)).toBe(v31);
      expect(stateHash(snap)).toBe(golden);
      expect(stateHash({ ...beforeV31(snap), version: 30 } as unknown as SaveSnapshot)).toBe(v30);
      const old = beforeV29(snap);
      expect(stateHash({ ...old, version: 28 } as unknown as SaveSnapshot)).toBe(v28);
      expect([snap.strayBodies, stateHash({ ...old, version: 27 } as unknown as SaveSnapshot)]).toEqual([undefined, v27]);
    });
  }
});
