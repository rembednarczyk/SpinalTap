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
import { CONTRACT_ITEM_SPOTS } from "@seki/sim";
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
  setAppearance() {},
};
const audio: AudioPort = { play() {}, stopAll() {} };

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

type Ui = ReturnType<typeof createUiStore>;

/** After M0 and one paid contract for Kaito: the market jobs are open. */
const setup = async () => {
  const ui = createUiStore();
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render, audio, persistence, ui, story: STORY_SOURCE, seed: () => 41, now: () => new Date(2026, 9, 27) });
  session.newGame();
  const snap = session.snapshot();
  await persistence.save("start", {
    ...snap,
    domain: {
      ...snap.domain,
      character: { ...snap.domain.character, alias: "Seki Senshi", memories: ["combat_reflex"] },
      quests: { m0_first_contract: { status: "completed" } },
      flags: ["dead:courier", "dead:guard", "killed:hebi_courier", "met_fixer", "reported_back"],
      contracts: { active: null, completed: 1 },
      wallet: { eddies: 400 },
    },
  });
  await session.loadAsync("start");
  return { session, ui, persistence };
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

const text = (ui: Ui) => (ui.getState().dialogue?.lines ?? []).map((l) => l.text).join("\n");

/** Picks a dialogue option by its text, so the test does not depend on option order. */
const choose = (s: GameSession, ui: Ui, option: string) => {
  const index = ui.getState().dialogue?.choices.find((c) => c.text === option)?.index;
  if (index === undefined) throw new Error(`no option "${option}" in ${JSON.stringify(ui.getState().dialogue?.choices)}`);
  s.choose(index);
};

const close = (s: GameSession) => {
  s.closeDialogue();
  steps(s, 1);
};

const talkToKaito = (s: GameSession) => {
  teleport(s, 4.6, 1.5, Math.PI / 2);
  steps(s, 1, frame({ interact: true }));
};

/** Hana's cart is on the market; arriving there streams it in during the same step. */
const talkToHana = (s: GameSession) => {
  teleport(s, 90.5, 74, Math.PI / 2);
  steps(s, 1, frame({ interact: true }));
};

const toasts = (ui: Ui) => ui.getState().toasts.map((t) => `${t.title}: ${t.text}`);

/** Stands 4 m south of the target and fires until it drops. */
const shootDown = (s: GameSession, key: string) => {
  for (let i = 0; i < 2000; i++) {
    const t = [...s.sim.world].find((e) => e.key === key);
    if (!t) return;
    teleport(s, t.position.x, t.position.z - 4, 0, 0.1);
    s.step(frame({ fire: true }));
  }
};

describe("M4 acceptance: market contracts → eddies → cyberware", () => {
  it("runs a delivery, a retrieval and a protection job, then spends the money at Mori's", async () => {
    const { session, ui } = await setup();
    const eddies = () => session.sim.domain.wallet.eddies;

    // Kaito: a delivery for Hana, against the clock.
    talkToKaito(session);
    expect(text(ui)).toContain("handluje Hana");
    choose(session, ui, "Masz coś do przewiezienia?");
    close(session);
    const delivery = session.sim.domain.contracts.active!;
    expect(delivery.kind).toBe("delivery");
    expect(ui.getState().questTitle).toBe("Kontrakt 2 · Kaito");
    expect(ui.getState().objective).toMatch(/Zanieś paczkę od Kaito Hanie: .* \(zostało \d:\d\d\)/);
    steps(session, 120);
    expect(ui.getState().objective).toMatch(/zostało \d:\d\d/);

    talkToHana(session);
    expect(text(ui)).toContain("Od Kaito?");
    close(session);
    expect(session.sim.domain.contracts.active?.status).toBe("cleared");
    expect(ui.getState().objective).toBe("Paczka oddana. Wróć do Kaito po zapłatę");

    let before = eddies();
    talkToKaito(session);
    expect(text(ui)).toContain("moduły doszły zimne");
    choose(session, ui, "Nie dziś.");
    close(session);
    expect(eddies()).toBe(before + delivery.reward);
    expect(session.sim.domain.contracts.completed).toBe(2);

    // Hana: her crate from the Hebi stash.
    talkToHana(session);
    expect(text(ui)).toContain("Jestem Hana");
    choose(session, ui, "Co trzeba odzyskać?");
    close(session);
    const retrieval = session.sim.domain.contracts.active!;
    expect(retrieval.kind).toBe("retrieve");
    expect(ui.getState().questTitle).toBe("Kontrakt 3 · Hana");
    expect(ui.getState().mapMarkers.some((m) => m.kind === "target" && m.id === `${retrieval.id}-item`)).toBe(true);
    const crate = CONTRACT_ITEM_SPOTS.hebi_stash!;
    teleport(session, crate.x - 1, crate.z, Math.PI / 2);
    steps(session, 1, frame({ interact: true }));
    expect(session.sim.domain.contracts.active?.status).toBe("cleared");
    expect(ui.getState().objective).toBe("Skrzynka zabrana. Wróć do Hany po zapłatę");
    const entry = ui.getState().journal.quests.find((q) => q.id === `contract-${retrieval.id}`);
    expect(entry).toMatchObject({ title: "Kontrakt 3 · Hana", steps: [{ done: true }, { objective: "Wróć do Hany po zapłatę", done: false }] });

    before = eddies();
    talkToHana(session);
    expect(text(ui)).toContain("Jest moja skrzynka");
    choose(session, ui, "Ktoś potrzebuje ochrony?");
    close(session);
    expect(eddies()).toBe(before + retrieval.reward);

    // Hana: the next job is already running. Hebi come for Oyaji; take the wave down.
    const protection = session.sim.domain.contracts.active!;
    expect(protection.kind).toBe("protect");
    expect(ui.getState().objective).toContain("Obroń Oyaji");
    const wave = [...session.sim.world].filter((e) => e.tag === contractTag(protection.id)).map((e) => e.key!);
    expect(wave).toHaveLength(protection.targets);
    for (const key of wave) shootDown(session, key);
    steps(session, 1);
    expect(session.sim.domain.contracts.active?.status).toBe("cleared");
    expect(session.sim.domain.flags).not.toContain("dead:oyaji");

    before = eddies();
    talkToHana(session);
    expect(text(ui)).toContain("Oyaji żyje");
    choose(session, ui, "Nie teraz.");
    close(session);
    expect(eddies()).toBe(before + protection.reward);
    expect(session.sim.domain.contracts).toEqual({ active: null, completed: 4 });
    expect(ui.getState().objective).toBe("Kaito ma kolejne kontrakty, Hana z targu też. Mori sprzedaje cyberware.");

    // Three market jobs pay for an implant at Mori's.
    expect(eddies()).toBeGreaterThanOrEqual(400 + 250 + 470 + 550 - 1);
    // Shinsekai is streamed out while Seki is on the market; walking up to the clinic brings it back.
    expect(session.sim.streamer.isLoaded("shinsekai-7")).toBe(false);
    teleport(session, -4.7, 2.4, -Math.PI / 2);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().shopOpen).toBe(true);
    before = eddies();
    session.buyCyberware("subdermal_weave");
    steps(session, 1);
    session.closeShop();
    steps(session, 1);
    expect(session.sim.domain.character.cyberware.skeleton).toBe("subdermal_weave");
    expect(eddies()).toBeLessThan(before);
  });

  it("a late delivery fails with a toast; Kaito offers work again", async () => {
    const { session, ui } = await setup();
    talkToKaito(session);
    choose(session, ui, "Masz coś do przewiezienia?");
    close(session);
    const c = session.sim.domain.contracts.active!;
    steps(session, c.deadlineTick! - session.sim.tick + 1);
    expect(session.sim.domain.contracts.active).toBeNull();
    expect(toasts(ui)).toContain("Kontrakt przepadł: Paczka nie dotarła na czas. Kaito nie będzie zadowolony");
    expect(session.sim.domain.reputation.fixers).toBe(-4);
    talkToHana(session);
    expect(text(ui)).not.toContain("Od Kaito?");
    close(session);
    talkToKaito(session);
    expect(ui.getState().dialogue?.choices.map((c) => c.text)).toContain("Masz coś do przewiezienia?");
  });

  it("a quicksave in the middle of a delivery loads with the clock where it was", async () => {
    const { session, ui } = await setup();
    talkToKaito(session);
    choose(session, ui, "Masz coś do przewiezienia?");
    close(session);
    steps(session, 600);
    expect(await session.saveAsync("quick")).toBe(true);
    const objective = ui.getState().objective;
    const tick = session.sim.tick;
    steps(session, 600);
    expect(await session.loadAsync("quick")).toBe(true);
    expect(session.sim.tick).toBe(tick);
    expect(ui.getState().objective).toBe(objective);
    // Kaito sees the same clock.
    talkToKaito(session);
    expect(text(ui)).toMatch(/Zostało ci \d+ s/);
    close(session);
    talkToHana(session);
    close(session);
    expect(session.sim.domain.contracts.active?.status).toBe("cleared");
  });
});
