import { EMPTY_INPUT, type InputFrame } from "@seki/core";
import type { PerfSample } from "@seki/engine";
import type { FixedStepLoop } from "@seki/sim";
import type { UiStore } from "@seki/ui";
import type { GameSession } from "./game-session";

/** Test hook exposed as window.__seki. Used by Playwright smoke, snapshot and perf checks. */
export interface DebugApi {
  ready: boolean;
  state(): {
    screen: string;
    hp: number;
    eddies: number;
    alias: string | null;
    objective: string | null;
    cameraMode: string;
    tick: number;
    dialogue: boolean;
    flags: readonly string[];
    player: { x: number; z: number } | null;
  };
  perf(): PerfSample;
  setPaused(paused: boolean): void;
  teleport(x: number, z: number, yaw?: number, pitch?: number): void;
  step(n: number, input?: Partial<InputFrame>): void;
  /** Fixed camera for inspection shots; null returns to the player camera. */
  view(position: { x: number; y: number; z: number } | null, target?: { x: number; y: number; z: number }): void;
  /** Characters currently wearing an imported model. */
  dressed(): number;
  session: GameSession;
}

export const createDebugApi = (
  session: GameSession,
  ui: UiStore,
  loop: FixedStepLoop,
  perf: () => PerfSample,
  setView: DebugApi["view"],
  dressed: () => number = () => 0,
): DebugApi => ({
  ready: false,
  session,
  state() {
    const sim = session.sim;
    const p = sim.player();
    const s = ui.getState();
    return {
      screen: s.screen,
      hp: s.hp,
      eddies: sim.domain.wallet.eddies,
      alias: sim.domain.character.alias,
      objective: s.objective,
      cameraMode: sim.domain.preferences.cameraMode,
      tick: sim.tick,
      dialogue: s.dialogue !== null,
      flags: sim.domain.flags,
      player: p ? { x: p.position.x, z: p.position.z } : null,
    };
  },
  perf,
  setPaused(paused) {
    loop.paused = paused;
  },
  teleport(x, z, yaw = 0, pitch = 0) {
    const p = session.sim.player();
    if (!p) return;
    p.position = { x, y: 0, z };
    p.prevPosition = p.position;
    p.yaw = yaw;
    p.prevYaw = yaw;
    p.pitch = pitch;
  },
  view: setView,
  dressed,
  step(n, input = {}) {
    for (let i = 0; i < n; i++) session.step({ ...EMPTY_INPUT, ...input });
    session.render(0);
  },
});
