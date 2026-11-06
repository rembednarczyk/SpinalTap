import { describe, expect, it } from "vitest";
import { type AudioPort, EMPTY_INPUT, INITIAL_PROGRESSION, type InputFrame, type RenderPort, SHOPS, hasItemLevel, shopTerms, stockEntry, stockPrice, xpForLevel } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MIGRATIONS, MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { STALL_FRONT_YAW, STALL_KEEPERS, ground } from "@seki/sim";
import { GameSession } from "../src/game-session";

/** On the path in front of Alchemia's stalls (ADR-0063), a few metres from Oyaji's. */
const OUT = { x: Math.sin(STALL_FRONT_YAW), z: Math.cos(STALL_FRONT_YAW) };
const STALLS = ground(STALL_KEEPERS.oyaji.x + OUT.x * 4, STALL_KEEPERS.oyaji.z + OUT.z * 4);

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

const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

const teleport = (s: GameSession, x: number, z: number) => {
  const p = s.sim.player()!;
  p.position = ground(x, z);
  p.prevPosition = p.position;
};

/** A new game whose player is at `level` (through a save, as a load would bring it). */
const atLevel = async (level: number) => {
  const ui = createUiStore();
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render, audio, persistence, ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27, 21, 0) });
  session.newGame();
  steps(session, 1);
  const snap = session.saves.snapshot();
  const progression = { ...INITIAL_PROGRESSION, xp: xpForLevel(level), level, unspent: { attribute: level - 1, perk: level - 1 } };
  await persistence.save("slot-1", { ...snap, domain: { ...snap.domain, progression, wallet: { eddies: 9000 } } });
  expect(await session.saves.loadAsync("slot-1")).toBe(true);
  return { session, ui };
};

describe("item level in play (ADR-0059, stage 4)", () => {
  it("Oyaji sells a gun of the player's level for the price the counter quotes", async () => {
    const { session, ui } = await atLevel(10);
    const oyaji = () => [...session.sim.world].find((e) => e.key === "oyaji");
    teleport(session, STALLS.x, STALLS.z);
    steps(session, 2);
    teleport(session, oyaji()!.position.x + OUT.x * 1.4, oyaji()!.position.z + OUT.z * 1.4);
    steps(session, 1);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState()).toMatchObject({ shopOpen: true, shopId: "oyaji", level: 10 });
    const terms = shopTerms(session.sim.domain.reputation[SHOPS.oyaji.owner]);
    const price = stockPrice(stockEntry("oyaji", "oni44")!, terms, 10);
    expect(price).toBeGreaterThan(stockPrice(stockEntry("oyaji", "oni44")!, terms, 1));
    const before = session.sim.domain.wallet.eddies;
    session.intents.buyItem("oni44");
    steps(session, 1);
    const gun = session.sim.domain.inventory.items.find((i) => i.def === "oni44")!;
    expect(gun).toMatchObject({ rarity: "common", level: 10 });
    expect(session.sim.domain.wallet.eddies).toBe(before - price);
    // The counter's view of the bag carries the level for the sale price.
    expect(ui.getState().trade.items.find((i) => i.key === gun.uid)).toMatchObject({ level: 10 });
  });

  it("an enemy's bag holds pieces in the player's band, and they keep their level in the bag", async () => {
    const { session } = await atLevel(14);
    const guard = [...session.sim.world].find((e) => e.key === "guard")!;
    // Krakowskie's band (1-8, ADR-0059 stage 5) keeps the guard at 8: its pieces of 7..9 come up to 12.
    expect(guard.enemy?.level).toBe(8);
    guard.enemy = { ...guard.enemy!, type: "hebi_enforcer" };
    guard.health = { ...guard.health!, current: 0 };
    steps(session, 1);
    const bag = session.sim.domain.loot.containers.find((c) => c.key === "loot:guard")!;
    const pieces = bag.lines.filter((l) => l.kind === "item" && hasItemLevel(l.item));
    expect(pieces.length).toBeGreaterThan(0);
    for (const l of pieces) expect(l.kind === "item" && l.level).toBe(12);
    teleport(session, bag.position.x, bag.position.z - 1);
    steps(session, 1, frame({ interact: true }));
    session.intents.takeLoot("all");
    steps(session, 2);
    const shotgun = session.sim.domain.inventory.items.find((i) => i.def === "raijin12")!;
    const line = pieces.find((l) => l.kind === "item" && l.item === "raijin12")!;
    expect(line.kind === "item" && shotgun.level === line.level && shotgun.rarity === line.rarity).toBe(true);
  });

  it("a run saved as v28 migrates to the snapshot the game writes today", async () => {
    const { session } = await atLevel(1);
    steps(session, 30);
    const now = session.saves.snapshot();
    const strip = <T extends object>(p: T): T => {
      const { level: _l, traits: _t, ...rest } = p as T & { level?: number; traits?: unknown };
      return rest as T;
    };
    const v28 = {
      ...now,
      version: 28,
      domain: {
        ...now.domain,
        inventory: { ...now.domain.inventory, items: now.domain.inventory.items.map(strip) },
        loot: { ...now.domain.loot, containers: now.domain.loot.containers.map((c) => ({ ...c, lines: c.lines.map(strip) })) },
      },
    };
    // Through v29, v30 and v31 to today (ADR-0063 stage 6: the market's move changes nothing of a save made
    // elsewhere; ADR-0059 stage 6: a run with no fight has an empty style and no bad luck, as the migration gives).
    expect(JSON.stringify(MIGRATIONS[30]!(MIGRATIONS[29]!(MIGRATIONS[28]!(JSON.parse(JSON.stringify(v28))))))).toBe(JSON.stringify(now));
  });
});
