import { describe, expect, it } from "vitest";
import { CONTRACT_ITEM_SPOTS, DOKI_ITEM_SPOTS, Simulation, enemySees, gangerEntity } from "../src";
import { run, streetSim, teleportPlayer } from "./helpers";
import { CROUCH, SIGHTED, creepAndTakeDown, emptySquare, enemyAt, secondsToAlarm, sneakToObjective, stealthContract } from "./stealth-scenes";

/*
 * Stage 1 of ADR-0069: every enemy with the AI of a ganger sees by its type's profile, in a cone,
 * a crouching player from half as far, and fills a suspicion before the alarm. Measured on Plac
 * Litewski (seed 7, Normal), the enemy north of the player.
 */

describe("one sight for every enemy (ADR-0069)", () => {
  for (const type of SIGHTED) {
    describe(type, () => {
      it("is taken down from behind, crouched, from 2, 5 and 10 m, with no alarm", () => {
        for (const d of [2, 5, 10]) {
          const sim = emptySquare(true);
          expect(creepAndTakeDown(sim, enemyAt(sim, type, d)), `${d} m`).toBe("knocked-out");
        }
      });

      it("raises the alarm within 0.6 s at a player standing 5 m in front of it, not in the first step", () => {
        const sim = emptySquare(false);
        const s = secondsToAlarm(sim, enemyAt(sim, type, 5, true));
        expect(s).not.toBeNull();
        expect(s!).toBeGreaterThan(0.2);
        expect(s!).toBeLessThanOrEqual(0.6 + 1e-9);
      });

      it("raises the alarm at a player crouching 5 m in front of it", () => {
        const sim = emptySquare(true);
        expect(secondsToAlarm(sim, enemyAt(sim, type, 5, true), CROUCH)).not.toBeNull();
      });

      it("takes longer on awareness 0.6 and less on 1.3 (ADR-0066)", () => {
        const at = (awareness: number) => {
          const sim = emptySquare(false, awareness);
          return secondsToAlarm(sim, enemyAt(sim, type, 5, true))!;
        };
        const normal = at(1);
        expect(at(0.6)).toBeGreaterThan(normal);
        expect(at(1.3)).toBeLessThan(normal);
      });
    });
  }

  it("a crouching player beyond half its sight goes unseen in front of it, a standing one does not", () => {
    // 11 m: past the 8.5 m a Hebi ganger sees a crouching player from.
    const crouched = emptySquare(true);
    expect(secondsToAlarm(crouched, enemyAt(crouched, "hebi_ganger", 11, true), CROUCH)).toBeNull();
    const standing = emptySquare(false);
    expect(secondsToAlarm(standing, enemyAt(standing, "hebi_ganger", 11, true))).not.toBeNull();
  });

  it("sees a player standing right behind it, not one crouching there", () => {
    const standing = emptySquare(false);
    expect(secondsToAlarm(standing, enemyAt(standing, "hebi_ganger", 1.8))).not.toBeNull();
    const crouched = emptySquare(true);
    const g = enemyAt(crouched, "hebi_ganger", 1.8);
    run(crouched, 120, CROUCH);
    expect(g.ai!.alerted).toBe(false);
    expect(g.ai!.suspicion ?? 0).toBe(0);
  });

  it("turns to her on the first suspicion, so a takedown from the front is gone before the alarm", () => {
    const sim = emptySquare(false);
    // 9 m off, 0.9 rad to the side of its facing: in the cone, not yet in front of it.
    const p = sim.player()!.position;
    const g = sim.world.add(
      gangerEntity(4100, { key: "turner", position: { x: p.x + Math.sin(0.9) * 9, y: p.y, z: p.z + Math.cos(0.9) * 9 }, yaw: Math.PI }, null, 1e6, sim.player()!.chunk ?? ""),
    );
    const yaw0 = g.yaw;
    sim.step();
    expect(g.ai!.suspicion).toBeGreaterThan(0);
    run(sim, 10);
    expect(g.ai!.alerted).toBe(false);
    const towards = Math.atan2(p.x - g.position.x, p.z - g.position.z);
    const off = (a: number) => Math.abs(Math.atan2(Math.sin(a - towards), Math.cos(a - towards)));
    expect(off(g.yaw)).toBeLessThan(off(yaw0));
  });

  it("alerted, it sees all round; a friendly one only watches what is in its cone, with no suspicion", () => {
    const sim = streetSim({ seed: 7 });
    const g = gangerEntity(9, { key: "t", position: { x: 0, y: 0, z: 3 }, yaw: 0 }, null, 80, "c");
    const player = sim.player()!;
    teleportPlayer(sim, { x: 0, y: 0, z: 0 });
    expect(enemySees(g, player, 3, true, 17)).toBe(false);
    g.ai!.alerted = true;
    expect(enemySees(g, player, 3, true, 17)).toBe(true);
    const friendly = Simulation.fromSnapshot({ ...sim.snapshot(null, "t", ""), domain: { ...sim.domain, reputation: { ...sim.domain.reputation, hebi: 30 } } });
    for (const e of [...friendly.world.with("ai")]) friendly.world.remove(e);
    const pf = friendly.player()!;
    pf.yaw = 0;
    const watcher = enemyAt(friendly, "hebi_ganger", 5, true);
    run(friendly, 60);
    expect(watcher.ai!.alerted).toBe(false);
    expect(watcher.ai!.sees).toBe(true);
    expect(watcher.ai!.suspicion ?? 0).toBe(0);
  });
});

describe("the stealth contracts can be done from behind the posts (ADR-0069, ADR-0065)", () => {
  const cases = [
    { kind: "retrieve", at: CONTRACT_ITEM_SPOTS.hebi_stash! },
    { kind: "infiltrate", at: DOKI_ITEM_SPOTS.tessen_office! },
  ] as const;
  for (const { kind, at } of cases) {
    for (const completed of [0, 5]) {
      for (const seed of [4, 21, 42, 77]) {
        it(`${kind}, ${completed} jobs done, seed ${seed}: the objective is taken with no alarm, the posts watching it taken down from behind`, () => {
          const { sim, contract } = stealthContract(kind, seed, completed);
          expect(sneakToObjective(sim, contract, at), JSON.stringify(contract.variation)).not.toBeNull();
        });
      }
    }
  }
});
