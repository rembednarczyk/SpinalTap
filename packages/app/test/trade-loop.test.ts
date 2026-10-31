import { describe, expect, it } from "vitest";
import { type AudioCue, type AudioPort, EMPTY_INPUT, type InputFrame, type LootLine, type RenderPort } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { ground, market } from "@seki/sim";
import { GameSession } from "../src/game-session";

/** Between the market's stall rows under the viaduct (ADR-0045). */
const STALLS = market(80, 0, 64);

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

class FakeAudio implements AudioPort {
  cues: AudioCue[] = [];
  play(c: AudioCue) {
    this.cues.push(c);
  }
  stopAll() {}
}

const setup = () => {
  const ui = createUiStore();
  const audio = new FakeAudio();
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render, audio, persistence, ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27, 21, 0) });
  session.newGame();
  return { session, ui, audio, persistence };
};

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

const teleport = (s: GameSession, x: number, z: number, yaw = 0, pitch = 0) => {
  const p = s.sim.player()!;
  p.position = ground(x, z);
  p.prevPosition = p.position;
  p.yaw = yaw;
  p.pitch = pitch;
};

const shootGuard = (s: GameSession) => {
  for (let i = 0; i < 3000; i++) {
    const guard = [...s.sim.world].find((e) => e.key === "guard");
    if (!guard) return;
    guard.position = ground(300, -79);
    guard.prevPosition = guard.position;
    teleport(s, 300, -83, 0, 0.08);
    s.step(frame({ fire: true }));
  }
  throw new Error("the guard survived");
};

/** What this test's guard carried: scrap, an uncommon SMG and a grip stabiliser. */
const BAG: readonly LootLine[] = [
  { kind: "eddies", qty: 20 },
  { kind: "stack", item: "scrap", qty: 4 },
  { kind: "item", item: "hebi_smg", rarity: "uncommon", qty: 1 },
  { kind: "item", item: "steady_grip", rarity: "common", qty: 1 },
];

describe("trade loop: loot, Oyaji's stall, a mod, the clinic (E10, E11)", () => {
  it("sells the loot at the stall, buys a mod there and has the found implant fitted at Mori's", async () => {
    const { session, ui, audio, persistence } = setup();
    shootGuard(session);
    steps(session, 1);
    // The bag's contents are random; this run gives it known ones through a save, as a load would.
    const snap = session.snapshot();
    const containers = snap.domain.loot.containers.map((c) => (c.key === "loot:guard" ? { ...c, lines: BAG } : c));
    await persistence.save("slot-1", { ...snap, domain: { ...snap.domain, loot: { ...snap.domain.loot, containers } } });
    expect(await session.loadAsync("slot-1")).toBe(true);

    const bag = session.sim.domain.loot.containers.find((c) => c.key === "loot:guard")!;
    teleport(session, bag.position.x, bag.position.z - 1);
    steps(session, 1);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().loot?.lines).toHaveLength(BAG.length);
    session.intents.takeLoot("all");
    steps(session, 2);
    expect(audio.cues).toContain("loot-pickup");
    const smg = session.sim.domain.inventory.items.find((i) => i.def === "hebi_smg")!;
    const grip = session.sim.domain.inventory.items.find((i) => i.def === "steady_grip")!;
    const afterLoot = session.sim.domain.wallet.eddies;

    // 21:00: Oyaji is still at his stall on the market.
    const oyaji = () => [...session.sim.world].find((e) => e.key === "oyaji");
    teleport(session, STALLS.x, STALLS.z);
    steps(session, 2);
    expect(oyaji()).toBeDefined();
    teleport(session, oyaji()!.position.x, oyaji()!.position.z - 1.4);
    steps(session, 1);
    expect(ui.getState().prompt).toBe("Oyaji's stall");
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState()).toMatchObject({ shopOpen: true, shopId: "oyaji" });
    expect(ui.getState().trade.items.map((i) => i.defId)).toEqual(expect.arrayContaining(["scrap", "hebi_smg", "steady_grip"]));

    session.intents.sellItem({ stack: "scrap" }, 4);
    session.intents.sellItem({ uid: smg.uid }, 1);
    steps(session, 1);
    expect(session.sim.domain.wallet.eddies).toBe(afterLoot + 48 + 280);
    expect(ui.getState().trade.items.some((i) => i.defId === "hebi_smg")).toBe(false);
    expect(audio.cues.filter((c) => c === "sell")).toHaveLength(2);
    expect(ui.getState().toasts.some((t) => t.title === "Sold: Hebi SMG")).toBe(true);
    expect(ui.getState().toasts.some((t) => t.text === "Transfer")).toBe(false);

    session.intents.buyItem("holo_sight");
    // The stall does not fit implants.
    session.intents.installCyberwareItem(grip.uid);
    steps(session, 1);
    expect(session.sim.domain.inventory.items.some((i) => i.def === "holo_sight")).toBe(true);
    expect(session.sim.domain.character.cyberware.arms).toBeUndefined();
    const afterStall = session.sim.domain.wallet.eddies;
    expect(afterStall).toBe(afterLoot + 48 + 280 - 300);

    // A word with Oyaji, then back to the street.
    session.intents.talkToShopkeeper();
    expect(ui.getState().shopOpen).toBe(false);
    expect(ui.getState().dialogue?.lines[0]?.speaker).toBe("Oyaji");
    session.intents.closeDialogue();
    steps(session, 2);
    expect(session.inControl).toBe(true);

    // Mori fits the stabiliser from the bag for a quarter of its value.
    teleport(session, 300, -83);
    steps(session, 2);
    const mori = [...session.sim.world].find((e) => e.key === "mori")!;
    teleport(session, mori.position.x + 1.5, mori.position.z, -Math.PI / 2);
    steps(session, 1);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState()).toMatchObject({ shopOpen: true, shopId: "clinic" });
    expect(ui.getState().trade.items.some((i) => i.defId === "steady_grip")).toBe(true);
    session.intents.sellItem({ stack: "medkit" }, 1);
    session.intents.installCyberwareItem(grip.uid);
    steps(session, 1);
    expect(session.sim.domain.character.cyberware.arms).toBe("steady_grip");
    expect(session.sim.domain.wallet.eddies).toBe(afterStall - 125);
    expect(session.sim.domain.inventory.items.some((i) => i.def === "steady_grip")).toBe(false);
    expect(ui.getState().toasts.some((t) => t.title === "Mori shakes his head")).toBe(true);
    expect(ui.getState().toasts.some((t) => t.title === "Implanted: Grip stabiliser")).toBe(true);
    session.intents.closeShop();
    steps(session, 1);
    expect(session.inControl).toBe(true);
  });

  it("after 22:00 Oyaji's stall is shut and he only talks", () => {
    const { session, ui } = setup();
    session.sim.enqueue({ type: "wait", minutes: 61 });
    teleport(session, STALLS.x, STALLS.z);
    steps(session, 2);
    const oyaji = [...session.sim.world].find((e) => e.key === "oyaji")!;
    teleport(session, oyaji.position.x + 1.5, oyaji.position.z + 0.8);
    steps(session, 2);
    expect(ui.getState().prompt).toMatch(/closed/);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().shopOpen).toBe(false);
    expect(ui.getState().dialogue?.lines.map((l) => l.text).join(" ")).toContain("Zamknięte");
    // Trade intents do nothing without an open counter.
    session.intents.sellItem({ stack: "medkit" }, 1);
    session.intents.upgradeBackpack();
    session.intents.repairItem("i2", 0);
    session.intents.removeCyberware("optics");
    steps(session, 1);
    expect(session.sim.domain.inventory.stacks.medkit).toBe(1);
    expect(session.sim.domain.character.cyberware.optics).toBe("hitomi_optics_mk1");
  });
});
