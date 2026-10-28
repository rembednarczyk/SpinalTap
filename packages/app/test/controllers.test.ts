import { describe, expect, it, vi } from "vitest";
import { type AudioCue, type DomainEvents, EMPTY_INPUT, type EffectDescriptor, EventBus, type GameCommand, type RenderPort, createDomainState } from "@seki/core";
import { NarrativeRuntime, STORY_SOURCE } from "@seki/narrative";
import type { Simulation } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { DialogueController } from "../src/controllers/dialogue-controller";
import { HackController } from "../src/controllers/hack-controller";
import { LootController } from "../src/controllers/loot-controller";
import { ShopController } from "../src/controllers/shop-controller";

/** A stand-in for the simulation: the domain, the tick and the command queue are all a controller sees. */
const fakeSim = () => {
  const commands: GameCommand[] = [];
  const sim = { domain: createDomainState(), tick: 0, enqueue: (c: GameCommand) => commands.push(c) } as unknown as Simulation;
  return { sim: () => sim, commands };
};

const fakeFocus = () => {
  const calls: string[] = [];
  return { focus: { panel: () => calls.push("panel"), settle: () => calls.push("settle") }, calls };
};

const fakeRender = (effects: EffectDescriptor[]): RenderPort => ({
  spawn() {},
  updateTransform() {},
  despawn() {},
  clear() {},
  setCameraMode() {},
  attachCamera() {},
  playEffect: (e) => effects.push(e),
  setAppearance() {},
});

const fakeAudio = (cues: AudioCue[]) => ({ play: (c: AudioCue) => cues.push(c), stopAll() {} });

describe("DialogueController without a session (ADR-0031)", () => {
  const setup = () => {
    const bus = new EventBus<DomainEvents>();
    const ui = createUiStore({ prompt: "Porozmawiaj" });
    const { sim, commands } = fakeSim();
    const narrative = new NarrativeRuntime(STORY_SOURCE, (c) => sim().enqueue(c));
    const effects: EffectDescriptor[] = [];
    const cues: AudioCue[] = [];
    const { focus, calls } = fakeFocus();
    const dialogue = new DialogueController({ bus, narrative, sim, ui, render: fakeRender(effects), audio: fakeAudio(cues), focus });
    return { bus, ui, dialogue, commands, effects, cues, calls };
  };

  it("opens a knot, frees the pointer and hides the prompt", () => {
    const { ui, dialogue, calls } = setup();
    expect(dialogue.isOpen).toBe(false);
    dialogue.open("fixer");
    expect(dialogue.isOpen).toBe(true);
    expect(ui.getState().dialogue?.lines.length).toBeGreaterThan(0);
    expect(ui.getState().prompt).toBeNull();
    expect(calls).toEqual(["panel"]);
  });

  it("moves the partner's mouth after InteractionStarted and stops it on close", () => {
    const { bus, dialogue, effects, commands, calls } = setup();
    bus.emit("InteractionStarted", { targetId: 42, dialogueId: "fixer", kind: "dialogue" });
    dialogue.open("fixer");
    expect(effects[0]).toMatchObject({ kind: "talk", entityId: 42 });
    dialogue.closeDialogue();
    expect(effects.at(-1)).toEqual({ kind: "talk", entityId: 42, seconds: 0 });
    expect(commands).toEqual([{ type: "end-dialogue" }]);
    expect(calls).toEqual(["panel", "settle"]);
    expect(dialogue.isOpen).toBe(false);
  });

  it("ignores choices and close while nothing is open; a silent close sends no command", () => {
    const { ui, dialogue, commands, cues } = setup();
    dialogue.choose(0);
    dialogue.closeDialogue();
    expect(cues).toEqual([]);
    expect(commands).toEqual([]);
    dialogue.open("fixer");
    dialogue.choose(0);
    expect(cues).toEqual(["ui-select"]);
    dialogue.closeSilently();
    expect(ui.getState().dialogue).toBeNull();
    expect(commands).toEqual([]);
  });

  it("a shop interaction sets the talk target too, a bag does not", () => {
    const { bus, dialogue, effects } = setup();
    bus.emit("InteractionStarted", { targetId: 9, dialogueId: "loot:x", kind: "loot" });
    dialogue.open("fixer");
    expect(effects).toEqual([]);
    dialogue.closeSilently();
    bus.emit("InteractionStarted", { targetId: 5, dialogueId: "mori", kind: "shop", shopId: "clinic" });
    dialogue.open("fixer");
    expect(effects[0]).toMatchObject({ kind: "talk", entityId: 5 });
  });
});

describe("HackController without a session (ADR-0031)", () => {
  const setup = (inControl = true) => {
    const ui = createUiStore({ prompt: "Terminal" });
    const { sim, commands } = fakeSim();
    const cues: AudioCue[] = [];
    const { focus, calls } = fakeFocus();
    const hack = new HackController({ sim, ui, audio: fakeAudio(cues), focus, inControl: () => inControl });
    return { ui, hack, commands, cues, calls };
  };

  it("the touch scanner goes into the input frame, a tapped hack only once", () => {
    const { hack } = setup();
    expect(hack.withTouchScan(EMPTY_INPUT)).toBe(EMPTY_INPUT);
    hack.pickQuickhack(2);
    expect(hack.withTouchScan(EMPTY_INPUT)).toBe(EMPTY_INPUT);
    hack.setScan(true);
    expect(hack.scanning(EMPTY_INPUT)).toBe(true);
    hack.pickQuickhack(2);
    expect(hack.withTouchScan(EMPTY_INPUT)).toMatchObject({ scan: true, quickhack: 2 });
    expect(hack.withTouchScan(EMPTY_INPUT)).toMatchObject({ scan: true, quickhack: 0 });
    hack.pickQuickhack(3);
    hack.setScan(false);
    expect(hack.withTouchScan(EMPTY_INPUT)).toBe(EMPTY_INPUT);
    expect(hack.scanning({ ...EMPTY_INPUT, scan: true })).toBe(true);
  });

  it("reset turns the touch scanner off", () => {
    const { hack } = setup();
    hack.setScan(true);
    hack.reset();
    expect(hack.scanning(EMPTY_INPUT)).toBe(false);
  });

  it("a breach opens with at most three daemons and sends what was won", () => {
    const { ui, hack, commands, cues, calls } = setup();
    hack.openBreach("t1", ["icepick", "datamine", "mass_vulnerability", "icepick"]);
    expect(hack.breachOpen).toBe(true);
    expect(ui.getState().breach).toEqual({ terminalKey: "t1", daemons: ["icepick", "datamine", "mass_vulnerability"] });
    expect(ui.getState().prompt).toBeNull();
    hack.submitBreach(["datamine"]);
    expect(hack.breachOpen).toBe(false);
    expect(ui.getState().breach).toBeNull();
    expect(commands).toEqual([{ type: "breach-result", terminalKey: "t1", daemons: ["datamine"] }]);
    expect(cues).toEqual(["quest-update"]);
    expect(calls).toEqual(["panel", "settle"]);
  });

  it("a disconnect sends an empty result; a breach cut short sends nothing", () => {
    const { hack, commands, cues } = setup();
    hack.openBreach("t2");
    hack.submitBreach([]);
    expect(cues).toEqual(["denied"]);
    hack.openBreach("t3");
    hack.closeSilently();
    hack.submitBreach(["icepick"]);
    expect(commands).toEqual([{ type: "breach-result", terminalKey: "t2", daemons: [] }]);
  });

  it("does not open while the player is not in control", () => {
    const { ui, hack } = setup(false);
    hack.openBreach("t1");
    expect(hack.breachOpen).toBe(false);
    expect(ui.getState().breach).toBeNull();
  });
});

describe("ShopController and LootController without a session (ADR-0031)", () => {
  it("trade commands go only to the open counter; talking hands over to the keeper", () => {
    const ui = createUiStore();
    const { sim, commands } = fakeSim();
    const { focus, calls } = fakeFocus();
    const talk = vi.fn();
    const shop = new ShopController({ sim, ui, focus, talk });
    shop.buyItem("medkit");
    expect(commands).toEqual([]);
    expect(shop.tradeFrame()).toEqual({});
    shop.open("oyaji", "oyaji");
    expect(ui.getState()).toMatchObject({ shopOpen: true, shopId: "oyaji" });
    expect(shop.tradeFrame().trade).toBeDefined();
    shop.buyCyberware("subdermal_weave");
    shop.upgradeBackpack();
    expect(commands).toEqual([{ type: "upgrade-capacity" }]);
    shop.talkToShopkeeper();
    expect(talk).toHaveBeenCalledWith("oyaji");
    expect(shop.isOpen).toBe(false);
    expect(calls).toEqual(["panel"]);
  });

  it("an emptied bag closes on the next HUD frame", () => {
    const ui = createUiStore();
    const { sim, commands } = fakeSim();
    const { focus, calls } = fakeFocus();
    const loot = new LootController({ sim, ui, focus });
    loot.open("loot:missing");
    expect(loot.isOpen).toBe(true);
    expect(loot.lootFrame()).toBeNull();
    expect(loot.isOpen).toBe(false);
    expect(commands).toEqual([{ type: "end-dialogue" }]);
    expect(calls).toEqual(["panel", "settle"]);
  });
});
