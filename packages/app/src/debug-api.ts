import { type BreachDaemonId, type DomainEvents, type DomainState, EMPTY_INPUT, type InputFrame, type MetroStationId, formatClock } from "@seki/core";
import type { PerfSample, PreviewState } from "@seki/engine";
import { type FixedStepLoop, clinicPoint, docks, koiPoint, market } from "@seki/sim";
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
    /** Residents of the crowd in the world (ADR-0041). */
    residents: number;
  };
  perf(): PerfSample;
  setPaused(paused: boolean): void;
  /** Moves the player; `y` is the floor to stand on (a roof, the overpass deck), Lublin's ground by default. */
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
  /**
   * Puts a domain event on the bus as if the simulation had sent it (ADR-0028 HUD checks:
   * PhoneMessage, ContractDebrief, HeatChanged...), then refreshes the HUD.
   */
  emit<K extends keyof DomainEvents>(type: K, payload: DomainEvents[K]): void;
  /** Opens the breach minigame for a terminal, as the terminals of the simulation will. */
  breach(terminalKey: string, daemons?: readonly BreachDaemonId[]): void;
  /** Opens the metro line map as the kiosk at `from` would (ADR-0035). */
  metro(from: MetroStationId): void;
  /**
   * A point of a set piece in its own coordinates, in the world (ADR-0045): the market and the
   * docks are moved, the clinic and Neon Koi are turned into their tenements.
   */
  place(frame: PlaceFrame, x: number, y: number, z: number): { x: number; y: number; z: number };
  /**
   * Sprints along a route of (x, z) waypoints, turning towards each one, stepping the
   * simulation in the page; stops at a waypoint it cannot reach. Returns how many it reached.
   */
  walk(route: readonly (readonly [number, number])[], maxSteps?: number): number;
  session: GameSession;
}

export type PlaceFrame = "market" | "docks" | "clinic" | "koi";

const FRAMES: Readonly<Record<PlaceFrame, (x: number, y: number, z: number) => { x: number; y: number; z: number }>> = { market, docks, clinic: clinicPoint, koi: koiPoint };

/** Shortest turn from `a` to `b`, radians. */
const turn = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));

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
      residents: [...sim.world].filter((e) => e.view?.kind === "crowd").length,
    };
  },
  perf,
  setPaused(paused) {
    loop.paused = paused;
  },
  teleport(x, z, yaw = 0, pitch = 0, y) {
    const p = session.sim.player();
    if (!p) return;
    // On the ground of the map (ADR-0045) unless a height is given (a deck, a roof).
    p.position = { x, y: y ?? session.sim.streamer.ground.heightAt(x, z), z };
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
  emit(type, payload) {
    session.bus.emit(type, payload);
    session.syncHud();
  },
  breach(terminalKey, daemons) {
    session.openBreach(terminalKey, daemons);
  },
  metro(from) {
    session.openMetro(from);
  },
  wait(minutes) {
    session.sim.enqueue({ type: "wait", minutes });
  },
  step(n, input = {}) {
    for (let i = 0; i < n; i++) session.step({ ...EMPTY_INPUT, ...input });
    session.render(0);
  },
  place(frame, x, y, z) {
    return FRAMES[frame](x, y, z);
  },
  walk(route, maxSteps = 1500) {
    let reached = 0;
    for (const [x, z] of route) {
      let steps = 0;
      for (; steps < maxSteps; steps++) {
        const p = session.sim.player();
        if (!p || Math.hypot(x - p.position.x, z - p.position.z) < 0.6) break;
        const lookYaw = turn(p.yaw, Math.atan2(x - p.position.x, z - p.position.z));
        session.step({ ...EMPTY_INPUT, moveZ: 1, sprint: true, lookYaw });
      }
      if (steps >= maxSteps) break;
      reached++;
    }
    session.render(0);
    return reached;
  },
});
