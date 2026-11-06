import { describe, expect, it } from "vitest";
import { type AudioPort, EMPTY_INPUT, INITIAL_PROGRESSION, type RenderPort, enemyScale, xpForLevel } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { GANGER_MAX_HP, ground, market } from "@seki/sim";
import { GameSession } from "../src/game-session";

const render: RenderPort = {
  spawn() {},
  updateTransform() {},
  despawn() {},
  clear() {},
  setCameraMode() {},
  attachCamera() {},
  playEffect() {},
  setAppearance() {},
};
const audio: AudioPort = { play() {}, stopAll() {} };

const steps = (s: GameSession, n: number) => {
  for (let i = 0; i < n; i++) s.step(EMPTY_INPUT);
  s.render(0);
};

const teleport = (s: GameSession, x: number, z: number) => {
  const p = s.sim.player()!;
  p.position = ground(x, z);
  p.prevPosition = p.position;
};

/** A new game whose player is at `level` (through a save, as a load would bring it). */
const atLevel = async (level: number) => {
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render, audio, persistence, ui: createUiStore(), story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27, 21, 0) });
  session.newGame();
  steps(session, 1);
  const snap = session.saves.snapshot();
  const progression = { ...INITIAL_PROGRESSION, xp: xpForLevel(level), level, unspent: { attribute: level - 1, perk: level - 1 } };
  await persistence.save("slot-1", { ...snap, domain: { ...snap.domain, progression } });
  expect(await session.saves.loadAsync("slot-1")).toBe(true);
  return session;
};

const byKey = (s: GameSession, key: string) => [...s.sim.world].find((e) => e.key === key);

describe("enemy level by district band in play (ADR-0059, stage 5)", () => {
  it("a Hebi lookout on the market (Podzamcze, 10-20) is above a level 3 player, and as tough as its level", async () => {
    const session = await atLevel(3);
    const lookout = market(104, 0, 92);
    teleport(session, lookout.x, lookout.z - 12);
    steps(session, 2);
    const g = byKey(session, "hebi-lookout")!;
    expect(g.enemy?.level).toBe(10);
    expect(g.enemy!.level!).toBeGreaterThan(session.sim.domain.progression.level);
    expect(g.health).toEqual({ current: Math.round(GANGER_MAX_HP * enemyScale(10)), max: Math.round(GANGER_MAX_HP * enemyScale(10)) });
  });

  it("the car wash guard in Krakowskie (1-8) stays below a level 12 player", async () => {
    const session = await atLevel(12);
    const g = byKey(session, "guard")!;
    expect(g.enemy?.level).toBe(8);
    expect(g.enemy!.level!).toBeLessThan(session.sim.domain.progression.level);
  });
});
