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
import { CONTRACT_SITE_SPAWNS, ground } from "@seki/sim";
import { nearKaito } from "./story-helpers";
import { GameSession } from "../src/game-session";

/** What the debrief card pays on top of the reward (ADR-0029); subscribe right before the payment. */
const extraPay = (session: GameSession): (() => number) => {
  let extra = 0;
  session.sim.bus.on("ContractDebrief", (c) => {
    extra += c.bonus + c.styleBonus;
  });
  return () => extra;
};

const render: RenderPort = {
  spawn() {},
  updateTransform() {},
  despawn() {},
  clear() {},
  setCameraMode(_m: CameraMode) {},
  attachCamera() {},
  playEffect(_e: EffectDescriptor) {},
  setAppearance() {},
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
      // Two contracts on one pouch of 9 mm: a full one, so ammo does not decide this test.
      ammo: { "9mm": 180 },
    },
  });
  await session.loadAsync("m0-done");
  return { session, ui };
};

const teleport = (s: GameSession, x: number, z: number, yaw = 0, pitch = 0) => {
  const p = s.sim.player()!;
  p.position = ground(x, z);
  p.prevPosition = p.position;
  p.yaw = yaw;
  p.pitch = pitch;
};

const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

const talkToKaito = (s: GameSession) => {
  teleport(s, ...nearKaito(s));
  steps(s, 1, frame({ interact: true }));
};

/**
 * Brings the target to the open street by the spawn, stands 4 m in front of it (FPP) and fires
 * until it drops; returns plain torso-hit damage (no crits, no other zones). The contract site
 * depends on the RNG stream, and cover there must not decide the numbers.
 */
const shootDown = (s: GameSession, key: string): number[] => {
  const hits: number[] = [];
  const off = s.bus.on("DamageDealt", (e) => {
    if (e.targetId !== s.sim.player()?.id && !e.critical && e.zone === "torso") hits.push(e.amount);
  });
  for (let i = 0; i < 2000; i++) {
    const t = [...s.sim.world].find((e) => e.key === key);
    if (!t) break;
    // Where it stands, 4 m in front of it: its chunk stays loaded (ADR-0045).
    const p = s.sim.player()!;
    p.position = { x: t.position.x, y: t.position.y, z: t.position.z - 4 };
    p.prevPosition = p.position;
    p.yaw = 0;
    p.pitch = 0.1;
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
    session.intents.choose(0);
    session.intents.closeDialogue();
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
    const extra = extraPay(session);
    talkToKaito(session);
    steps(session, 1);
    expect(session.sim.domain.wallet.eddies).toBe(before + contract.reward + extra());
    expect(session.sim.domain.contracts.completed).toBe(1);
    session.intents.choose(2);
    session.intents.closeDialogue();
    steps(session, 1);

    // Mori's clinic: buy and install the grip stabiliser (+4 damage) and a medkit.
    const mori = [...session.sim.world].find((e) => e.key === "mori")!;
    teleport(session, mori.position.x + 1.5, mori.position.z, -Math.PI / 2);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().shopOpen).toBe(true);
    session.intents.buyCyberware("steady_grip");
    session.intents.buyItem("medkit");
    steps(session, 1);
    session.intents.closeShop();
    steps(session, 1);
    expect(session.sim.domain.character.cyberware.arms).toBe("steady_grip");
    expect(session.sim.domain.inventory.stacks.medkit).toBe(2);
    expect(session.sim.domain.wallet.eddies).toBe(before + contract.reward + extra() - 500 - 90);
    expect(ui.getState().shopOpen).toBe(false);

    // Next contract: the same pistol now hits harder.
    talkToKaito(session);
    session.intents.choose(0);
    session.intents.closeDialogue();
    steps(session, 1);
    const next = session.sim.domain.contracts.active!;
    // The site may be off the street (under the Kanałowa footbridge): walk there so it streams in.
    const site = CONTRACT_SITE_SPAWNS[next.siteId][0]!;
    teleport(session, site.x, site.z - 3, 0);
    steps(session, 1);
    const nextTargets = [...session.sim.world].filter((e) => e.tag === contractTag(next.id)).map((e) => e.key!);
    const upgradedHits = nextTargets.flatMap((k) => shootDown(session, k));
    // 22 + 3 (memory) through the ganger's Hebi jacket (torso 3, ADR-0015); the grip adds 4.
    expect(new Set(baseHits)).toEqual(new Set([22]));
    expect(new Set(upgradedHits)).toEqual(new Set([26]));
  });

  it("blocks saving while the clinic is open", async () => {
    const { session } = await setup();
    const mori = [...session.sim.world].find((e) => e.key === "mori")!;
    teleport(session, mori.position.x + 1.5, mori.position.z);
    steps(session, 1, frame({ interact: true }));
    expect(await session.saveAsync("slot-1")).toBe(false);
    expect(session.inControl).toBe(false);
    session.intents.closeShop();
    expect(session.inControl).toBe(true);
  });
});
