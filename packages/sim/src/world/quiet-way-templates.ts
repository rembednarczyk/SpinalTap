import { type Contract, ENEMY_TYPES, type EntityId, contractTag } from "@seki/core";
import { W3_SHIFT_MANAGER } from "../content/tessen-w3";
import type { Entity } from "./components";
import { type IdAllocator, gangerEntity } from "./factory";
import type { Template } from "./stream-catalog";

/**
 * The quiet way's people of W-3's sabotage (ADR-0082 §1 p. 2, G-929), after all the job's other
 * templates (the loud way's too), so their ids stay: the shift manager on the mezzanine, the hall's
 * enforcer of disguises.
 */

/** Key of the job's shift manager on the mezzanine. */
export const contractManagerKey = (contractId: string): string => `${contractId}-manager`;

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

/** The quiet way's templates: the shift manager. */
export const quietWayTemplates = (ids: IdAllocator, chunk: string, contract: Contract): Template[] => {
  const manager = contractManagerKey(contract.id);
  const tag = contractTag(contract.id);
  const managerId = ids.take();
  return [{ id: managerId, chunk, key: manager, make: () => managerEntity(managerId, manager, chunk, tag) }];
};
