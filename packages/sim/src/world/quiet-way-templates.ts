import { type Contract, ENEMY_TYPES, type EntityId, contractTag, hm } from "@seki/core";
import { castViewOf } from "../content/cast";
import { W3_SHIFT_MANAGER, W3_SMOKER } from "../content/tessen-w3";
import type { Entity, ScheduleDef } from "./components";
import { smokeFlag } from "./contract-plan";
import { type IdAllocator, actor, gangerEntity } from "./factory";
import { TECHNICIAN_HP } from "./sabotage-templates";
import type { Template } from "./stream-catalog";

/**
 * The quiet way's people of W-3's sabotage (ADR-0082 §1 p. 2, G-929), after all the job's other
 * templates (the loud way's too), so their ids stay: the shift manager on the mezzanine, the hall's
 * enforcer of disguises, and the technician smoking by the service gate in the evening, who tells
 * of locker 14.
 */

/** Key of the job's shift manager on the mezzanine. */
export const contractManagerKey = (contractId: string): string => `${contractId}-manager`;
/** Key of the job's smoker by the service gate (the carrier `ofJob: "smoker"` of `hook_sabotage_2`). */
export const contractSmokerKey = (contractId: string): string => `${contractId}-smoker`;

/**
 * The shift manager: a Tessen guard of the job's crew who sees through disguises, as the pass
 * office's shift boss does (ADR-0033), walking his round of the mezzanine.
 */
const managerEntity = (id: EntityId, key: string, chunk: string, tag: string): Entity => {
  const post = W3_SHIFT_MANAGER;
  const spawn = { key, position: post.at, yaw: post.yaw, enforcer: true };
  const g = gangerEntity(id, spawn, tag, ENEMY_TYPES[post.type].hp, chunk, undefined, post.type);
  if (g.ai && post.route) g.ai = { ...g.ai, route: { points: post.route, phase: 0 } };
  return g;
};

/** The smoker's whole plan: a cigarette at his spot (he is in the world only in his hours). */
const SMOKER_PLAN: ScheduleDef = {
  speed: 1.2,
  stops: [{ label: "smoke", at: hm(W3_SMOKER.fromHour), path: [W3_SMOKER.at], yaw: W3_SMOKER.yaw, activity: "smoke" }],
};

/**
 * The smoker: one of Tessen's technicians on a break outside the fence, a bystander like the
 * passers-by. Not one of the line's staff: out there he reports nobody.
 */
const smokerEntity = (id: EntityId, key: string, chunk: string): Entity => ({
  ...actor(id, { key, position: W3_SMOKER.at, yaw: W3_SMOKER.yaw }),
  chunk,
  view: { kind: "npc", preset: "civilian", ...castViewOf(key, key) },
  faction: "tessen",
  velocity: { x: 0, y: 0, z: 0 },
  health: { current: TECHNICIAN_HP, max: TECHNICIAN_HP },
  civilian: { home: W3_SMOKER.at },
  schedule: { def: SMOKER_PLAN, own: null, pose: null },
});

/** The quiet way's templates, ids reserved in this order: the shift manager, the smoker. */
export const quietWayTemplates = (ids: IdAllocator, chunk: string, contract: Contract): Template[] => {
  const manager = contractManagerKey(contract.id);
  const smoker = contractSmokerKey(contract.id);
  const tag = contractTag(contract.id);
  const managerId = ids.take();
  const smokerId = ids.take();
  return [
    { id: managerId, chunk, key: manager, make: () => managerEntity(managerId, manager, chunk, tag) },
    { id: smokerId, chunk, key: smoker, make: () => smokerEntity(smokerId, smoker, chunk), when: { all: [smokeFlag(contract.id)] } },
  ];
};
