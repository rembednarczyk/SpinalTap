import { describe, expect, it } from "vitest";
import {
  type AudioPort,
  type CameraMode,
  EMPTY_INPUT,
  type EffectDescriptor,
  type InputFrame,
  type RenderPort,
  contractTag,
} from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";

const render: RenderPort = {
  spawn() {},
  updateTransform() {},
  despawn() {},
  clear() {},
  setCameraMode(_m: CameraMode) {},
  attachCamera() {},
  playEffect(_e: EffectDescriptor) {},
};
const audio: AudioPort = { play() {}, stopAll() {} };

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

const setup = async () => {
  const ui = createUiStore();
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render, audio, persistence, ui, story: STORY_SOURCE, seed: () => 99, now: () => new Date(2026, 9, 27) });
  session.newGame();
  // Start from the end of M0: the first contract is done and paid.
  const snap = session.snapshot();
  await persistence.save("m0-done", {
    ...snap,
    domain: {
      ...snap.domain,
      character: { ...snap.domain.character, alias: "Seki Senshi", memories: ["combat_reflex"] },
      quests: { m0_first_contract: { status: "completed" } },
      flags: ["dead:courier", "dead:guard", "killed:hebi_courier", "met_fixer", "reported_back"],
      wallet: { eddies: 645 },
    },
  });
  await session.loadAsync("m0-done");
  return { session, ui };
};

const teleport = (s: GameSession, x: number, z: number, yaw = 0, pitch = 0) => {
  const p = s.sim.player()!;
  p.position = { x, y: 0, z };
  p.prevPosition = p.position;
  p.yaw = yaw;
  p.pitch = pitch;
};

const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

const talkToKaito = (s: GameSession) => {
  teleport(s, 4.6, 1.5, Math.PI / 2);
  steps(s, 1, frame({ interact: true }));
};

/** Stands 4 m in front of the target (FPP) and fires until it drops; returns plain torso-hit damage (no crits, no other zones). */
const shootDown = (s: GameSession, key: string): number[] => {
  const hits: number[] = [];
  const off = s.bus.on("DamageDealt", (e) => {
    if (e.targetId !== s.sim.player()?.id && !e.critical && e.zone === "torso") hits.push(e.amount);
  });
  for (let i = 0; i < 2000; i++) {
    const t = [...s.sim.world].find((e) => e.key === key);
    if (!t) break;
    teleport(s, t.position.x, t.position.z - 4, 0, 0.1);
    s.step(frame({ fire: true }));
  }
  off();
  return hits;
};

describe("M1 acceptance: contract → eddies → cyberware → stronger in combat", () => {
  it("runs the whole loop", async () => {
    const { session, ui } = await setup();
    expect(ui.getState().objective).toContain("Kaito ma kolejne kontrakty");

    // Kaito offers a contract; accept it through ink.
    talkToKaito(session);
    session.choose(0);
    session.closeDialogue();
    steps(session, 1);
    const contract = session.sim.domain.contracts.active!;
    expect(contract.status).toBe("active");
    expect(ui.getState().objective).toContain("Zneutralizuj gangerów Hebi");

    // Clear the targets with the stock pistol and record the damage per body hit.
    const targets = [...session.sim.world].filter((e) => e.tag === contractTag(contract.id)).map((e) => e.key!);
    const baseHits = targets.flatMap((k) => shootDown(session, k));
    steps(session, 1);
    expect(session.sim.domain.contracts.active?.status).toBe("cleared");

    // Report back: Kaito pays and offers the next job (declined here).
    const before = session.sim.domain.wallet.eddies;
    talkToKaito(session);
    steps(session, 1);
    expect(session.sim.domain.wallet.eddies).toBe(before + contract.reward);
    expect(session.sim.domain.contracts.completed).toBe(1);
    session.choose(2);
    session.closeDialogue();
    steps(session, 1);

    // Mori's clinic: buy and install the grip stabiliser (+4 damage) and a medkit.
    const mori = [...session.sim.world].find((e) => e.key === "mori")!;
    teleport(session, mori.position.x + 1.5, mori.position.z, -Math.PI / 2);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().shopOpen).toBe(true);
    session.buyCyberware("steady_grip");
    session.buyItem("medkit");
    steps(session, 1);
    session.closeShop();
    steps(session, 1);
    expect(session.sim.domain.character.cyberware.arms).toBe("steady_grip");
    expect(session.sim.domain.inventory.medkit).toBe(2);
    expect(session.sim.domain.wallet.eddies).toBe(before + contract.reward - 500 - 90);
    expect(ui.getState().shopOpen).toBe(false);

    // Next contract: the same pistol now hits harder.
    talkToKaito(session);
    session.choose(0);
    session.closeDialogue();
    steps(session, 1);
    const next = session.sim.domain.contracts.active!;
    const nextTargets = [...session.sim.world].filter((e) => e.tag === contractTag(next.id)).map((e) => e.key!);
    const upgradedHits = nextTargets.flatMap((k) => shootDown(session, k));
    // 22 + 3 (memory) through the ganger's vest (armor 2, torso +3); the grip adds 4.
    expect(new Set(baseHits)).toEqual(new Set([20]));
    expect(new Set(upgradedHits)).toEqual(new Set([24]));
  });

  it("blocks saving while the clinic is open", async () => {
    const { session } = await setup();
    const mori = [...session.sim.world].find((e) => e.key === "mori")!;
    teleport(session, mori.position.x + 1.5, mori.position.z);
    steps(session, 1, frame({ interact: true }));
    expect(await session.saveAsync("slot-1")).toBe(false);
    expect(session.inControl).toBe(false);
    session.closeShop();
    expect(session.inControl).toBe(true);
  });
});
