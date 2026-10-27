import { describe, expect, it } from "vitest";
import { type AudioPort, type CameraMode, EMPTY_INPUT, type EffectDescriptor, type InputFrame, type RenderPort, type ReputationState } from "@seki/core";
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
const played: string[] = [];
const audio: AudioPort = { play: (cue) => void played.push(cue), stopAll() {} };

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

/** A running session whose standings were patched through a save, like a real reload. */
const sessionWith = async (reputation: Partial<ReputationState>) => {
  const ui = createUiStore();
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render, audio, persistence, ui, story: STORY_SOURCE, seed: () => 5, now: () => new Date(2026, 9, 27) });
  session.newGame();
  const snap = session.snapshot();
  await persistence.save("rep", { ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation } } });
  await session.loadAsync("rep");
  return { session, ui };
};

const standNextTo = (s: GameSession, key: string) => {
  const npc = [...s.sim.world].find((e) => e.key === key)!;
  const p = s.sim.player()!;
  p.position = { x: npc.position.x + 1.5, y: 0, z: npc.position.z };
  p.prevPosition = p.position;
  p.yaw = -Math.PI / 2;
};

const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

describe("M2: NPCs react to reputation", () => {
  it("a hostile clinic keeps its doors shut", async () => {
    const { session, ui } = await sessionWith({ clinic: -70 });
    standNextTo(session, "mori");
    steps(session, 1);
    played.length = 0;
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().shopOpen).toBe(false);
    expect(session.inControl).toBe(true);
    expect(ui.getState().toasts.map((t) => t.title)).toContain("Mori zamyka drzwi kliniki");
    expect(played).toContain("denied");
  });

  it("the street runs from a feared Seki", async () => {
    const { session, ui } = await sessionWith({ civilians: -40 });
    standNextTo(session, "ume");
    steps(session, 45);
    expect(ui.getState().toasts.map((t) => t.title)).toContain("Przechodnie uciekają");
    expect(ui.getState().reputation.civilians).toBe(-40);
  });

  it("a friendly gang lets Seki walk into the alley", async () => {
    const { session, ui } = await sessionWith({ hebi: 30 });
    const p = session.sim.player()!;
    p.position = { x: 0, y: 0, z: 33 };
    p.prevPosition = p.position;
    steps(session, 180);
    expect(p.health?.current).toBe(p.health?.max);
    expect(ui.getState().toasts.map((t) => t.text)).toContain("Gangerzy cię przepuszczają");
  });
});
