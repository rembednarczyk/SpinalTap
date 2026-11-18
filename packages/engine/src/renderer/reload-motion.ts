/**
 * A reload's motion over time, for the figure and the FPP viewmodel alike. A magazine reload dips
 * the weapon once over its length while the left hand fetches a magazine. A shotgun loads a round
 * at a time (`per-round`, one short reload after another): the weapon stays down for the whole run
 * of shells, and each round the hand goes from the loading port to the pouch and back, pushing the
 * shell in as the step ends. Played as a full magazine dip, every 0.5 s round bobbed the gun up
 * and down.
 */
export interface ReloadMotion {
  /** Seconds left of this reload step, and its full length; 0 when not reloading. */
  reload: number;
  reloadTotal: number;
  /** The step is one round of a per-round reload. */
  reloadRound: boolean;
  /** 0..1: how far a per-round reload holds the weapon down; eases in and out over a run of rounds. */
  reloadHold: number;
}

/** Seconds to bring the weapon down for loading rounds, or back up after the last one. */
const HOLD_EASE = 0.2;

/** Where the left hand is at the loading port (or magazine well) on the way fore-end → pouch. */
export const REACH_PORT = 0.35;

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Starts a reload step of `seconds`; `perRound` when it loads one round of a run. */
export const beginReload = (m: ReloadMotion, seconds: number, perRound = false): void => {
  m.reload = m.reloadTotal = Math.max(0.1, seconds);
  m.reloadRound = perRound;
};

/** Advances the reload by `dt`. */
export const tickReload = (m: ReloadMotion, dt: number): void => {
  m.reload = Math.max(0, m.reload - dt);
  const target = m.reloadRound && m.reload > 0 ? 1 : 0;
  const step = dt / HOLD_EASE;
  m.reloadHold += Math.max(-step, Math.min(step, target - m.reloadHold));
};

/** 0..1..0 over one reload step. */
const cycle = (m: ReloadMotion): number => (m.reloadTotal > 0 && m.reload > 0 ? Math.sin(Math.PI * (1 - m.reload / m.reloadTotal)) : 0);

/** 0..1: how far the weapon is down for the reload. */
export const reloadDown = (m: ReloadMotion): number => (m.reloadRound || m.reloadHold > 0 ? smooth(m.reloadHold) : cycle(m));

/**
 * 0..1: where the left hand is, from the fore-end (0) by the magazine well or loading port
 * (`REACH_PORT`) to the pouch on the hip (1). A magazine goes the whole way and back once; a round
 * goes port → pouch → port while the weapon is held down.
 */
export const reloadReach = (m: ReloadMotion): number => {
  if (!m.reloadRound && m.reloadHold <= 0) return cycle(m);
  const hold = smooth(m.reloadHold);
  return hold * (REACH_PORT + (1 - REACH_PORT) * cycle(m));
};
