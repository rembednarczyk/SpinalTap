import { type DifficultyProfile, NORMAL_DIFFICULTY, type SaveSnapshot, type Vec3 } from "@seki/core";
import { Simulation, docks, gangerEntity } from "../src";
import { streetSim, teleportPlayer } from "./helpers";

/* Scenes of the difficulty tests (ADR-0066): a profile that differs from "normal" in a field or two. */

export const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
export const profile = (patch: Partial<DifficultyProfile>): DifficultyProfile => ({ ...NORMAL_DIFFICULTY, ...patch });

/** Sets the profile by command (outside a fight it takes effect in the step). */
export const setProfile = (sim: Simulation, patch: Partial<DifficultyProfile>): void => {
  sim.enqueue({ type: "set-difficulty", profile: profile(patch) });
  sim.step();
};

/** The player cannot die in these tests. */
export const tough = (sim: Simulation) => {
  sim.player()!.health = { current: 1e6, max: 1e6 };
};

/** A point of the docks in their own coordinates (ADR-0045). */
export const DOCKS_CHUNK = "nabrzeze-1-1";
const atDocks = (x: number, z: number): Vec3 => docks(x, 0, z);

/**
 * In the docks yard with a Tessen guard (or `type`) `distance` m west of the player, alerted, after
 * `patch`; with `ram`, the cyberdeck starts that low.
 */
export const yardFight = (patch: Partial<DifficultyProfile>, opts: { type?: "tessen_guard" | "hebi_brawler"; distance?: number; ram?: number } = {}) => {
  const base = streetSim({ seed: 21 });
  const snap = base.snapshot(null, "t", "");
  const sim = opts.ram === undefined ? base : Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, netrun: { ...snap.domain.netrun, ram: opts.ram } } });
  teleportPlayer(sim, atDocks(16, 97), -Math.PI / 2);
  sim.step();
  setProfile(sim, patch);
  tough(sim);
  const p = sim.player()!.position;
  const g = gangerEntity(90010, { key: "test-guard", position: { ...p, x: p.x - (opts.distance ?? 14) }, yaw: Math.PI / 2 }, null, 1e6, DOCKS_CHUNK, undefined, opts.type ?? "tessen_guard");
  g.ai!.alerted = true;
  sim.world.add(g);
  return { sim, g };
};
