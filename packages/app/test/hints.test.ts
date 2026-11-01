import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type InputFrame, type RenderPort } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore, isMessageKey, translate } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { HINTS, HintTracker } from "../src/hints";

const render: RenderPort = { spawn() {}, updateTransform() {}, despawn() {}, clear() {}, setCameraMode() {}, attachCamera() {}, playEffect() {}, setAppearance() {} };
const audio = { play() {}, stopAll() {} };

const setup = (opts: { touch?: boolean; seen?: string[]; hints?: boolean } = {}) => {
  const ui = createUiStore();
  const saved: (readonly string[])[] = [];
  const session = new GameSession({
    render,
    audio,
    persistence: new SavePersistence(new MemorySaveStore()),
    ui,
    story: STORY_SOURCE,
    seed: () => 7,
    now: () => new Date(2026, 9, 27, 21, 0),
    touch: opts.touch ?? false,
    hints: { seen: opts.seen ?? [], save: (s) => saved.push(s) },
  });
  if (opts.hints === false) session.intents.changeSettings({ hints: false });
  session.newGame();
  // Out on the street, away from Kaito by the chair in the clinic (ADR-0038): no talk prompt.
  const p = session.sim.player()!;
  p.position = { x: 0, y: 0, z: -28 };
  p.prevPosition = p.position;
  return { session, ui, saved };
};

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });
const steps = (s: GameSession, n: number, f: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(f);
};

describe("first-run hints", () => {
  it("teaches walking with the bound keys, then sprinting, and remembers what was seen", () => {
    const { session, ui, saved } = setup();
    steps(session, 1);
    expect(ui.getState().hint).toEqual({ id: "move", keys: ["KeyW", "KeyA", "KeyS", "KeyD", "MouseMove"], text: "move and look around" });
    steps(session, 90, frame({ moveZ: 1 }));
    expect(ui.getState().hint?.id).toBe("sprint");
    expect(saved.at(-1)).toContain("move");
    steps(session, 60, frame({ moveZ: 1, sprint: true }));
    expect(ui.getState().hint?.id).not.toBe("sprint");
    expect(saved.at(-1)).toContain("sprint");
  });

  it("follows the player's bindings and words hints for touch", () => {
    const { session, ui } = setup();
    session.intents.bindKey("forward", "KeyZ");
    const fresh = setup({ touch: true });
    steps(fresh.session, 1);
    expect(fresh.ui.getState().hint).toEqual({ id: "move", keys: [], text: "Left thumb: move. Right: look around." });
    steps(session, 1);
    expect(ui.getState().hint?.keys[0]).toBe("KeyZ");
  });

  it("speaks the player's language, both catalogs, and switches the shown hint at once (ADR-0056)", () => {
    for (const h of Object.values(HINTS)) {
      expect(isMessageKey(`hint.${h.id}`), h.id).toBe(true);
      if ("touch" in h) expect(isMessageKey(`hint.${h.id}.touch`), h.id).toBe(true);
    }
    expect(translate("pl", "hint.move")).toBe("ruch i rozglądanie");
    const { session, ui } = setup();
    steps(session, 1);
    expect(ui.getState().hint?.text).toBe("move and look around");
    session.intents.changeSettings({ locale: "pl" });
    steps(session, 1);
    expect(ui.getState().hint?.text).toBe("ruch i rozglądanie");
  });

  it("stays quiet when seen before or switched off, and gives up after its time", () => {
    const seen = setup({ seen: ["move", "sprint"] });
    steps(seen.session, 5);
    expect(seen.ui.getState().hint).toBeNull();
    const off = setup({ hints: false });
    steps(off.session, 5);
    expect(off.ui.getState().hint).toBeNull();
    const idle = setup();
    steps(idle.session, Math.ceil(HINTS.move.seconds * 60) + 2);
    expect(idle.ui.getState().hint?.id).toBe("sprint");
  });

  it("raises talk, fight, loot, inventory and journal hints on their events, one at a time", () => {
    const seen = new Set<string>(["move", "sprint"]);
    const t = new HintTracker(seen, () => {}, () => 1);
    const tick = (over: Partial<Parameters<HintTracker["tick"]>[0]> = {}) => t.tick({ dt: 1 / 60, inControl: true, moved: 0, sprinting: false, characterOpen: false, ...over });
    t.start();
    t.onEvent("InteractionFocusChanged", { targetId: 2, prompt: "Rozmawiaj" });
    t.onEvent("ContractAccepted", { contractId: "c", giver: "fixer" } as never);
    tick();
    expect(t.active?.id).toBe("talk");
    t.onEvent("InteractionStarted", { targetId: 2, dialogueId: "kaito", kind: "dialogue" });
    tick();
    expect(t.active?.id).toBe("fight");
    // Not while a menu or a dialogue is open.
    t.onEvent("ShotFired", { shooterId: 1 } as never);
    t.onEvent("ShotFired", { shooterId: 1 } as never);
    tick({ inControl: false });
    expect(t.active).toBeNull();
    t.onEvent("LootDropped", { containerKey: "loot:g", at: { x: 0, y: 0, z: 0 }, best: null });
    t.onEvent("LootTaken", { containerKey: "loot:g", lines: [] } as never);
    tick();
    expect(t.active?.id).toBe("inventory");
    tick({ characterOpen: true });
    tick();
    expect(seen.has("inventory")).toBe(true);
  });

  it("explains heat when it first rises and disguises when one is put on, with no keys", () => {
    const seen = new Set<string>(["move", "sprint"]);
    const t = new HintTracker(seen, () => {}, () => 1);
    const tick = () => t.tick({ dt: 1 / 60, inControl: true, moved: 0, sprinting: false, characterOpen: false });
    t.start();
    const heat = (level: 0 | 1 | 2, previous: 0 | 1 | 2) => t.onEvent("HeatChanged", { level, previous, searching: level > 0, lastKnown: null, searchLeft: 0 });
    heat(1, 0);
    tick();
    expect(t.active).toEqual(HINTS.heat);
    expect(t.active?.keys).toEqual([]);
    // Lying low until the heat is gone is the lesson: seen, and a later rise does not repeat it.
    heat(0, 1);
    tick();
    expect(t.active).toBeNull();
    expect(seen.has("heat")).toBe(true);
    heat(1, 0);
    t.onEvent("DisguiseChanged", { role: null });
    tick();
    expect(t.active).toBeNull();
    t.onEvent("DisguiseChanged", { role: "hebi" });
    tick();
    expect(t.active?.id).toBe("disguise");
  });

  it("words the system hints in both languages", () => {
    for (const id of ["heat", "disguise"]) {
      expect(isMessageKey(`hint.${id}`)).toBe(true);
      expect(translate("pl", `hint.${id}` as never)).not.toBe(translate("en", `hint.${id}` as never));
    }
  });
});
