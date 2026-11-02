import { describe, expect, it } from "vitest";
import { type AudioPort, type EffectDescriptor, EMPTY_INPUT, type EntityId, type RenderPort, type ViewDescriptor } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { SCHEDULES, ground, market } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";

class FakeRender implements RenderPort {
  readonly views = new Map<EntityId, ViewDescriptor>();
  readonly effects: EffectDescriptor[] = [];
  spawn(id: EntityId, v: ViewDescriptor) {
    this.views.set(id, v);
  }
  updateTransform() {}
  despawn(id: EntityId) {
    this.views.delete(id);
  }
  clear() {
    this.views.clear();
  }
  setCameraMode() {}
  attachCamera() {}
  setAppearance() {}
  playEffect(e: EffectDescriptor) {
    this.effects.push(e);
  }
  light(): { daylight: number; hour: number }[] {
    return this.effects.flatMap((e) => (e.kind === "time-of-day" ? [{ daylight: e.daylight, hour: e.hour }] : []));
  }
}

const audio: AudioPort = { play() {}, stopAll() {} };

const setup = () => {
  const render = new FakeRender();
  const ui = createUiStore();
  const session = new GameSession({
    render,
    audio,
    persistence: new SavePersistence(new MemorySaveStore()),
    ui,
    story: STORY_SOURCE,
    seed: () => 31,
    now: () => new Date(2026, 9, 27, 21, 0),
  });
  return { session, render, ui };
};

const frames = (s: GameSession, n: number, interact = false) => {
  for (let i = 0; i < n; i++) {
    s.step(interact && i === 0 ? { ...EMPTY_INPUT, interact: true } : EMPTY_INPUT);
    s.render(0);
  }
};

const goTo = (s: GameSession, x: number, z: number, y?: number) => {
  const p = s.sim.player()!;
  p.position = { x, y: y ?? ground(x, z).y, z };
  p.prevPosition = p.position;
  frames(s, 1);
};

const wait = (s: GameSession, minutes: number) => {
  s.sim.enqueue({ type: "wait", minutes });
  frames(s, 1);
};

const oyajiDoor = () => {
  const stop = SCHEDULES.oyaji?.stops[1];
  if (!stop) throw new Error("no oyaji schedule");
  return stop.path[stop.path.length - 1]!;
};

describe("M2: day clock and schedules through the game loop", () => {
  it("the HUD clock runs a game hour per real minute of fixed steps", () => {
    const { session, ui } = setup();
    session.newGame();
    expect(ui.getState()).toMatchObject({ clock: "21:00", day: 1, dayPhase: "night" });
    frames(session, 60 * 60);
    expect(ui.getState().clock).toBe("22:00");
    wait(session, 3 * 60);
    expect(ui.getState()).toMatchObject({ clock: "01:00", day: 2, dayPhase: "night" });
    expect(ui.getState().toasts.map((t) => t.title)).toContain("Time passes: 01:00");
  });

  it("sends the time of day to the renderer only when the light level moves", () => {
    const { session, render } = setup();
    session.newGame();
    frames(session, 600);
    // One night-time update after the views were built, none while the night lasts.
    expect(render.light()).toEqual([{ daylight: 0, hour: 21 }]);

    wait(session, 8 * 60 + 50); // 05:50, dawn
    const dawn = render.light().slice(1);
    expect(dawn).toHaveLength(1);
    frames(session, 60 * 30);
    const levels = render.light().map((l) => l.daylight);
    expect(levels.length).toBeGreaterThan(5);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(levels.every((l, i) => i === 0 || l !== levels[i - 1])).toBe(true);

    wait(session, 6 * 60); // past noon
    expect(render.light().at(-1)?.daylight).toBe(1);
  });

  it("Oyaji is closed at night: the prompt and his words say so; by day the closed sign is gone", () => {
    const { session, ui } = setup();
    session.newGame();
    const gate = market(40, 0, 78);
    goTo(session, gate.x, gate.z);
    wait(session, 90); // 22:30
    frames(session, 60 * 10);
    const door = oyajiDoor();
    goTo(session, door.x + 1.5, door.z + 0.8, door.y);
    expect(ui.getState().prompt).toBe("Oyaji's stall: closed until 8:00");
    frames(session, 1, true);
    const dialogue = ui.getState().dialogue;
    expect(dialogue?.lines[0]?.speaker).toBe("Oyaji");
    expect(dialogue?.lines.map((l) => l.text).join(" ")).toMatch(/ósmej/);
    session.intents.closeDialogue();

    wait(session, 10 * 60); // 08:30
    frames(session, 2);
    expect(ui.getState().prompt ?? "").not.toMatch(/closed/);
  });

  it("save and load keep the time of day and resend it to a cleared renderer", async () => {
    const { session, ui, render } = setup();
    session.newGame();
    wait(session, 9 * 60 + 30); // 06:30
    frames(session, 1);
    expect(await session.saves.saveAsync("slot-1")).toBe(true);
    const lit = render.light().at(-1)?.daylight ?? 0;
    expect(lit).toBeGreaterThan(0);

    session.newGame();
    expect(render.light().at(-1)?.daylight).toBe(0);
    expect(ui.getState().clock).toBe("21:00");

    expect(await session.saves.loadAsync("slot-1")).toBe(true);
    expect(ui.getState()).toMatchObject({ clock: "06:30", dayPhase: "dawn" });
    expect(render.light().at(-1)?.daylight).toBe(lit);
  });
});
