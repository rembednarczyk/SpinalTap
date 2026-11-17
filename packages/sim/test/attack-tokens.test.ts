import { describe, expect, it } from "vitest";
import type { EnemyTypeId } from "@seki/core";
import { type Entity, SIM_HZ, Simulation, gangerEntity } from "../src";
import { ATTACK_TOKENS, SPREAD, TOKEN_HOLD, holdsToken, spreadOf } from "../src/systems/ai/ganger-tokens";
import { FLOOR, floorAt } from "./fixtures/determinism-floor";
import { collect, teleportPlayer } from "./helpers";
import { BARK_GAP } from "../src/systems/ai/ganger-ai-system";
import { setProfile } from "./difficulty-scenes";

/*
 * ADR-0089 stage 4: attack tokens. Of six alerted Tessen guards no more than `ATTACK_TOKENS` fire
 * at the player in any step (Normal; Story and Hard come with stage 5's `npcPressure`), and those
 * without a token part round her to 35° or more from the nearest one firing, instead of firing
 * from one line. A nearer guard takes over the farthest holder's token once it has held it 2 s.
 * On the open south of the determinism test's floor.
 */

type Shot = { readonly shooterId: number };
const AT = floorAt(0, -45);
const flat = (x: number, z: number) => ({ x, y: AT.y, z });

/** The player standing at `AT` (kept alive), guards of `type` at the given bearings and distances round her. */
/** `npcPressure` is set before they come: in a fight a new profile waits for its end (G-171). */
const ring = (spots: readonly (readonly [number, number])[], type: EnemyTypeId = "tessen_guard", npcPressure = 1) => {
  const sim = Simulation.create({ seed: 2, chunks: FLOOR });
  teleportPlayer(sim, AT);
  sim.step();
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  if (npcPressure !== 1) setProfile(sim, { npcPressure });
  expect(sim.domain.difficulty.npcPressure).toBe(npcPressure);
  const guards = spots.map(([deg, d], i) => {
    const a = (deg * Math.PI) / 180;
    const at = flat(AT.x + Math.sin(a) * d, AT.z + Math.cos(a) * d);
    const g = gangerEntity(90200 + i, { key: `token-${i}`, position: at, yaw: a + Math.PI }, null, 1e6, sim.streamer.chunkIdAt(at), undefined, type);
    g.ai!.alerted = true;
    sim.world.add(g);
    return g;
  });
  return { sim, guards };
};

const step = (sim: Simulation): void => {
  const p = sim.player()!;
  p.health = { ...p.health!, current: p.health!.max };
  sim.step();
};

const holds = (sim: Simulation, g: Entity): boolean => holdsToken(g, sim.tick);
const dist = (sim: Simulation, g: Entity): number => Math.hypot(g.position.x - sim.player()!.position.x, g.position.z - sim.player()!.position.z);

describe("attack tokens (ADR-0089 stage 4)", () => {
  // Stage 5: the difficulty's pressure sets how many fire at once, Story 1, Normal 2, Hard 3.
  it.each([
    [0.6, 1],
    [1, 2],
    [1.5, 3],
  ])("under a pressure of %f no more than %i of six guards fire at once, and that many do", (npcPressure, most) => {
    const { sim, guards } = ring([
      [-25, 18],
      [-15, 20],
      [-5, 17],
      [5, 21],
      [15, 19],
      [25, 18],
    ], "tessen_guard", npcPressure);
    let seen = 0;
    for (let i = 0; i < 8 * SIM_HZ; i++) {
      step(sim);
      const holding = guards.filter((g) => holds(sim, g)).length;
      expect(holding, `step ${i}`).toBeLessThanOrEqual(most);
      seen = Math.max(seen, holding);
    }
    expect(seen).toBe(most);
  });

  it("of six Tessen guards no more than two fire in a step, and the rest part round her to 35° or more", () => {
    // Six in a 50° arc in front of her, 17-21 m off: one line of fire.
    const { sim, guards } = ring([
      [-25, 18],
      [-15, 20],
      [-5, 17],
      [5, 21],
      [15, 19],
      [25, 18],
    ]);
    const shots = collect<Shot>(sim, "ShotFired");
    let fired = 0;
    const waitingSince = new Map<Entity, number>();
    for (let i = 0; i < 12 * SIM_HZ; i++) {
      const n = shots.length;
      step(sim);
      const shooters = new Set(shots.slice(n).map((s) => s.shooterId));
      const holding = guards.filter((g) => holds(sim, g));
      expect(holding.length, `step ${i}`).toBeLessThanOrEqual(ATTACK_TOKENS);
      for (const id of shooters) expect(holding.map((g) => g.id), `step ${i}`).toContain(id);
      fired += shooters.size;
      for (const g of guards) {
        if (holding.includes(g)) waitingSince.delete(g);
        else if (!waitingSince.has(g)) waitingSince.set(g, i);
      }
    }
    expect(fired).toBeGreaterThan(5);
    const her = sim.player()!.position;
    const end = 12 * SIM_HZ - 1;
    // Who has waited for a token 4 s or more stands 35° or more round her from the nearest holder.
    const settled = guards.filter((g) => end - (waitingSince.get(g) ?? end) >= 4 * SIM_HZ);
    expect(settled.length).toBeGreaterThanOrEqual(2);
    for (const g of settled) expect(spreadOf(sim.world, sim.tick, g, her), g.key).toBeGreaterThanOrEqual(SPREAD);
  });

  it("a nearer guard takes over the farthest holder's token once it has been held 2 s", () => {
    const { sim, guards } = ring([
      [-10, 22],
      [10, 23],
    ]);
    const [a, b] = guards as [Entity, Entity];
    for (let i = 0; i < 10 * SIM_HZ && !(holds(sim, a) && holds(sim, b)); i++) step(sim);
    expect([holds(sim, a), holds(sim, b)]).toEqual([true, true]);
    // A third comes in nearer, 13 m off between them (it backs off to its band's 14 m).
    const at = flat(AT.x, AT.z + 13);
    const c = gangerEntity(90299, { key: "token-near", position: at, yaw: Math.PI }, null, 1e6, sim.streamer.chunkIdAt(at), undefined, "tessen_guard");
    c.ai!.alerted = true;
    sim.world.add(c);
    let took = -1;
    for (let i = 0; i < (TOKEN_HOLD + 2) * SIM_HZ && took < 0; i++) {
      step(sim);
      if (holds(sim, c)) took = sim.tick;
    }
    expect(took).toBeGreaterThan(0);
    // One of the two gave it up, not the nearer: the other kept its own.
    const kept = [a, b].filter((g) => holds(sim, g));
    const lost = [a, b].filter((g) => !holds(sim, g));
    expect([kept.length, lost.length]).toEqual([1, 1]);
    expect(dist(sim, lost[0]!)).toBeGreaterThanOrEqual(dist(sim, kept[0]!) - 0.5);
  });
});

describe("a gunner's calls in a fight (ADR-0089 stage 6)", () => {
  type Call = { readonly entityId: number; readonly reaction: string };

  it("calls when it starts to reload and when it sets off round her, each gunner no more often than every 6 s", () => {
    const { sim, guards } = ring([
      [-25, 18],
      [-15, 20],
      [-5, 17],
      [5, 21],
      [15, 19],
      [25, 18],
    ]);
    // One with two rounds left reloads soon.
    guards[0]!.combatant!.loaded = 2;
    const calls: (Call & { tick: number })[] = [];
    sim.bus.on("NpcReacted", (e) => calls.push({ ...e, tick: sim.tick }));
    for (let i = 0; i < 12 * SIM_HZ; i++) step(sim);
    expect(calls.some((c) => c.reaction === "reload")).toBe(true);
    expect(calls.some((c) => c.reaction === "flank")).toBe(true);
    for (const g of guards) {
      const own = calls.filter((c) => c.entityId === g.id).map((c) => c.tick);
      for (let k = 1; k < own.length; k++) expect(own[k]! - own[k - 1]!, g.key).toBeGreaterThanOrEqual(BARK_GAP * SIM_HZ);
    }
  });
});
