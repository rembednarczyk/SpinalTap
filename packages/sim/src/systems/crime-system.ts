import {
  type AwarenessState,
  CIVILIAN_SIGHT,
  type CrimeKind,
  type EntityId,
  type FactionId,
  HEAT_REINFORCEMENTS,
  type HeatState,
  INTIMIDATED_SECONDS,
  INTIMIDATE_CONE,
  INTIMIDATE_RANGE,
  SECURITY_ENEMY,
  type Vec3,
  WITNESS_CALL_SECONDS,
  type WitnessChannel,
  angleTo,
  ZONE_ACCESS,
  contractKind,
  factionStance,
  heatContact,
  heatLost,
  reportCrime,
  tickHeat,
} from "@seki/core";
import { SECURITY_ENTRIES } from "../content/devices";
import type { Entity } from "../world/components";
import type { Offence, SimContext, StreetDisturbance, System } from "../world/context";
import { reinforcementEntity } from "../world/reinforcements";
import { chestOf, eyeOf, lineOfSight } from "../world/hitscan";
import { inCreationOrder } from "../world/ordering";
import { codeKnown } from "../world/hook-tracker";
import { disturb, noteAlarm, noteDetected } from "../world/street";
import { incapacitated } from "../world/takedown";
import { coveredFrom } from "../world/disguise";
import { difficultyOf } from "../world/difficulty";
import { worldTimeScale } from "./ability-system";
import { COWER_RADIUS, scare } from "./ai/civilian-ai-system";
import { effectiveAggroRange, giveLead, guardSees } from "./ai/ganger-perception";

/**
 * Cameras (ADR-0029): they see `CAMERA_RANGE` metres in a cone of `CAMERA_CONE` either side of
 * their facing. A crime in view is reported at once; the player in a watched no-go zone fills
 * the spot meter in `CAMERA_SPOT_SECONDS` and then raises the alarm, again after
 * `CAMERA_REPORT_COOLDOWN` if still there.
 */
export const CAMERA_RANGE = 16;
export const CAMERA_CONE = 0.6;
export const CAMERA_SPOT_SECONDS = 1;
export const CAMERA_REPORT_COOLDOWN = 10;
/** A camera's alarm is heard this far; the guards of its faction this close come to look. */
export const CAMERA_ALARM_RADIUS = 20;
/** The security of a reported crime's district this close to it comes to look. */
export const REPORT_LEAD_RADIUS = 50;
/**
 * Reinforcements (ADR-0029): one every `REINFORCE_INTERVAL` seconds until the heat's number is
 * there, at an entry between `SPAWN_MIN` and `SPAWN_MAX` metres from the player, never in view
 * (in front within `VIEW_HALF_ANGLE` with a clear line). With the heat gone they leave once out
 * of sight and at least `SPAWN_MIN` away.
 */
export const REINFORCE_INTERVAL = 4;
export const SPAWN_MIN = 12;
export const SPAWN_MAX = 60;
export const VIEW_HALF_ANGLE = 1.2;
/** With no entry out of sight, the next look for one waits this long (seconds). */
const ENTRY_RETRY = 1;
/** Searchers spread around the last known position this far. */
const SEARCH_SPREAD = 4;

/** Whose security a place belongs to: Tessen's in the docks, Hebi's elsewhere (ADR-0028). */
export const securityAt = (ctx: SimContext, at: Vec3): FactionId => (ctx.streamer.districtAt(at) === "doki" ? "tessen" : "hebi");

/** Does this camera see the point right now (working, in its cone and range, nothing in between)? */
export const cameraSeesPoint = (ctx: SimContext, cam: Entity, p: Vec3): boolean => {
  const d = cam.device;
  if (!d || d.kind !== "camera" || d.broken > 0 || (cam.hackFx?.blind ?? 0) > 0) return false;
  if (Math.hypot(p.x - cam.position.x, p.y - cam.position.y, p.z - cam.position.z) > CAMERA_RANGE) return false;
  if (Math.abs(angleTo({ x: cam.position.x, z: cam.position.z, yaw: cam.yaw }, p.x, p.z)) > CAMERA_CONE) return false;
  return lineOfSight(ctx.world, cam.position, p);
};

/** Does this camera see the player right now? */
export const cameraSees = (ctx: SimContext, cam: Entity, player: Entity): boolean => cameraSeesPoint(ctx, cam, chestOf(player));

/** Is the point in front of the player and in plain sight (where the camera of the game looks)? */
export const inPlayerView = (ctx: SimContext, player: Entity, p: Vec3): boolean => {
  if (Math.abs(angleTo({ x: player.position.x, z: player.position.z, yaw: player.yaw }, p.x, p.z)) > VIEW_HALF_ANGLE) return false;
  return lineOfSight(ctx.world, eyeOf(player), { x: p.x, y: p.y + 1.25, z: p.z });
};

/** Does a civilian see the player (all round, close enough, nothing solid in between)? */
const civilianSees = (ctx: SimContext, c: Entity, player: Entity): boolean =>
  Math.hypot(player.position.x - c.position.x, player.position.z - c.position.z) <= CIVILIAN_SIGHT && lineOfSight(ctx.world, eyeOf(c), chestOf(player));

/** Does a member of the security see the player (its sight range, its cone for a guard)? */
const patrolSees = (ctx: SimContext, g: Entity, player: Entity): boolean => {
  if (!g.ai || (g.hackFx?.blind ?? 0) > 0) return false;
  const stance = factionStance(ctx.state.domain.reputation, g.faction ?? "hebi");
  const sight = effectiveAggroRange(g.ai.aggroRange, stance);
  const distance = Math.hypot(player.position.x - g.position.x, player.position.z - g.position.z);
  if (distance > sight || !lineOfSight(ctx.world, eyeOf(g), chestOf(player))) return false;
  return !g.ai.cone || guardSees(g, player, distance, true, sight);
};

const setHeat = (ctx: SimContext, heat: HeatState, force = false): void => {
  const before = ctx.state.domain.heat;
  if (heat === before && !force) return;
  ctx.state.domain = { ...ctx.state.domain, heat };
  if (force || heat.level !== before.level || heat.searching !== before.searching) {
    ctx.bus.emit("HeatChanged", {
      level: heat.level,
      previous: before.level,
      searching: heat.searching,
      lastKnown: heat.lastKnown ? { ...heat.lastKnown } : null,
      searchLeft: heat.searchLeft,
      ...(heat.faction ? { faction: heat.faction } : {}),
    });
  }
};

/** A crime reached the security: CrimeReported, the heat, and its people nearby go to look. */
export const report = (ctx: SimContext, crime: CrimeKind, channel: WitnessChannel, witnessId: EntityId, offenderId: EntityId, at: Vec3): void => {
  ctx.bus.emit("CrimeReported", { crime, channel, witnessId, offenderId, at: { ...at } });
  const faction = securityAt(ctx, at);
  setHeat(ctx, reportCrime(ctx.state.domain.heat, crime, faction, at), true);
  noteAlarm(ctx);
  const hunting = ctx.state.domain.heat.faction;
  if (hunting) sendSecurity(ctx, hunting, at);
};

/** The security of `faction` within `REPORT_LEAD_RADIUS` of `at` goes to look there. */
export const sendSecurity = (ctx: SimContext, faction: FactionId, at: Vec3): void => {
  for (const g of inCreationOrder(ctx.world.with("ai"))) {
    if (g.faction === faction && Math.hypot(g.position.x - at.x, g.position.z - at.z) <= REPORT_LEAD_RADIUS) giveLead(g, at);
  }
};

/** The takedown of someone knocked out has reached the security (ADR-0065): its body brings no second call. */
const bodyReported = (ctx: SimContext, body: EntityId | undefined): void => {
  if (body === undefined) return;
  for (const b of ctx.world.with("downed")) if (b.id === body) b.downed.reported = true;
};

/** The body was reported by whoever found it (ADR-0065): the calls about its takedown are not needed. */
export const dropBodyCalls = (ctx: SimContext, body: EntityId): void => {
  for (const c of ctx.world.with("civilian")) if (c.civilian.crowd?.call?.body === body) c.civilian.crowd.call = null;
};

/** Cancels the other calls about an incident that has just been reported. */
const dropCalls = (ctx: SimContext, incident: number): void => {
  for (const c of ctx.world.with("civilian")) if (c.civilian.crowd?.call?.incident === incident) c.civilian.crowd.call = null;
};

/** How a bystander takes a disturbance: a close shot floors it, the rest makes it run or look. */
const react = (ctx: SimContext, d: StreetDisturbance): void => {
  // Someone stopped by a body to wake it (ADR-0065) is not scared off by the sight of it.
  const helper = d.kind === "body" ? ctx.world.with("downed").entities.find((b) => b.id === d.sourceId)?.downed.finder : undefined;
  for (const c of inCreationOrder(ctx.world.with("civilian"))) {
    if (c.id === d.sourceId || c.id === helper || (c.health?.current ?? 1) <= 0) continue;
    const distance = Math.hypot(c.position.x - d.at.x, c.position.z - d.at.z);
    if (distance > d.radius) continue;
    if (d.kind === "gunshot") scare(ctx, c, distance <= COWER_RADIUS ? "cowering" : "fleeing", d.at);
    else if (d.kind === "hack" || (d.kind === "alarm" && distance > d.radius / 2)) scare(ctx, c, "alarmed", d.at);
    else scare(ctx, c, "fleeing", d.at);
  }
};

/** A patrol of the security of the crime's place that saw the player commit it and phones it in. */
const patrolWitness = (ctx: SimContext, g: Entity, player: Entity, security: FactionId): boolean =>
  // Someone already fighting the player does not phone it in: it fights. Nor does one knocked out or dead.
  g.faction === security && !!g.ai && !g.ai.alerted && !g.unconscious && (g.health?.current ?? 1) > 0 && patrolSees(ctx, g, player);

/** A civilian that saw the player commit it and starts a call. */
const civilianWitness = (ctx: SimContext, c: Entity, player: Entity): boolean => {
  const mind = c.civilian?.crowd;
  // Background passers-by (ADR-0040) run like anyone but never phone it in: they are not saved.
  return !c.passerby && !c.unconscious && (c.health?.current ?? 1) > 0 && !mind?.call && (mind?.scared ?? 0) <= 0 && civilianSees(ctx, c, player);
};

/**
 * Would a crime the player commits now at `at` have a witness (ADR-0029): a camera, a patrol of
 * the place's security or a civilian who would phone it in. The rule `witness` applies at the
 * end of the step, for the takedown's `witnessed` (ADR-0065).
 */
export const seenCommitting = (ctx: SimContext, player: Entity, at: Vec3): boolean => {
  for (const cam of ctx.world.with("device")) if (cameraSees(ctx, cam, player)) return true;
  const security = securityAt(ctx, at);
  for (const g of ctx.world.with("ai")) if (patrolWitness(ctx, g, player, security)) return true;
  for (const c of ctx.world.with("civilian")) if (civilianWitness(ctx, c, player)) return true;
  return false;
};

/**
 * Who saw the player commit it: a camera or a patrol reports at once; otherwise every civilian
 * who saw it starts a call (the first through makes the report).
 */
const witness = (ctx: SimContext, o: Offence, player: Entity): void => {
  for (const cam of inCreationOrder(ctx.world.with("device"))) {
    if (!cameraSees(ctx, cam, player)) continue;
    noteDetected(ctx);
    report(ctx, o.crime, "camera", cam.id, player.id, o.at);
    bodyReported(ctx, o.body);
    return;
  }
  const security = securityAt(ctx, o.at);
  for (const g of inCreationOrder(ctx.world.with("ai"))) {
    if (!patrolWitness(ctx, g, player, security)) continue;
    report(ctx, o.crime, "patrol", g.id, player.id, o.at);
    bodyReported(ctx, o.body);
    return;
  }
  for (const c of inCreationOrder(ctx.world.with("civilian"))) {
    if (!civilianWitness(ctx, c, player)) continue;
    scare(ctx, c, "fleeing", player.position);
    const m = c.civilian.crowd;
    if (!m) continue;
    m.call = { crime: o.crime, at: { ...o.at }, incident: o.incident, left: WITNESS_CALL_SECONDS, ...(o.body === undefined ? {} : { body: o.body }) };
    ctx.bus.emit("WitnessCalling", { witnessId: c.id, crime: o.crime, duration: WITNESS_CALL_SECONDS });
  }
};

/** The player aims a drawn weapon at a civilian from close by: it drops the phone and cowers. */
const aimedAt = (player: Entity, c: Entity): boolean => {
  const w = player.combatant;
  if (!w || !w.weapon || w.holstered) return false;
  if (Math.hypot(c.position.x - player.position.x, c.position.z - player.position.z) > INTIMIDATE_RANGE) return false;
  return Math.abs(angleTo({ x: player.position.x, z: player.position.z, yaw: player.yaw }, c.position.x, c.position.z)) <= INTIMIDATE_CONE;
};

/** Calls in progress: cut off by the player's aim or a knock-out, through after WITNESS_CALL_SECONDS. */
const runCalls = (ctx: SimContext, player: Entity | null, dt: number): void => {
  for (const c of inCreationOrder(ctx.world.with("civilian"))) {
    const mind = c.civilian.crowd;
    // Knocked out mid-call (ADR-0065): the phone goes quiet. Held in a takedown it waits on how
    // the hold ends: out cold it is cut off, broken free it carries on (G-141).
    if (incapacitated(ctx, c)) {
      if (c.unconscious && mind?.call) mind.call = null;
      continue;
    }
    // Only someone already shaken (a call, a scare) is scared off the phone: a calm passer-by walks on.
    if (player && mind && (mind.call || mind.state !== "calm") && aimedAt(player, c)) {
      scare(ctx, c, "cowering", player.position);
      const m = c.civilian.crowd;
      if (m) {
        m.call = null;
        m.scared = INTIMIDATED_SECONDS;
      }
      continue;
    }
    const call = mind?.call;
    if (!call) continue;
    call.left -= dt;
    if (call.left > 0) continue;
    dropCalls(ctx, call.incident);
    report(ctx, call.crime, "civilian", c.id, player?.id ?? 0, call.at);
    bodyReported(ctx, call.body);
  }
};

const zoneActive = (ctx: SimContext, zone: NonNullable<NonNullable<Entity["device"]>["restricted"]>): boolean => {
  if (!zone.during) return true;
  const c = ctx.state.domain.contracts.active;
  // A door code from an observation hook (ADR-0034): the camera takes the player for staff.
  return c?.status === "active" && contractKind(c) === zone.during && !codeKnown(ctx);
};

/** Cameras watching no-go zones (ADR-0029): the spot meter, the alarm, the guards sent to look. */
const runCameras = (ctx: SimContext, player: Entity | null, dt: number, aware: Map<EntityId, { state: AwarenessState; level: number }>): void => {
  for (const cam of inCreationOrder(ctx.world.with("device"))) {
    const d = cam.device;
    if (d.kind !== "camera") continue;
    d.cooldown = Math.max(0, d.cooldown - dt);
    const zone = d.restricted;
    // The office staff's overalls belong in the office (ADR-0033): the camera takes her for staff.
    const inside =
      !!player &&
      !!zone &&
      zoneActive(ctx, zone) &&
      !staffPass(ctx, d.faction) &&
      player.position.x >= zone.minX &&
      player.position.x <= zone.maxX &&
      player.position.z >= zone.minZ &&
      player.position.z <= zone.maxZ;
    const sees = inside && !!player && cameraSees(ctx, cam, player);
    // The spot meter fills at the difficulty's pace (`awareness`, ADR-0066); it drains as ever.
    d.spot = Math.max(0, Math.min(1, d.spot + (sees ? (dt / CAMERA_SPOT_SECONDS) * difficultyOf(ctx).awareness : -dt * 0.5)));
    if (player && sees && d.spot >= 1 && d.cooldown === 0) {
      d.cooldown = CAMERA_REPORT_COOLDOWN;
      noteDetected(ctx);
      disturb(ctx, "alarm", cam.position, CAMERA_ALARM_RADIUS, cam.id);
      report(ctx, "trespass", "camera", cam.id, player.id, player.position);
      for (const g of inCreationOrder(ctx.world.with("ai"))) {
        if (g.faction === d.faction && Math.hypot(g.position.x - cam.position.x, g.position.z - cam.position.z) <= CAMERA_ALARM_RADIUS) giveLead(g, player.position);
      }
    }
    const state: AwarenessState = d.spot >= 1 ? "alerted" : d.spot > 0 ? "suspicious" : "unaware";
    const last = aware.get(cam.id) ?? { state: "unaware", level: 0 };
    if (state !== last.state || Math.abs(d.spot - last.level) >= 0.25) {
      aware.set(cam.id, { state, level: d.spot });
      ctx.bus.emit("AwarenessChanged", { observerId: cam.id, state, level: d.spot, lastKnown: sees && player ? { ...player.position } : null });
    }
  }
};

/** A disguise of the camera's faction whose role belongs in its no-go zones (ADR-0033). */
export const staffPass = (ctx: SimContext, faction: FactionId): boolean => {
  const role = ctx.state.domain.disguise.role;
  return role !== null && ZONE_ACCESS[role] && coveredFrom(ctx, faction);
};

/** Does anyone of the hunting security see the player (contact)? Not while her disguise holds against them (ADR-0033). */
const hunterContact = (ctx: SimContext, faction: FactionId, player: Entity): boolean => {
  if (coveredFrom(ctx, faction)) return false;
  for (const g of ctx.world.with("ai")) if (g.faction === faction && g.ai.sees) return true;
  for (const cam of ctx.world.with("device")) if (cam.device.faction === faction && cameraSees(ctx, cam, player)) return true;
  return false;
};

/** An entry out of the player's sight, nearest to where the search is (ties: table order). */
const entryFor = (ctx: SimContext, player: Entity, near: Vec3): Vec3 | null => {
  let best: Vec3 | null = null;
  let bestD = Infinity;
  for (const p of SECURITY_ENTRIES) {
    if (!ctx.streamer.isLoaded(ctx.streamer.chunkIdAt(p))) continue;
    const d = Math.hypot(p.x - player.position.x, p.z - player.position.z);
    if (d < SPAWN_MIN || d > SPAWN_MAX || inPlayerView(ctx, player, p)) continue;
    const toSearch = Math.hypot(p.x - near.x, p.z - near.z);
    if (toSearch < bestD) {
      best = p;
      bestD = toSearch;
    }
  }
  return best;
};

/** Where one searcher looks: around the last known position, spread by which of the heat's it is (G-179). */
const searchPoint = (heat: HeatState, n: number): Vec3 | null => {
  const at = heat.lastKnown;
  if (!at) return null;
  const a = n * 2.4;
  return { x: at.x + Math.sin(a) * SEARCH_SPREAD, y: at.y, z: at.z + Math.cos(a) * SEARCH_SPREAD };
};

/** The heat's reinforcements: brought in out of sight while the heat is up, sent home after. */
const runReinforcements = (ctx: SimContext, player: Entity | null, dt: number): void => {
  const heat = ctx.state.domain.heat;
  const live = [...inCreationOrder(ctx.world.with("security"))];
  const watch = ctx.session.watch;
  watch.reinforce = Math.max(0, watch.reinforce - dt);
  if (heat.level === 0 || !heat.faction) {
    for (const e of live) {
      const far = !player || Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) >= SPAWN_MIN;
      if (!e.ai?.alerted && far && (!player || !inPlayerView(ctx, player, e.position))) ctx.world.remove(e);
    }
    // All gone home: the next heat counts its own from 1 (G-179).
    if (ctx.world.with("security").entities.length === 0) watch.sent = 0;
    return;
  }
  // The searchers keep combing the area around the last known position.
  for (const e of live) {
    const p = searchPoint(heat, e.security.n);
    if (p && e.ai && !e.ai.alerted && !e.ai.lastKnown) giveLead(e, p);
  }
  const type = SECURITY_ENEMY[heat.faction];
  if (!player || !type || live.length >= HEAT_REINFORCEMENTS[heat.level] || watch.reinforce > 0) return;
  const at = entryFor(ctx, player, heat.lastKnown ?? player.position);
  // No entry out of sight right now: look again in a second, not every step.
  if (!at) {
    watch.reinforce = ENTRY_RETRY;
    return;
  }
  // The difficulty brings them in more or less often (`reinforce`, ADR-0066).
  watch.reinforce = REINFORCE_INTERVAL / difficultyOf(ctx).reinforce;
  watch.sent += 1;
  const g = reinforcementEntity(ctx.streamer.takeId(), watch.sent, type, at, difficultyOf(ctx).npcHealth);
  if (g.ai) g.ai.lastKnown = heat.lastKnown ? { ...heat.lastKnown } : { ...player.position };
  ctx.world.add(g);
};

/**
 * The street at the end of the step (ADR-0028, ADR-0029): the crowd takes the step's noise,
 * the player's crimes find their witnesses (camera and patrol at once, civilians after a call),
 * cameras watch their no-go zones, and the heat follows contact: search, drop, reinforcements.
 * After the death system, so a kill and its witnesses share a step. No randomness.
 */
export const createCrimeSystem = (): System => {
  const aware = new Map<EntityId, { state: AwarenessState; level: number }>();
  return {
    name: "crime",
    run(ctx) {
      const street = ctx.session.street;
      const disturbances = street.disturbances.splice(0);
      const offences = street.offences.splice(0);
      const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
      const dt = ctx.dt * worldTimeScale(ctx);
      for (const d of disturbances) react(ctx, d);
      if (player) for (const o of offences) witness(ctx, o, player);
      runCalls(ctx, player, dt);
      runCameras(ctx, player, dt, aware);
      let heat = tickHeat(ctx.state.domain.heat, ctx.dt);
      if (heat.level > 0 && heat.faction && player) heat = hunterContact(ctx, heat.faction, player) ? heatContact(heat, player.position) : heatLost(heat);
      setHeat(ctx, heat);
      runReinforcements(ctx, player, ctx.dt);
      const cameras = new Set(ctx.world.with("device").entities.map((e) => e.id));
      for (const id of [...aware.keys()]) if (!cameras.has(id)) aware.delete(id);
    },
  };
};
