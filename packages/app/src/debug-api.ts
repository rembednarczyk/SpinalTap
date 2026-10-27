import { type DomainState, EMPTY_INPUT, type InputFrame, formatClock } from "@seki/core";
import type { PerfSample, PreviewState } from "@seki/engine";
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
    player: { x: number; y: number; z: number } | null;
    /** Ladder the player is on (ADR-0021), null off ladders. */
    climbing: string | null;
    /** In the air (a jump or a fall). */
    airborne: boolean;
    district: string | null;
    loadedChunks: readonly string[];
    /** Game time, "HH:MM". */
    clock: string;
  };
  perf(): PerfSample;
  setPaused(paused: boolean): void;
  /** Moves the player; `y` is the floor to stand on (a roof, the overpass deck), 0 by default. */
  teleport(x: number, z: number, yaw?: number, pitch?: number, y?: number): void;
  /**
   * Restarts the running game from its own snapshot with part of the domain replaced, e.g. to
   * start a test in the middle of the main thread. The world is rebuilt as a load would.
   */
  jump(domain: Partial<DomainState>): void;
  step(n: number, input?: Partial<InputFrame>): void;
  /** Lets game time pass (the wait command), applied on the next step. */
  wait(minutes: number): void;
  /** Fixed camera for inspection shots; null returns to the player camera. */
  view(position: { x: number; y: number; z: number } | null, target?: { x: number; y: number; z: number }): void;
  /** Characters currently wearing an imported model. */
  dressed(): number;
  /** Height of the game camera in metres (crouch checks). */
  cameraY(): number;
  /** What the character menu's 3D preview shows; null without one. */
  preview(): PreviewState | null;
  session: GameSession;
}

export const createDebugApi = (
  session: GameSession,
  ui: UiStore,
  loop: FixedStepLoop,
  perf: () => PerfSample,
  setView: DebugApi["view"],
  dressed: () => number = () => 0,
  cameraY: () => number = () => 0,
  preview: () => PreviewState | null = () => null,
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
      player: p ? { x: p.position.x, y: p.position.y, z: p.position.z } : null,
      climbing: p?.climb?.ladder ?? null,
      airborne: p?.fall !== undefined,
      district: sim.district,
      loadedChunks: sim.streamer.loadedChunks,
      clock: formatClock(sim.clock),
    };
  },
  perf,
  setPaused(paused) {
    loop.paused = paused;
  },
  teleport(x, z, yaw = 0, pitch = 0, y = 0) {
    const p = session.sim.player();
    if (!p) return;
    p.position = { x, y, z };
    p.prevPosition = p.position;
    p.yaw = yaw;
    p.prevYaw = yaw;
    p.pitch = pitch;
  },
  jump(domain) {
    const snapshot = session.snapshot();
    session.restore({ ...snapshot, domain: { ...snapshot.domain, ...domain } });
  },
  view: setView,
  dressed,
  cameraY,
  preview,
  wait(minutes) {
    session.sim.enqueue({ type: "wait", minutes });
  },
  step(n, input = {}) {
    for (let i = 0; i < n; i++) session.step({ ...EMPTY_INPUT, ...input });
    session.render(0);
  },
});
