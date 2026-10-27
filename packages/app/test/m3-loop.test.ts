import { describe, expect, it } from "vitest";
import {
  type AudioPort,
  type CameraMode,
  EMPTY_INPUT,
  type EffectDescriptor,
  type EndingId,
  type InputFrame,
  QUEST_ECHO,
  type RenderPort,
  STORY_CHOICES,
  type StoryChoiceId,
  contractTag,
  progressFlag,
} from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";

class FakeRender implements RenderPort {
  effects: EffectDescriptor["kind"][] = [];
  spawn() {}
  updateTransform() {}
  despawn() {}
  clear() {}
  setCameraMode(_m: CameraMode) {}
  attachCamera() {}
  playEffect(e: EffectDescriptor) {
    this.effects.push(e.kind);
  }
}
const audio: AudioPort = { play() {}, stopAll() {} };

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

const setup = (store = new MemorySaveStore()) => {
  const render = new FakeRender();
  const ui = createUiStore();
  const persistence = new SavePersistence(store);
  const session = new GameSession({ render, audio, persistence, ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27) });
  return { session, ui, render, store };
};

type Ui = ReturnType<typeof createUiStore>;

const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

const teleport = (s: GameSession, x: number, z: number, yaw = 0, pitch = 0) => {
  const p = s.sim.player()!;
  p.position = { x, y: 0, z };
  p.prevPosition = p.position;
  p.yaw = yaw;
  p.pitch = pitch;
};

const talkToKaito = (s: GameSession) => {
  teleport(s, 4.6, 1.5, Math.PI / 2);
  steps(s, 1, frame({ interact: true }));
};

/** Mori's interaction opens the clinic; the counter has a button to talk instead. */
const openClinic = (s: GameSession, ui: Ui) => {
  const mori = [...s.sim.world].find((e) => e.key === "mori")!;
  teleport(s, mori.position.x + 1.5, mori.position.z, -Math.PI / 2);
  steps(s, 1, frame({ interact: true }));
  expect(ui.getState().shopOpen).toBe(true);
};

const talkToMori = (s: GameSession, ui: Ui) => {
  openClinic(s, ui);
  s.talkToShopkeeper();
  expect(ui.getState().shopOpen).toBe(false);
  expect(ui.getState().dialogue).not.toBeNull();
};

const allText = (ui: Ui) => (ui.getState().dialogue?.lines ?? []).map((l) => l.text).join("\n");

/** Takes `pick` at every choice until the conversation ends, then closes it and lets the sim apply the commands. */
const finishDialogue = (s: GameSession, ui: Ui, pick = 0) => {
  for (let guard = 0; guard < 10 && !ui.getState().dialogue?.ended; guard++) s.choose(pick);
  expect(ui.getState().dialogue?.ended).toBe(true);
  s.closeDialogue();
  steps(s, 1);
};

/** Firing positions 4 m from the target (offset x, offset z, yaw facing it); cover can block some of them. */
const ANGLES = [
  [0, -4, 0],
  [-4, 0, Math.PI / 2],
  [4, 0, -Math.PI / 2],
  [0, 4, Math.PI],
] as const;

/** Fires at the target until it drops. Health is topped up so the run never hinges on luck. */
const shootDown = (s: GameSession, key: string) => {
  for (let i = 0; i < 2000; i++) {
    const t = [...s.sim.world].find((e) => e.key === key);
    if (!t) return;
    const p = s.sim.player()!;
    if (p.health) p.health = { ...p.health, current: p.health.max };
    const [dx, dz, yaw] = ANGLES[Math.floor(i / 150) % ANGLES.length]!;
    teleport(s, t.position.x + dx, t.position.z + dz, yaw, 0.1);
    s.step(frame({ fire: true }));
  }
  throw new Error(`${key} survived`);
};

const objective = (ui: Ui) => ui.getState().objective ?? "";

/** M0 from a new game: name from Kaito, the courier, payday. Ends with act I started. */
const playFirstContract = (s: GameSession, ui: Ui) => {
  s.newGame();
  talkToKaito(s);
  finishDialogue(s, ui);
  shootDown(s, "courier");
  steps(s, 1);
  talkToKaito(s);
  finishDialogue(s, ui);
  expect(s.sim.domain.quests[QUEST_ECHO.id]).toEqual({ status: "active", stepIndex: 0 });
  expect(objective(ui)).toBe("Weź od Kaito kontrakt i doprowadź go do końca");
};

/** Fragment 1, unlocked by a finished fixer contract. */
const playContractFragment = (s: GameSession, ui: Ui, render: FakeRender, pick: number) => {
  talkToKaito(s);
  s.choose(0); // "Biorę robotę."
  s.closeDialogue();
  steps(s, 1);
  const contract = s.sim.domain.contracts.active!;
  expect(objective(ui)).toContain("Zneutralizuj gangerów Hebi");
  for (const e of [...s.sim.world].filter((x) => x.tag === contractTag(contract.id))) shootDown(s, e.key!);
  steps(s, 1);

  render.effects = [];
  talkToKaito(s);
  steps(s, 1);
  expect(allText(ui)).toContain("Gdzie odpłynęłaś?");
  expect(s.sim.domain.flags).toContain(progressFlag("contract_completed", "echo_contract"));
  expect(s.sim.domain.character.memories).toContain("courier_case");
  expect(render.effects).toContain("memory-glitch");
  s.choose(2); // "Nie dziś."
  s.closeDialogue();
  steps(s, 1);

  // The flashback opens on its own once Kaito is done talking.
  expect(allText(ui)).toContain("Kagami Biotech");
  finishDialogue(s, ui, pick);
  expect(objective(ui)).toBe("Porozmawiaj z doktorem Mori o tym, co widziałaś");
};

/** Fragment 2, unlocked by talking to the ripperdoc. */
const playMoriFragment = (s: GameSession, ui: Ui, render: FakeRender, pick: number) => {
  render.effects = [];
  talkToMori(s, ui);
  expect(allText(ui)).toContain("Moduł pamięci Kagami");
  finishDialogue(s, ui);
  expect(s.sim.domain.character.memories).toContain("operating_table");
  expect(render.effects).toContain("memory-glitch");
  expect(allText(ui)).toContain("Jak się nazywasz?");
  finishDialogue(s, ui, pick);
  expect(objective(ui)).toContain("Wszczep u Mori nowy implant");
};

/** Fragment 3, unlocked by buying an implant. */
const playImplantFragment = (s: GameSession, ui: Ui, render: FakeRender, pick: number) => {
  render.effects = [];
  openClinic(s, ui);
  s.buyCyberware("steady_grip");
  steps(s, 1);
  expect(s.sim.domain.character.cyberware.arms).toBe("steady_grip");
  expect(s.sim.domain.character.memories).toContain("crash_night");
  expect(render.effects).toContain("memory-glitch");
  // No flashback while the clinic is still open.
  expect(ui.getState().dialogue).toBeNull();
  s.closeShop();
  steps(s, 1);
  expect(allText(ui)).toContain("mokra obwodnica");
  finishDialogue(s, ui, pick);
  expect(objective(ui)).toBe("Wróć do Mori i zdecyduj, co zrobić z modułem");
};

const playFinale = (s: GameSession, ui: Ui): string => {
  talkToMori(s, ui);
  const text = allText(ui);
  finishDialogue(s, ui);
  return text;
};

const CHOICES: readonly StoryChoiceId[] = ["case", "name", "crash"];

describe("M3 acceptance: act I from a new game to each ending", () => {
  it.each<[string, readonly [number, number, number], EndingId, string]>([
    ["owns every memory", [0, 0, 0], "aya", "Aya"],
    ["keeps every memory at a distance", [1, 1, 1], "seki", "Seki Senshi"],
    ["owns two of three", [1, 0, 0], "aya", "Aya"],
    ["owns one of three", [0, 1, 1], "seki", "Seki Senshi"],
  ])("%s → ending %s", async (_name, picks, ending, alias) => {
    const store = new MemorySaveStore();
    const { session, ui, render } = setup(store);
    playFirstContract(session, ui);
    playContractFragment(session, ui, render, picks[0]);
    playMoriFragment(session, ui, render, picks[1]);
    playImplantFragment(session, ui, render, picks[2]);

    expect(session.sim.domain.story.choices).toEqual(Object.fromEntries(CHOICES.map((c, i) => [c, STORY_CHOICES[c][picks[i]!]])));
    expect(session.sim.domain.story.ending).toBeNull();

    const finale = playFinale(session, ui);
    expect(finale).toContain(ending === "aya" ? "Zostaw go." : "Wyjmij go.");
    expect(session.sim.domain.story.ending).toBe(ending);
    expect(session.sim.domain.quests[QUEST_ECHO.id]).toEqual({ status: "completed" });
    expect(session.sim.domain.character.alias).toBe(alias);
    expect(session.sim.domain.character.memories).toEqual(
      expect.arrayContaining(["combat_reflex", "courier_case", "operating_table", "crash_night"]),
    );
    expect(ui.getState().toasts.some((t) => t.title === "Koniec aktu I: Echo")).toBe(true);
    expect(objective(ui)).toContain("Kaito ma kolejne kontrakty");

    // The ending survives a save/load round trip, ink state included.
    expect(await session.saveAsync("act1")).toBe(true);
    const saved = session.snapshot();
    const { session: other, ui: otherUi } = setup(store);
    expect(await other.loadAsync("act1")).toBe(true);
    expect(other.snapshot().domain).toEqual(saved.domain);
    expect(other.narrative.saveState()).toBe(saved.narrative);
    talkToMori(other, otherUi);
    expect(allText(otherUi)).toContain(ending === "aya" ? "Aya. Jak głowa?" : "Fiolka dalej stoi na półce.");
  });

  it("keeps choices and an unplayed flashback across save/load in the middle of the act", async () => {
    const store = new MemorySaveStore();
    const { session, ui, render } = setup(store);
    playFirstContract(session, ui);
    playContractFragment(session, ui, render, 0);
    expect(await session.saveAsync("mid")).toBe(true);

    // Unlock fragment 2 and write the snapshot while its flashback is still waiting (the UI would refuse to save here).
    talkToMori(session, ui);
    finishDialogue(session, ui);
    expect(allText(ui)).toContain("Jak się nazywasz?");
    await new SavePersistence(store).save("pending", session.snapshot());

    // A fresh session picks the flashback up right after loading.
    const b = setup(store);
    expect(await b.session.loadAsync("pending")).toBe(true);
    expect(b.ui.getState().dialogue).toBeNull();
    steps(b.session, 1);
    expect(allText(b.ui)).toContain("Jak się nazywasz?");
    finishDialogue(b.session, b.ui, 0);
    playImplantFragment(b.session, b.ui, b.render, 0);
    playFinale(b.session, b.ui);
    expect(b.session.sim.domain.story).toEqual({ choices: { case: "opened", name: "spoken", crash: "wheel" }, ending: "aya" });

    // The earlier save still holds only the first choice, and continues from there.
    const c = setup(store);
    expect(await c.session.loadAsync("mid")).toBe(true);
    expect(c.session.sim.domain.story).toEqual({ choices: { case: "opened" }, ending: null });
    expect(objective(c.ui)).toBe("Porozmawiaj z doktorem Mori o tym, co widziałaś");
    playMoriFragment(c.session, c.ui, c.render, 1);
    playImplantFragment(c.session, c.ui, c.render, 1);
    playFinale(c.session, c.ui);
    expect(c.session.sim.domain.story.ending).toBe("seki");
  });

  it("lets the ripperdoc chat outside the main thread and does not replay a flashback", () => {
    const { session, ui } = setup();
    session.newGame();
    talkToMori(session, ui);
    expect(allText(ui)).toContain("Coś boli?");
    finishDialogue(session, ui);
    expect(ui.getState().dialogue).toBeNull();
    expect(session.inControl).toBe(true);
  });
});
