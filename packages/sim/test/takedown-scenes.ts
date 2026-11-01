import type { Vec3 } from "@seki/core";
import { SIM_DT, type Simulation, TAKEDOWN_TIME, deviceEntity, gangerEntity, type Entity } from "../src";
import { input, run, streetSim, teleportPlayer } from "./helpers";

/** Scenes of the takedown tests of ADR-0065, stage 2: witnesses and bodies on Plac Litewski. */

export const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);
export const CROUCH = input({ crouch: true });

/** Plac Litewski with nobody armed on it, the player crouched (Hebi's ground: its security). */
export const quietStreet = (seed = 7): Simulation => {
  const sim = streetSim({ seed });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  const p = sim.player()!;
  p.posture!.crouched = true;
  p.posture!.amount = 1;
  p.posture!.prevAmount = 1;
  return sim;
};

export const offset = (sim: Simulation, dx: number, dz: number): Vec3 => {
  const p = sim.player()!.position;
  return { x: p.x + dx, y: p.y, z: p.z + dz };
};

/** A Tessen guard 1.2 m north of the player with its back to her: the one she takes down. */
export const victim = (sim: Simulation): Entity =>
  sim.world.add(gangerEntity(4000, { key: "victim", position: offset(sim, 0, 1.2), yaw: 0 }, null, 80, sim.player()!.chunk ?? "", undefined, "tessen_guard"));

/** A bystander with health (as Oyaji at his stall, without the shop) 1.2 m north of the player, its back to her: no weapon, no AI. */
export const stallholder = (sim: Simulation, id = 4000, spot = offset(sim, 0, 1.2)): Entity => {
  return sim.world.add({
    id,
    key: `stallholder-${id}`,
    position: spot,
    prevPosition: spot,
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    body: { radius: 0.38, height: 1.8 },
    faction: "civilians",
    velocity: { x: 0, y: 0, z: 0 },
    health: { current: 60, max: 60 },
    civilian: { home: spot },
  });
};

/** A Hebi street patrol (the security of the square) at `at`, facing `yaw`: it watches a neutral player, it does not attack. */
export const patrol = (sim: Simulation, id: number, at: Vec3, yaw: number): Entity => {
  const g = gangerEntity(id, { key: `patrol-${id}`, position: at, yaw }, null, 80, sim.player()!.chunk ?? "");
  g.ai = { ...g.ai!, patrol: true };
  return sim.world.add(g);
};

/** A Hebi camera at `at` (2.5 m up), facing `yaw`, watching no zone. */
export const camera = (sim: Simulation, id: number, at: Vec3, yaw: number): Entity =>
  sim.world.add(deviceEntity(id, { key: `cam-${id}`, chunk: sim.player()!.chunk ?? "", kind: "camera", position: { ...at, y: at.y + 2.5 }, yaw, network: "hebi", faction: "hebi" }));

/** Takes down whoever the prompt offers and waits for the end of it. */
export const takeDown = (sim: Simulation, lethal = false): void => {
  sim.step(CROUCH);
  sim.enqueue({ type: "takedown", lethal });
  run(sim, ticks(TAKEDOWN_TIME), CROUCH);
};

/**
 * Out of everybody's sight, 40 m east of the body and looking back west: the security's entry at
 * the deptak's west end is behind her, in reach of the reinforcements.
 */
export const walkAway = (sim: Simulation): void => {
  teleportPlayer(sim, offset(sim, 40, 0), -Math.PI / 2);
};
