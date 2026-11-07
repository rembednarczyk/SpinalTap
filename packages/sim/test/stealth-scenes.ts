import { type Contract, type EnemyTypeId, INITIAL_PROGRESSION, type SaveSnapshot, type Vec3, contractItemKey, contractTag, takenFlag, xpForLevel } from "@seki/core";
import { HANA_SPOT, SIM_DT, Simulation, TAKEDOWN_TIME, docks, gangerEntity, ground, type Entity } from "../src";
import { input, streetSim, teleportPlayer } from "./helpers";
import { setProfile } from "./difficulty-scenes";

/*
 * Scenes of the stealth tests (ADR-0069, stage 1): Plac Litewski with nobody else on it, one enemy
 * `distance` m north of the player, and the seconds it takes to raise the alarm.
 */

/** Every enemy type with the AI of a ganger (the sniper keeps its own sight). */
export const SIGHTED: readonly EnemyTypeId[] = ["hebi_ganger", "hebi_lookout", "hebi_brawler", "hebi_enforcer", "kagami_cleaner", "tessen_guard"];

export const STAND = input();
export const CROUCH = input({ crouch: true });
export const CREEP = input({ crouch: true, moveZ: 1 });
/** The longest a measurement waits for the alarm. */
export const PATIENCE = 6;

/** The square, nobody armed on it, the player facing north (crouched with `crouch`), at `awareness`. */
export const emptySquare = (crouch: boolean, awareness = 1, seed = 7): Simulation => {
  const sim = streetSim({ seed });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  if (awareness !== 1) setProfile(sim, { awareness });
  const p = sim.player()!;
  p.yaw = 0;
  p.prevYaw = 0;
  p.posture!.crouched = crouch;
  p.posture!.amount = crouch ? 1 : 0;
  p.posture!.prevAmount = crouch ? 1 : 0;
  return sim;
};

/** An enemy of `type` `distance` m north of the player, facing north (its back to her) or, with `facing`, south at her. */
export const enemyAt = (sim: Simulation, type: EnemyTypeId, distance: number, facing = false): Entity => {
  const p = sim.player()!;
  const at = { x: p.position.x, y: p.position.y, z: p.position.z + distance };
  return sim.world.add(gangerEntity(4100, { key: `stealth-${type}`, position: at, yaw: facing ? Math.PI : 0 }, null, 1e6, p.chunk ?? "", undefined, type));
};

/** Seconds until `g` is alerted under `frame`, null if not within `PATIENCE`. */
export const secondsToAlarm = (sim: Simulation, g: Entity, frame = STAND): number | null => {
  for (let i = 1; i <= Math.ceil(PATIENCE / SIM_DT); i++) {
    sim.step(frame);
    if (g.ai?.alerted) return i * SIM_DT;
  }
  return null;
};

/** How a crouched approach from behind ended: knocked out without an alarm, or why not. */
export type Approach = "knocked-out" | "alarm" | "no-prompt" | "awake";

/** Creeps north at `g` until the takedown is offered, takes it and waits for the end of it. */
export const creepAndTakeDown = (sim: Simulation, g: Entity): Approach => {
  for (let i = 0; i < Math.ceil(PATIENCE / SIM_DT) && sim.session.takedownTarget?.id !== g.id; i++) {
    sim.step(CREEP);
    if (g.ai?.alerted) return "alarm";
  }
  if (sim.session.takedownTarget?.id !== g.id) return "no-prompt";
  sim.step(CROUCH);
  sim.enqueue({ type: "takedown", lethal: false });
  for (let i = 0; i < Math.ceil(TAKEDOWN_TIME / SIM_DT) + 2; i++) {
    sim.step(CROUCH);
    if (g.ai?.alerted) return "alarm";
  }
  return g.unconscious ? "knocked-out" : "awake";
};


/** A copy of the run, built the way a load builds it, without the cameras (see `stealthContract`). */
export const branch = (sim: Simulation): Simulation => noCameras(Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))) as SaveSnapshot));

const noCameras = (sim: Simulation): Simulation => {
  for (const d of [...sim.world.with("device")]) if (d.device.kind === "camera") sim.world.remove(d);
  return sim;
};

/**
 * A stealth contract (`retrieve` at the Hebi stash, `infiltrate` in the Tessen office) taken with
 * `completed` jobs behind her (so with a variation from the fifth on). The cameras are taken off:
 * they keep their own sight (ADR-0029, unchanged by ADR-0069) and are hacked or walked round.
 * The crew grows with the job's level (ADR-0059); she is of the level whose crew is the one these
 * jobs used to bring (one more man every three jobs, one more every 10 levels from 20). That holds
 * in the docks; the Hebi stash in Alchemia lies in Krakowskie's band (1-8), whose jobs send no more.
 */
export const stealthContract = (kind: "retrieve" | "infiltrate", seed: number, completed: number): { sim: Simulation; contract: Contract } => {
  const fresh = Simulation.create({ seed }).snapshot(null, "t", "");
  const more = Math.floor(completed / 3);
  const level = more === 0 ? 1 : 10 + 10 * more;
  const progression = { ...INITIAL_PROGRESSION, level, xp: xpForLevel(level) };
  const domain = { ...fresh.domain, progression, contracts: { active: null, completed } };
  const sim = Simulation.fromSnapshot(JSON.parse(JSON.stringify({ ...fresh, domain })) as SaveSnapshot);
  teleportPlayer(sim, kind === "retrieve" ? ground(HANA_SPOT.x - 1.5, HANA_SPOT.z) : docks(0, 0, 120));
  for (let i = 0; i < 30; i++) sim.step();
  sim.enqueue({ type: "accept-contract", kind });
  sim.step();
  const contract = sim.domain.contracts.active;
  if (!contract) throw new Error(`no ${kind} contract`);
  return { sim: noCameras(sim), contract };
};

/** The posts of the contract still on their feet. */
export const postsOf = (sim: Simulation, c: Contract): Entity[] =>
  [...sim.world.with("ai")].filter((g) => g.tag === contractTag(c.id) && !g.unconscious && (g.health?.current ?? 0) > 0);

const anyAlarm = (sim: Simulation, c: Contract): boolean => [...sim.world.with("ai")].some((g) => g.tag === contractTag(c.id) && g.ai.alerted);

const crouchNow = (sim: Simulation): void => {
  const p = sim.player()!;
  p.posture!.crouched = true;
  p.posture!.amount = 1;
  p.posture!.prevAmount = 1;
};

/** In a branch: crouched right behind post `key`, takes it down; the branch if it went down and nobody raised the alarm. */
const fromBehind = (sim: Simulation, c: Contract, key: string): Simulation | null => {
  const s = branch(sim);
  const g = postsOf(s, c).find((e) => e.key === key);
  if (!g) return null;
  teleportPlayer(s, { x: g.position.x - Math.sin(g.yaw) * 1.3, y: g.position.y, z: g.position.z - Math.cos(g.yaw) * 1.3 }, g.yaw);
  crouchNow(s);
  s.step(CROUCH);
  if (s.session.takedownTarget?.id !== g.id) return null;
  s.enqueue({ type: "takedown", lethal: false });
  for (let i = 0; i < Math.ceil((TAKEDOWN_TIME + 1) / SIM_DT); i++) s.step(CROUCH);
  return g.unconscious && !anyAlarm(s, c) ? s : null;
};

/** In a branch: crouched by the objective, takes it; whether it was taken with nobody raising the alarm. */
const takesObjective = (sim: Simulation, c: Contract, at: Vec3): boolean => {
  const s = branch(sim);
  teleportPlayer(s, { x: at.x - 1, y: at.y, z: at.z }, Math.PI / 2);
  crouchNow(s);
  for (let i = 0; i < 60; i++) s.step(CROUCH);
  s.step(input({ crouch: true, interact: true }));
  for (let i = 0; i < 120; i++) s.step(CROUCH);
  return s.domain.flags.includes(takenFlag(contractItemKey(c.id))) && !anyAlarm(s, c);
};

/**
 * Whether the objective at `at` can be taken without an alarm, taking down from behind (one after
 * another, each with its back unwatched) the posts that watch it. Returns the keys taken down, or
 * null when it cannot.
 */
export const sneakToObjective = (sim: Simulation, c: Contract, at: Vec3): string[] | null => {
  const down: string[] = [];
  let now = sim;
  for (;;) {
    if (takesObjective(now, c, at)) return down;
    let next: Simulation | null = null;
    for (const g of postsOf(now, c)) {
      next = fromBehind(now, c, g.key!);
      if (next) {
        down.push(g.key!);
        break;
      }
    }
    if (!next) return null;
    now = next;
  }
};
