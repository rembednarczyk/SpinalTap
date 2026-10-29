import { type EncounterDef, type EntityId, type Vec3, addStack, credit, encounterAvailable, hasFlag, markEncounter } from "@seki/core";
import { ENCOUNTER_REWARDS, type EncounterReward } from "../content/encounter-rewards";
import { ENCOUNTERS } from "../content/encounters";
import type { Entity } from "./components";
import type { SimContext } from "./context";
import { adjustReputation, raiseFlag } from "./domain-ops";

/**
 * Street encounters (ADR-0032, ADR-0034): a short ink scene starts when the player comes near
 * its point in its hours. The one who plays it stands there from a little further out (a world
 * character with that key, or a passer-by spawned for it). The start is written into the domain
 * log at once, so a scene never plays twice; the scene ends when its dialogue closes, with the
 * outcome flag the ink raised (`<knot>_<outcome>`) and what that outcome pays.
 */

/** The one who plays the scene is put there from this far out (metres beyond the radius). */
export const ENCOUNTER_SPAWN_MARGIN = 12;

const flat = (a: Vec3, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

/** A passer-by standing at a point: drawn, with a body, no AI (a scene, a mugging, an aid). */
export const passerBy = (ctx: SimContext, at: Vec3, yaw: number, hp: number, key?: string): Entity => {
  // On the ground there (the terrain of ADR-0043).
  const position = { x: at.x, y: ctx.streamer.ground.heightAt(at.x, at.z), z: at.z };
  const e: Entity = {
    id: ctx.streamer.takeId(),
    chunk: ctx.streamer.chunkIdAt(position),
    position,
    prevPosition: position,
    yaw,
    prevYaw: yaw,
    pitch: 0,
    body: { radius: 0.38, height: 1.8 },
    view: { kind: "npc", preset: "civilian" },
    faction: "civilians",
    velocity: { x: 0, y: 0, z: 0 },
    health: { current: hp, max: hp },
  };
  if (key) e.key = key;
  ctx.world.add(e);
  return e;
};

const actorOf = (ctx: SimContext, def: EncounterDef): EntityId | null => {
  if (def.npcKey) {
    const own = [...ctx.world].find((e) => e.key === def.npcKey);
    if (own) return own.id;
  }
  return ctx.session.street2.npcs[def.id] ?? null;
};

/** Puts the scene's character at its point once the player is close enough to see it. */
const stage = (ctx: SimContext, def: EncounterDef, player: Entity): void => {
  if (!def.npcKey || actorOf(ctx, def) !== null) return;
  if (flat(player.position, def.at) > def.radius + ENCOUNTER_SPAWN_MARGIN) return;
  const at = { x: def.at.x, y: ctx.streamer.ground.heightAt(def.at.x, def.at.z), z: def.at.z };
  const yaw = Math.atan2(player.position.x - at.x, player.position.z - at.z);
  ctx.session.street2.npcs = { ...ctx.session.street2.npcs, [def.id]: passerBy(ctx, at, yaw, 60).id };
};

/** Starts the scene: logged in the domain, the dialogue opens with its knot. */
const begin = (ctx: SimContext, def: EncounterDef): void => {
  const domain = ctx.state.domain;
  ctx.state.domain = { ...domain, encounters: markEncounter(domain.encounters, def, domain.clock) };
  ctx.session.street2.encounter = def.id;
  ctx.session.dialogueActive = true;
  ctx.session.focusId = null;
  ctx.session.focusPrompt = null;
  ctx.bus.emit("InteractionFocusChanged", { targetId: null, prompt: null });
  ctx.bus.emit("EncounterStarted", { encounterId: def.id, knot: def.knot, npcId: actorOf(ctx, def) });
};

/** The flag of the prologue's first talk with Kaito: the street has its stories from then on. */
export const STREET_OPEN_FLAG = "met_fixer";

/** Scenes start only after the prologue, without a running job and with no heat on the player. */
export const streetOpen = (ctx: SimContext): boolean => {
  const d = ctx.state.domain;
  return hasFlag(d.flags, STREET_OPEN_FLAG) && d.contracts.active === null && d.heat.level === 0;
};

/** One step of the street encounters of the player's district. */
export const runEncounters = (ctx: SimContext, player: Entity, district: string, defs: readonly EncounterDef[] = ENCOUNTERS): void => {
  if (ctx.session.street2.encounter !== null || ctx.session.dialogueActive || !streetOpen(ctx)) return;
  const { clock, encounters } = ctx.state.domain;
  for (const def of defs) {
    if (def.district !== district || !encounterAvailable(def, clock, encounters)) continue;
    stage(ctx, def, player);
    if (flat(player.position, def.at) <= def.radius) {
      begin(ctx, def);
      return;
    }
  }
};

/** Pays a reward: eddies (as they are), items into the bag as far as it fits. */
export const payReward = (ctx: SimContext, reward: EncounterReward): void => {
  if (reward.eddies) {
    const r = credit(ctx.state.domain.wallet, reward.eddies);
    if (r.ok) {
      ctx.state.domain = { ...ctx.state.domain, wallet: r.wallet };
      ctx.bus.emit("EddiesChanged", { balance: r.wallet.eddies, delta: reward.eddies });
    }
  }
  for (const { item, qty } of reward.items ?? []) {
    const d = ctx.state.domain;
    const r = addStack(d.inventory, d.equipment, item, qty);
    if (r.added <= 0) continue;
    ctx.state.domain = { ...d, inventory: r.inventory };
    ctx.bus.emit("ItemAdded", { ref: { stack: item }, defId: item, qty: r.added, source: "quest" });
  }
};

const paidFlag = (flag: string): string => `paid:${flag}`;

/** The dialogue of the running encounter closed: its outcome, its reward (once), the end event. */
export const endEncounter = (ctx: SimContext, defs: readonly EncounterDef[] = ENCOUNTERS): void => {
  const id = ctx.session.street2.encounter;
  if (id === null) return;
  ctx.session.street2.encounter = null;
  const def = defs.find((d) => d.id === id);
  const prefix = `${def?.knot ?? id}_`;
  const flag = ctx.state.domain.flags.find((f) => f.startsWith(prefix));
  const outcome = flag ? flag.slice(prefix.length) : "none";
  const reward = flag ? ENCOUNTER_REWARDS[flag] : undefined;
  if (flag && reward && !hasFlag(ctx.state.domain.flags, paidFlag(flag))) {
    raiseFlag(ctx, paidFlag(flag));
    payReward(ctx, reward);
  }
  ctx.bus.emit("EncounterEnded", { encounterId: id, outcome });
};

/** Standing with the street for a micro-event (ADR-0034). */
export const thankedByStreet = (ctx: SimContext, eddies: number, civilians: number): void => {
  payReward(ctx, { eddies });
  adjustReputation(ctx, "civilians", civilians);
};
