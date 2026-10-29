import { expect } from "vitest";
import {
  type AudioPort,
  type CameraMode,
  EMPTY_INPUT,
  type EffectDescriptor,
  type InputFrame,
  QUEST_ECHO,
  type RenderPort,
  contractTag,
  progressFlag,
} from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { FIXER_CLINIC_SPAWN, FIXER_SPAWN, ground } from "@seki/sim";
import { GameSession } from "../src/game-session";

/** Shared drivers of the main-thread acceptance tests (act I in m3-loop, act II in m3-lustro-loop). */

export class FakeRender implements RenderPort {
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
  setAppearance() {}
}
const audio: AudioPort = { play() {}, stopAll() {} };

export const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

export const setup = (store = new MemorySaveStore()) => {
  const render = new FakeRender();
  const ui = createUiStore();
  const persistence = new SavePersistence(store);
  const session = new GameSession({ render, audio, persistence, ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27) });
  return { session, ui, render, store };
};

export type Ui = ReturnType<typeof createUiStore>;

export const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

/**
 * Puts the player at (x, y, z); y is the floor she stands on (a roof, the overpass deck), by
 * default the ground of Lublin there (ADR-0045).
 */
export const teleport = (s: GameSession, x: number, z: number, yaw = 0, pitch = 0, y?: number) => {
  const p = s.sim.player()!;
  p.position = { x, y: y ?? ground(x, z).y, z };
  p.prevPosition = p.position;
  p.yaw = yaw;
  p.pitch = pitch;
};

/**
 * Where to stand to talk to Kaito: 1.5 m north of him, facing him. Before the first conversation
 * he waits by the chair in Mori's clinic, afterwards at the Neon Koi counter (ADR-0038).
 */
export const nearKaito = (s: GameSession): [number, number, number] => {
  // Away from Shinsekai he is asleep with its chunk: the content says where he stands.
  const at = [...s.sim.world].find((e) => e.key === "fixer")?.position ?? (s.sim.domain.flags.includes("met_fixer") ? FIXER_SPAWN : FIXER_CLINIC_SPAWN).position;
  return [at.x, at.z + 1.5, Math.PI];
};

export const talkToKaito = (s: GameSession) => {
  teleport(s, ...nearKaito(s));
  steps(s, 1, frame({ interact: true }));
};

/** Walks up to the keyed NPC (1.5 m west of it, facing it, on its floor) and presses the interact key. */
export const talkTo = (s: GameSession, key: string) => {
  const npc = [...s.sim.world].find((e) => e.key === key);
  expect(npc, `${key} is in the world`).toBeDefined();
  teleport(s, npc!.position.x - 1.5, npc!.position.z, Math.PI / 2, 0, npc!.position.y);
  steps(s, 1, frame({ interact: true }));
};

/** Mori's interaction opens the clinic; the counter has a button to talk instead. */
export const openClinic = (s: GameSession, ui: Ui) => {
  const mori = [...s.sim.world].find((e) => e.key === "mori")!;
  teleport(s, mori.position.x + 1.5, mori.position.z, -Math.PI / 2, 0, mori.position.y);
  steps(s, 1, frame({ interact: true }));
  expect(ui.getState().shopOpen).toBe(true);
};

export const talkToMori = (s: GameSession, ui: Ui) => {
  openClinic(s, ui);
  s.talkToShopkeeper();
  expect(ui.getState().shopOpen).toBe(false);
  expect(ui.getState().dialogue).not.toBeNull();
};

export const allText = (ui: Ui) => (ui.getState().dialogue?.lines ?? []).map((l) => l.text).join("\n");

/** Takes `pick` at every choice until the conversation ends, then closes it and lets the sim apply the commands. */
export const finishDialogue = (s: GameSession, ui: Ui, pick: number | string = 0) => {
  for (let guard = 0; guard < 10 && !ui.getState().dialogue?.ended; guard++) {
    const choices = ui.getState().dialogue?.choices ?? [];
    const index = typeof pick === "number" ? pick : choices.findIndex((c) => c.text.startsWith(pick));
    s.choose(index < 0 ? 0 : index);
  }
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

/** Fires at the target until it drops, on its floor. Health is topped up so the run never hinges on luck. */
export const shootDown = (s: GameSession, key: string) => {
  for (let i = 0; i < 2000; i++) {
    const t = [...s.sim.world].find((e) => e.key === key);
    if (!t) return;
    const p = s.sim.player()!;
    if (p.health) p.health = { ...p.health, current: p.health.max };
    const [dx, dz, yaw] = ANGLES[Math.floor(i / 150) % ANGLES.length]!;
    teleport(s, t.position.x + dx, t.position.z + dz, yaw, 0.1, t.position.y);
    s.step(frame({ fire: true }));
  }
  throw new Error(`${key} survived`);
};

export const objective = (ui: Ui) => ui.getState().objective ?? "";

/** M0 from a new game: name from Kaito, the courier, payday. Ends with act I started. */
export const playFirstContract = (s: GameSession, ui: Ui) => {
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
export const playContractFragment = (s: GameSession, ui: Ui, render: FakeRender, pick: number) => {
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
export const playMoriFragment = (s: GameSession, ui: Ui, render: FakeRender, pick: number) => {
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
export const playImplantFragment = (s: GameSession, ui: Ui, render: FakeRender, pick: number) => {
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

/** The act-I finale at Mori's. Returns what was said; the act-II opening is then on screen. */
export const playFinale = (s: GameSession, ui: Ui): string => {
  talkToMori(s, ui);
  const text = allText(ui);
  finishDialogue(s, ui);
  return text;
};

/** Act I from a new game with the given flashback picks, through the finale and the act-II opening. */
export const playActOne = (s: GameSession, ui: Ui, render: FakeRender, picks: readonly [number, number, number]) => {
  playFirstContract(s, ui);
  playContractFragment(s, ui, render, picks[0]);
  playMoriFragment(s, ui, render, picks[1]);
  playImplantFragment(s, ui, render, picks[2]);
  playFinale(s, ui);
  finishDialogue(s, ui);
};
