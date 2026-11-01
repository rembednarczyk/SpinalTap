import {
  type Contract,
  ENEMY_TYPES,
  type EnemyTypeId,
  PROTECTEE_KEY,
  type Vec3,
  contractAlarmFlag,
  contractEscortKey,
  contractItemKey,
  contractKind,
  contractTag,
  contractTerminalKey,
} from "@seki/core";
import { CONTRACT_SITE_SPAWNS, contractSpawnYaw } from "../content/district-m0";
import { CONTRACT_ITEM_SPOTS } from "../content/district-targ";
import { DOKI_CONTRACT_POSTS, DOKI_ITEM_SPOTS, DOKI_TERMINAL_SPOTS, ESCORT_ROUTE } from "../content/district-doki";
import { type ChunkDef, chunkAt } from "../content/world-map";
import { decorateTarget, planExtras, targetPresence, targetSpot, targetType } from "./contract-plan";
import type { Entity } from "./components";
import { type IdAllocator, contractGangerHp, escortEntity, gangerEntity, pickupEntity, sniperEntity, terminalEntity } from "./factory";
import type { Template } from "./stream-catalog";

/** Docks guards get tougher with experience, from their own type's health (ADR-0024). */
const docksGuardHp = (type: EnemyTypeId, completed: number): number => ENEMY_TYPES[type].hp + Math.min(40, completed * 5);

/** The site's chunk: the one holding its first spawn point, else the first chunk. */
const siteChunk = (contract: Contract, chunks: readonly ChunkDef[]): string => {
  const first = CONTRACT_SITE_SPAWNS[contract.siteId][0];
  return (first ? chunkAt(first.x, first.z, chunks) : null)?.id ?? chunks[0]?.id ?? "";
};

/** The contract's targets, one per index; ids are taken in index order. */
const targetTemplates = (ids: IdAllocator, chunk: string, completed: number, contract: Contract): Template[] => {
  const out: Template[] = [];
  const points = CONTRACT_SITE_SPAWNS[contract.siteId];
  const kind = contractKind(contract);
  // A protection wave is sent at Oyaji, an escort's ambush at the defector; everyone else holds the site.
  const victim = kind === "protect" ? PROTECTEE_KEY : kind === "escort" ? contractEscortKey(contract.id) : undefined;
  const posts = DOKI_CONTRACT_POSTS[contract.siteId];
  const tag = contractTag(contract.id);
  for (let i = 0; i < contract.targets; i++) {
    // The variation (ADR-0034) may move a target (the lookout, a swapped mark).
    const position = targetSpot(contract, i, points);
    if (!position) continue;
    const id = ids.take();
    const key = `${contract.id}-g${i}`;
    const post = posts?.[i % posts.length];
    if (post) {
      // A docks post (ADR-0024): its own facing and type; an alarm post waits for the alarm.
      // The extra guard of a lockdown stands at the site's lookout, not on a copy of a post.
      const spawn = { key, position: posts && i >= posts.length ? position : post.at, yaw: post.yaw };
      const hp = docksGuardHp(post.type, completed);
      const make = (): Entity => {
        if (post.type === "tessen_sniper") return sniperEntity(id, spawn, tag, hp, chunk);
        const g = gangerEntity(id, spawn, tag, hp, chunk, victim, post.type);
        // The hack's wave knows where Seki is; the office guards stand watch and look around.
        if (g.ai && kind === "hack") g.ai.alerted = true;
        if (g.ai && !post.onAlarm) g.ai = { ...g.ai, watch: { yaw: post.yaw, phase: i * 1.7 } };
        return decorateTarget(g, contract, i);
      };
      const when = targetPresence(contract, i, post.onAlarm ? { all: [contractAlarmFlag(contract.id)] } : undefined);
      out.push(when ? { id, chunk, key, make, when } : { id, chunk, key, make });
      continue;
    }
    // Face the way trouble comes from on this site (audit W11).
    const spawn = { key, position, yaw: contractSpawnYaw(contract.siteId, position) };
    // Every third ganger of a wave fights hand to hand (ADR-0019).
    const type = targetType(contract, i, i % 3 === 2 ? "hebi_brawler" : "hebi_ganger");
    const hp = type === "hebi_enforcer" ? ENEMY_TYPES.hebi_enforcer.hp : contractGangerHp(completed);
    const when = targetPresence(contract, i);
    const make = (): Entity => decorateTarget(gangerEntity(id, spawn, tag, hp, chunk, victim, type), contract, i);
    out.push(when ? { id, chunk, key, make, when } : { id, chunk, key, make });
  }
  return out;
};

/** The contract's objects: the crate or data to take, the defector to escort, the terminal to hack. */
const objectTemplates = (ids: IdAllocator, chunk: string, contract: Contract): Template[] => {
  const out: Template[] = [];
  const kind = contractKind(contract);
  const crate = kind === "retrieve" ? CONTRACT_ITEM_SPOTS[contract.siteId] : kind === "infiltrate" ? DOKI_ITEM_SPOTS[contract.siteId] : undefined;
  if (crate) {
    const id = ids.take();
    const key = contractItemKey(contract.id);
    out.push({ id, chunk, key, make: () => pickupEntity(id, key, crate, chunk, kind === "retrieve" ? "crate" : "data") });
  }
  if (kind === "escort") {
    const id = ids.take();
    const key = contractEscortKey(contract.id);
    out.push({ id, chunk, key, make: () => escortEntity(id, key, ESCORT_ROUTE, chunk) });
  }
  const terminal = kind === "hack" ? DOKI_TERMINAL_SPOTS[contract.siteId] : undefined;
  if (terminal) {
    const id = ids.take();
    const key = contractTerminalKey(contract.id);
    out.push({ id, chunk, key, make: () => terminalEntity(id, key, terminal, chunk) });
  }
  return out;
};

/** The variation's extras (ADR-0034); each may stand in a neighbouring chunk and spawns with it. */
const extraTemplates = (ids: IdAllocator, chunks: readonly ChunkDef[], chunk: string, completed: number, contract: Contract): Template[] => {
  const docks = DOKI_CONTRACT_POSTS[contract.siteId] !== undefined;
  const extra = {
    chunk,
    hp: docks ? docksGuardHp("tessen_guard", completed) : contractGangerHp(completed),
    type: docks ? "tessen_guard" : "hebi_ganger",
    yawAt: (p: Vec3) => contractSpawnYaw(contract.siteId, p),
  } as const;
  return planExtras(contract, extra).map((x) => {
    const id = ids.take();
    const at = chunkAt(x.at.x, x.at.z, chunks)?.id ?? chunk;
    return { id, chunk: at, key: x.key, make: () => x.make(id, at), ...(x.when ? { when: x.when } : {}) };
  });
};

/**
 * Templates of a newly accepted (or loaded) contract's people and objects. Ids are reserved in a
 * fixed order: the targets by index, then the objects, then the variation's extras.
 */
export const contractTemplates = (ids: IdAllocator, chunks: readonly ChunkDef[], completed: number, contract: Contract): Template[] => {
  const chunk = siteChunk(contract, chunks);
  const targets = targetTemplates(ids, chunk, completed, contract);
  const objects = objectTemplates(ids, chunk, contract);
  return [...targets, ...objects, ...extraTemplates(ids, chunks, chunk, completed, contract)];
};
