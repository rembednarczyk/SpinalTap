import {
  type Contract,
  ENEMY_TYPES,
  type EntityId,
  type Vec3,
  W3_STATIONS,
  type W3StationId,
  contractAlarmFlag,
  contractChargesKey,
  contractStationKey,
  contractTag,
  secondWaveFlag,
  stationDownFlag,
  takenFlag,
} from "@seki/core";
import { castViewOf } from "../content/cast";
import { W3_CHARGES_CASE, W3_STATION_SPOTS, W3_TECHNICIANS, W3_WAVE_AIRLOCKS, W3_WAVE_PICKUP, stationChargeAt } from "../content/tessen-w3";
import type { Entity } from "./components";
import { type IdAllocator, actor, at, gangerEntity } from "./factory";
import type { Template } from "./stream-catalog";

/**
 * The loud way's people and things of W-3's sabotage (ADR-0082 stage 3b), after the job's own
 * templates: the alarm's two waves, the charges' case, the line's stations, the charges planted
 * and the wrecks, the line's technicians. Whether each is in the world follows the flags, so a
 * load brings back what was planted and blown.
 */

const CASE = { x: 0.9, y: 0.35, z: 0.6 } as const;
const CHARGE = { x: 0.34, y: 0.2, z: 0.26 } as const;
const WRECK = { x: 1.3, y: 0.5, z: 0.6 } as const;
/** A technician takes about as much as a passer-by of the street. */
export const TECHNICIAN_HP = 60;

export const contractChargeKey = (contractId: string, s: W3StationId): string => `${contractId}-charge-${s}`;
export const contractWreckKey = (contractId: string, s: W3StationId): string => `${contractId}-wreck-${s}`;
export const contractTechnicianKey = (contractId: string, i: number): string => `${contractId}-tech${i}`;
const waveKey = (contractId: string, i: number): string => `${contractId}-w${i}`;

const block = (id: EntityId, key: string, chunk: string, p: Vec3, size: Vec3, material: "metal" | "concrete" | "glass"): Entity => ({
  id,
  key,
  chunk,
  ...at({ x: p.x, y: p.y + size.y / 2, z: p.z }),
  view: { kind: "block", size, material },
});

/** The charges' case: the key takes them, which always raises the alarm (its weight sensor). */
const caseEntity = (id: EntityId, key: string, chunk: string): Entity => ({
  ...block(id, key, chunk, W3_CHARGES_CASE, CASE, "metal"),
  interactable: { kind: "terminal", dialogueId: key, prompt: "prompt.take-charges", radius: 1.6 },
});

/** A station's spot to plant on: no view of its own (the station is baked in the hall's mesh). */
const stationEntity = (id: EntityId, key: string, chunk: string, s: W3StationId): Entity => ({
  id,
  key,
  chunk,
  ...at({ ...W3_STATION_SPOTS[s], y: W3_STATION_SPOTS[s].y + 0.6 }),
  interactable: { kind: "terminal", dialogueId: key, prompt: "prompt.plant-charge", radius: 1.6 },
});

/** One of the line's technicians: a bystander of Tessen's who runs from a fight and reports what it sees. */
const technicianEntity = (id: EntityId, key: string, chunk: string, spawn: { at: Vec3; yaw: number }): Entity => ({
  ...actor(id, { key, position: spawn.at, yaw: spawn.yaw }),
  chunk,
  view: { kind: "npc", preset: "civilian", umbrella: false, ...castViewOf(key, key) },
  faction: "tessen",
  velocity: { x: 0, y: 0, z: 0 },
  health: { current: TECHNICIAN_HP, max: TECHNICIAN_HP },
  civilian: { home: spawn.at },
  staff: { seen: 0 },
});

/** A man of a wave: a Tessen guard who comes in knowing there is trouble. */
const waveEntity = (id: EntityId, key: string, chunk: string, tag: string, spawn: { at: Vec3; yaw: number }): Entity => {
  const g = gangerEntity(id, { key, position: spawn.at, yaw: spawn.yaw }, tag, ENEMY_TYPES.tessen_guard.hp, chunk, undefined, "tessen_guard");
  if (g.ai) g.ai.alerted = true;
  return g;
};

/** The sabotage's loud-way templates, ids reserved in this order: waves, case, stations, charges, wrecks, technicians. */
export const sabotageTemplates = (ids: IdAllocator, chunk: string, contract: Contract): Template[] => {
  const tag = contractTag(contract.id);
  const alarm = contractAlarmFlag(contract.id);
  const out: Template[] = [];
  const add = (key: string, make: (id: EntityId) => Entity, when?: Template["when"]) => {
    const id = ids.take();
    out.push({ id, chunk, key, make: () => make(id), ...(when ? { when } : {}) });
  };
  W3_WAVE_AIRLOCKS.forEach((w, i) => add(waveKey(contract.id, i), (id) => waveEntity(id, waveKey(contract.id, i), chunk, tag, w), { all: [alarm] }));
  W3_WAVE_PICKUP.forEach((w, i) => {
    const key = waveKey(contract.id, W3_WAVE_AIRLOCKS.length + i);
    add(key, (id) => waveEntity(id, key, chunk, tag, w), { all: [alarm, secondWaveFlag(contract.id)] });
  });
  const caseKey = contractChargesKey(contract.id);
  add(caseKey, (id) => caseEntity(id, caseKey, chunk));
  for (const s of W3_STATIONS) {
    const key = contractStationKey(contract.id, s);
    add(key, (id) => stationEntity(id, key, chunk, s));
  }
  // A charge is on the station once its spot is used (taken), till it goes off (taken too).
  for (const s of W3_STATIONS) {
    const key = contractChargeKey(contract.id, s);
    add(key, (id) => block(id, key, chunk, stationChargeAt(s), CHARGE, "glass"), { all: [takenFlag(contractStationKey(contract.id, s))] });
  }
  for (const s of W3_STATIONS) {
    const key = contractWreckKey(contract.id, s);
    add(key, (id) => ({ ...block(id, key, chunk, stationChargeAt(s), WRECK, "concrete"), yaw: 0.35 }), { all: [stationDownFlag(s)] });
  }
  W3_TECHNICIANS.forEach((t, i) => {
    const key = contractTechnicianKey(contract.id, i);
    add(key, (id) => technicianEntity(id, key, chunk, t));
  });
  return out;
};
