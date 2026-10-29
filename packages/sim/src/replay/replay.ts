import type { GameCommand, InputFrame, SaveSnapshot } from "@seki/core";
import type { CrowdDensity } from "../content/crowd";
import { Simulation } from "../simulation";

export interface ReplayFrame {
  readonly input: InputFrame;
  readonly commands?: readonly GameCommand[];
}

/**
 * Re-runs a recorded session from its seed. Same seed + same frames = same end state, with or
 * without the crowd of residents (ADR-0041), which is not saved.
 */
export const runReplay = (seed: number, frames: readonly ReplayFrame[], crowd: CrowdDensity = "off"): Simulation => {
  const sim = Simulation.create({ seed, crowd });
  for (const f of frames) {
    for (const c of f.commands ?? []) sim.enqueue(c);
    sim.step(f.input);
  }
  return sim;
};

/** FNV-1a over a canonical JSON form with rounded floats. Used to compare end states. */
export const stateHash = (snapshot: SaveSnapshot): string => {
  const json = JSON.stringify(snapshot, (_k, v: unknown) => (typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};
