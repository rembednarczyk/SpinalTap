// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { type InputFrame, degToRad } from "@seki/core";
import { BrowserInput } from "@seki/engine";
import { type Entity, SIM_DT, aimOrigin, chestOf, gangerEntity, ground, stateHash } from "@seki/sim";
import { type SettingsVm, patchUi } from "@seki/ui";
import { afterEach, describe, expect, it } from "vitest";
import { aimTargetAlong, feedAimAssist } from "../src/aim-assist-feed";
import { feedLookTuning, viewLook } from "../src/look-tuning";
import { feedTouchFire } from "../src/touch-fire";
import { type Game, mountGame, run, unmountGame } from "./game-ui";

/**
 * The aim assist on touch (ADR-0072, stage 3), through the real on-screen controls, the engine's
 * input adapter with its assist and the session, without a renderer (ADR-0046). Each step runs as
 * the app's loop does: settings, weapon and targets into the adapter, poll, scale, pull, step.
 * No renderer means no zoom: the pull goes on after the zoom's scaling, so it does not see it.
 */
let input: BrowserInput | null = null;
const sent: InputFrame[] = [];

afterEach(() => {
  unmountGame();
  input?.dispose();
  input = null;
  sent.length = 0;
});

const SEED = 11;
/** 0.15 s of steps: the pull's time. */
const PULL_STEPS = Math.round(0.15 / SIM_DT);
const SIDE = degToRad(3);

const start = (settings: Partial<SettingsVm> = {}, seed = SEED) => {
  input = new BrowserInput(document.createElement("canvas"));
  input.enabled = true;
  const game = mountGame({ seed, touch: true, pad: input.virtualPad });
  fireEvent.click(screen.getByRole("button", { name: "New Game" }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  game.step(2);
  run(() => patchUi(game.ui, { settings: { ...game.ui.getState().settings, ...settings } }));
  return game;
};

const player = (g: Game): Entity => g.session.sim.player()!;

/**
 * A ganger fighting her 12 m ahead and 3° to the right of the aim axis, with the axis level with
 * its chest: only the yaw is off. The angle is the camera's, from the aim origin.
 */
const alertedGanger = (g: Game, side = SIDE): Entity => {
  // Out of the capsule room onto Plac Litewski, facing north up the open square.
  run(() => g.seki.teleport(70, -50, 0));
  g.step(2);
  const p = player(g);
  p.yaw = 0;
  p.prevYaw = 0;
  const o = aimOrigin(p, g.session.sim.domain.preferences.cameraMode);
  const at = ground(o.x + 12 * Math.sin(side), o.z + 12 * Math.cos(side));
  const e = gangerEntity(4700, { key: "aim-assist", position: at, yaw: Math.PI }, null, 80, p.chunk ?? "");
  e.ai = { ...e.ai!, alerted: true };
  const ganger = g.session.sim.world.add(e);
  const t = aimTargetAlong(o, 0, 0, chestOf(ganger), 0)!;
  p.pitch = t.pitch;
  return ganger;
};

/** The yaw from the aim axis to the ganger's chest now. */
const offYaw = (g: Game, ganger: Entity): number => {
  const p = player(g);
  return aimTargetAlong(aimOrigin(p, g.session.sim.domain.preferences.cameraMode), p.yaw, p.pitch, chestOf(ganger), 0)!.yaw;
};

/** One step of the app's loop (main.tsx), recording the frame it sends. */
const steps = (g: Game, n: number) =>
  act(() => {
    const i = input!;
    for (let k = 0; k < n; k++) {
      const s = g.ui.getState().settings;
      i.setButtonModes({ aim: s.aimMode, crouch: s.crouchMode, sprint: s.sprintMode });
      feedLookTuning(i, s);
      feedTouchFire(i.virtualPad, s, g.session.sim.player());
      feedAimAssist(i.aimAssist, s, g.session.sim, i.shoulder.left);
      const frame = i.aimAssist.apply(viewLook(i.poll(), s, 1), SIM_DT);
      sent.push(frame);
      g.session.step(frame);
    }
    g.session.render(0);
  });

const aimButton = () => screen.getByTestId("touch-aim");
const hash = (g: Game) => stateHash(g.session.sim.snapshot(null, "t", ""));

/** Sets her up 3° off an alerted ganger and raises the sights from touch for 0.15 s. */
const raiseSights = (g: Game, side = SIDE) => {
  const ganger = alertedGanger(g, side);
  const ids = g.session.sim.aimTargets().map((t) => t.id);
  expect(ids).toEqual([ganger.id]);
  const off0 = offYaw(g, ganger);
  const yaw0 = player(g).yaw;
  fireEvent.pointerDown(aimButton(), { pointerId: 2, clientX: 700, clientY: 250 });
  steps(g, PULL_STEPS);
  return { ganger, off0, yaw0, turned: player(g).yaw - yaw0 };
};

describe("aim assist on touch (ADR-0072, stage 3)", () => {
  it("is standard by default and pulls the yaw 60% of the way to the chest within 0.15 s of raising the sights", () => {
    const g = start();
    expect(g.ui.getState().settings.aimAssist).toBe("standard");
    const { off0, turned } = raiseSights(g);
    expect(off0).toBeCloseTo(SIDE, 3);
    expect(player(g).posture!.aiming).toBe(true);
    expect(turned / off0).toBeGreaterThan(0.55);
    expect(turned / off0).toBeLessThan(0.65);
    // No tracking: once the pull is over, the view stays where it went.
    const after = player(g).yaw;
    steps(g, 10);
    expect(player(g).yaw).toBe(after);
  });

  it("holds on another seed and to the left", () => {
    const g = start({}, 29);
    const { off0, turned } = raiseSights(g, -SIDE);
    expect(off0).toBeLessThan(0);
    expect(turned / off0).toBeGreaterThan(0.55);
    expect(turned / off0).toBeLessThan(0.65);
  });

  it("switched off, raising the sights turns nothing", () => {
    const g = start({ aimAssist: "off" });
    const { turned } = raiseSights(g);
    expect(player(g).posture!.aiming).toBe(true);
    expect(turned).toBe(0);
    expect(sent.every((f) => f.lookYaw === 0 && f.lookPitch === 0)).toBe(true);
  });

  it("the mouse gets no assist: the right button raises the sights without a pull", () => {
    const g = start();
    document.dispatchEvent(new Event("pointerlockerror"));
    const ganger = alertedGanger(g);
    const yaw0 = player(g).yaw;
    expect(offYaw(g, ganger)).toBeCloseTo(SIDE, 3);
    window.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
    steps(g, PULL_STEPS);
    window.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
    expect(player(g).posture!.aiming).toBe(true);
    expect(player(g).yaw).toBe(yaw0);
  });

  it("replaying the recorded frames gives the same state hash", () => {
    const g = start();
    raiseSights(g);
    steps(g, 20);
    const recorded = [...sent];
    const live = hash(g);
    unmountGame();
    input?.dispose();
    const replay = start({ aimAssist: "off" });
    alertedGanger(replay);
    act(() => {
      for (const f of recorded) replay.session.step(f);
    });
    expect(hash(replay)).toBe(live);
  });
});
