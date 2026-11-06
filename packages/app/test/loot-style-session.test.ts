import { describe, expect, it } from "vitest";
import { type AudioPort, EMPTY_INPUT, type InputFrame, type LootLine, type RenderPort } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { gangerEntity, ground } from "@seki/sim";
import { GameSession } from "../src/game-session";

/*
 * Loot fitted to the player (ADR-0059, stage 6), in play: a player who fights with the SMG alone
 * finds more SMGs in the bags of the enemies than one with no style, for the same seed and the
 * same enemies.
 */

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

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

/** Plac Litewski's south end (ADR-0045): open ground, nobody in the line of fire. */
const SQUARE = ground(70, -50);

/** A new game with an SMG in hand, on the square (through a save, as a load would bring it). */
const armed = async () => {
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render, audio, persistence, ui: createUiStore(), story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27, 21, 0) });
  session.newGame();
  session.step(EMPTY_INPUT);
  const snap = session.saves.snapshot();
  const d = snap.domain;
  const smg = { uid: "i90", def: "hebi_smg" as const, rarity: "common" as const, level: 1, loaded: 30, mods: {} };
  const domain = { ...d, inventory: { ...d.inventory, items: [...d.inventory.items, smg], nextUid: d.inventory.nextUid + 1 }, equipment: { ...d.equipment, primary: "i90", active: "primary" as const } };
  await persistence.save("slot-1", { ...snap, domain });
  expect(await session.saves.loadAsync("slot-1")).toBe(true);
  const p = session.sim.player()!;
  p.position = SQUARE;
  p.prevPosition = SQUARE;
  p.yaw = 0;
  p.pitch = 0;
  session.step(EMPTY_INPUT);
  return session;
};

let nextId = 900_000;
const enemyAhead = (session: GameSession, ahead: number, key: string, type: "hebi_ganger" | "hebi_enforcer") => {
  const p = session.sim.player()!;
  const at = ground(p.position.x, p.position.z + ahead);
  return session.sim.world.add(gangerEntity(nextId++, { key, position: at, yaw: Math.PI }, null, 1, p.chunk ?? "", undefined, type));
};

/** Every enforcer `loot-n` (n below `count`) dies where it stands, ten at a time; the lines of their bags. */
const bagsOf = (session: GameSession, count: number): LootLine[] => {
  const lines: LootLine[] = [];
  for (let n = 0; n < count; n += 10) {
    const batch = Array.from({ length: Math.min(10, count - n) }, (_, i) => enemyAhead(session, 30 + i, `loot-${n + i}`, "hebi_enforcer"));
    for (const e of batch) e.health = { ...e.health!, current: 0 };
    session.step(EMPTY_INPUT);
    for (let i = 0; i < batch.length; i++) lines.push(...(session.sim.domain.loot.containers.find((c) => c.key === `loot:loot-${n + i}`)?.lines ?? []));
  }
  return lines;
};

const smgs = (lines: readonly LootLine[]) => lines.filter((l) => l.kind === "item" && l.item === "hebi_smg").length;

describe("loot fitted to the player's style in play (ADR-0059, stage 6)", () => {
  it("a player who shot down her enemy with the SMG finds more SMGs in the bags than one with no style", async () => {
    const shooter = await armed();
    const target = enemyAhead(shooter, 5, "first", "hebi_ganger");
    for (let i = 0; i < 60 && shooter.sim.world.has(target); i++) shooter.step(frame({ fire: true }));
    expect(shooter.sim.world.has(target)).toBe(false);
    expect(shooter.sim.domain.progression.style).toEqual(["smg"]);

    const plain = await armed();
    expect(plain.sim.domain.progression.style).toEqual([]);
    const styled = bagsOf(shooter, 120);
    const unstyled = bagsOf(plain, 120);
    // The same bags otherwise: the enforcers' guaranteed shotguns and money are the same.
    expect(styled.filter((l) => l.kind === "eddies")).toEqual(unstyled.filter((l) => l.kind === "eddies"));
    expect(unstyled.length).toBeGreaterThan(120 * 3);
    // 5 of 100 in the Hebi table against 8 of 103 for her: about half again as many.
    expect(smgs(unstyled)).toBeGreaterThan(5);
    expect(smgs(styled)).toBeGreaterThan(smgs(unstyled) * 1.2);
  });
});
