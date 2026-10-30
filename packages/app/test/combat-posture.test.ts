import { describe, expect, it } from "vitest";
import { type AudioCue, type AudioPort, EMPTY_INPUT, type InputFrame, type RenderPort, recallDialogueId } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { CROUCH_TIME, SIM_DT, type Entity, ground } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { nearKaito } from "./story-helpers";
import { GameSession, RECALL_CALM_TICKS } from "../src/game-session";

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
  const focus: boolean[] = [];
  const session = new GameSession({
    render,
    audio,
    persistence: new SavePersistence(new MemorySaveStore()),
    ui,
    story: STORY_SOURCE,
    seed: () => 2024,
    now: () => new Date(2026, 9, 27, 21, 0),
    onFocusChange: (wants) => focus.push(wants),
  });
  session.newGame();
  return { session, ui, audio, focus };
};

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

const teleport = (e: Entity, x: number, z: number, yaw = 0) => {
  e.position = ground(x, z);
  e.prevPosition = e.position;
  e.yaw = yaw;
  e.prevYaw = yaw;
};

const byKey = (s: GameSession, key: string) => [...s.sim.world].find((e) => e.key === key)!;

/** Starts the first talk with Kaito and walks the courier's guard up behind the player, angry. */
const talkUnderFire = (s: GameSession) => {
  const [x, z, yaw] = nearKaito(s);
  teleport(s.sim.player()!, x, z, yaw);
  steps(s, 1, frame({ interact: true }));
  const guard = byKey(s, "guard");
  teleport(guard, x - 1.2, z + 2, Math.PI);
  guard.ai!.alerted = true;
  return guard;
};

describe("violence interrupts a conversation (app loop)", () => {
  it("closes the dialogue, returns control and says why", () => {
    const { session, ui, focus } = setup();
    talkUnderFire(session);
    expect(ui.getState().dialogue).not.toBeNull();
    session.intents.choose(0);
    expect(session.inControl).toBe(false);
    for (let i = 0; i < 600 && ui.getState().dialogue; i++) steps(session, 1);
    expect(ui.getState().dialogue).toBeNull();
    expect(session.inControl).toBe(true);
    expect(session.sim.session.dialogueActive).toBe(false);
    expect(focus.at(-1)).toBe(true);
    expect(ui.getState().toasts.map((t) => t.title)).toContain("Rozmowa przerwana");
    expect(session.narrative.inConversation).toBe(false);
    // Stale UI clicks are ignored: no effects, no second end-dialogue.
    session.intents.choose(0);
    session.intents.closeDialogue();
    steps(session, 1);
    expect(session.sim.domain.flags).not.toContain("met_fixer");
    expect(session.sim.domain.character.alias).toBeNull();
  });

  it("the talk can start over from the beginning and finish normally", () => {
    const { session, ui } = setup();
    talkUnderFire(session);
    const firstLine = ui.getState().dialogue!.lines[0];
    for (let i = 0; i < 600 && ui.getState().dialogue; i++) steps(session, 1);
    // Take the guard out of the picture and talk again.
    session.sim.world.remove(byKey(session, "guard"));
    for (const g of [...session.sim.world.with("ai")]) g.ai.alerted = false;
    session.sim.player()!.health = { current: 100, max: 100 };
    teleport(session.sim.player()!, ...nearKaito(session));
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().dialogue?.lines[0]).toEqual(firstLine);
    for (let g = 0; g < 10 && !ui.getState().dialogue?.ended; g++) session.intents.choose(0);
    session.intents.closeDialogue();
    steps(session, 2);
    expect(session.sim.domain.flags.filter((f) => f === "met_fixer")).toHaveLength(1);
    expect(session.sim.domain.reputation.fixers).toBe(5);
  });

  it("closes the clinic counter as well", () => {
    const { session, ui } = setup();
    const mori = byKey(session, "mori");
    teleport(session.sim.player()!, mori.position.x + 1.5, mori.position.z, -Math.PI / 2);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().shopOpen).toBe(true);
    const guard = byKey(session, "guard");
    // Across the clinic from the counter, in the room (the clinic faces the deptak, ADR-0045).
    teleport(guard, mori.position.x + 1.5, mori.position.z - 5, 0);
    guard.ai!.alerted = true;
    for (let i = 0; i < 600 && ui.getState().shopOpen; i++) steps(session, 1);
    expect(ui.getState().shopOpen).toBe(false);
    expect(session.inControl).toBe(true);
  });

  it("holds a pending flashback until the shooting has stopped for a while", () => {
    const { session, ui } = setup();
    session.sim.enqueue({ type: "unlock-memory", memoryId: "courier_case" });
    session.sim.session.lastThreat = { tick: session.sim.tick, sourceId: byKey(session, "guard").id };
    steps(session, 2);
    expect(ui.getState().dialogue).toBeNull();
    steps(session, RECALL_CALM_TICKS);
    expect(ui.getState().dialogue).not.toBeNull();
    expect(session.narrative.inConversation).toBe(true);
    expect(recallDialogueId("courier_case")).toContain("courier_case");
  });
});

describe("crosshair and crouch in the HUD", () => {
  it("narrows while crouched, widens while running, and stays put when nothing changes", () => {
    const { session, ui } = setup();
    steps(session, 1);
    const standing = ui.getState().aimSpread;
    expect(standing).toBeGreaterThan(0);
    steps(session, Math.ceil(CROUCH_TIME / SIM_DT) + 1, frame({ crouch: true }));
    expect(ui.getState().crouched).toBe(true);
    expect(ui.getState().aimSpread).toBeLessThan(standing * 0.6);
    steps(session, 20, frame({ moveZ: 1, sprint: true }));
    expect(ui.getState().crouched).toBe(false);
    expect(ui.getState().aimSpread).toBeGreaterThan(standing);
    steps(session, 30);
    let changes = 0;
    const off = ui.subscribe(() => (changes += 1));
    steps(session, 10);
    off();
    expect(changes).toBe(0);
  });

  it("marks head hits for the crosshair and plays the critical cue", () => {
    const { session, ui, audio } = setup();
    const guard = byKey(session, "guard");
    const p = session.sim.player()!;
    teleport(p, guard.position.x, guard.position.z - 4, 0);
    p.pitch = -0.03;
    for (let i = 0; i < 60 && ui.getState().hitMarker === 0; i++) steps(session, 1, frame({ fire: true }));
    expect(ui.getState().hitZone).toBe("head");
    expect(audio.cues).toContain("critical");
  });
});
