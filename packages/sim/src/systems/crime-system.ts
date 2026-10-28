import {
  type AwarenessState,
  CIVILIAN_SIGHT,
  type CrimeKind,
  ENEMY_TYPES,
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
import { gangerEntity } from "../world/factory";
import { chestOf, eyeOf, lineOfSight } from "../world/hitscan";
import { inCreationOrder } from "../world/ordering";
import { disturb, noteAlarm, noteDetected } from "../world/street";
import { worldTimeScale } from "./ability-system";
import { COWER_RADIUS, scare } from "./ai/civilian-ai-system";
import { effectiveAggroRange, giveLead, guardSees } from "./ai/ganger-ai-system";

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
/** Searchers spread around the last known position this far. */
const SEARCH_SPREAD = 4;

/** Whose security a place belongs to: Tessen's in the docks, Hebi's elsewhere (ADR-0028). */
export const securityAt = (ctx: SimContext, at: Vec3): FactionId => (ctx.streamer.districtAt(at) === "doki" ? "tessen" : "hebi");

/** Does this camera see the player right now (working, in its cone and range, nothing in between)? */
export const cameraSees = (ctx: SimContext, cam: Entity, player: Entity): boolean => {
  const d = cam.device;
  if (!d || d.kind !== "camera" || d.broken > 0 || (cam.hackFx?.blind ?? 0) > 0) return false;
  const chest = chestOf(player);
  if (Math.hypot(chest.x - cam.position.x, chest.y - cam.position.y, chest.z - cam.position.z) > CAMERA_RANGE) return false;
  if (Math.abs(angleTo({ x: cam.position.x, z: cam.position.z, yaw: cam.yaw }, chest.x, chest.z)) > CAMERA_CONE) return false;
  return lineOfSight(ctx.world, cam.position, chest);
};

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
const report = (ctx: SimContext, crime: CrimeKind, channel: WitnessChannel, witnessId: EntityId, offenderId: EntityId, at: Vec3): void => {
  ctx.bus.emit("CrimeReported", { crime, channel, witnessId, offenderId, at: { ...at } });
  const faction = securityAt(ctx, at);
  setHeat(ctx, reportCrime(ctx.state.domain.heat, crime, faction, at), true);
  noteAlarm(ctx);
  const hunting = ctx.state.domain.heat.faction;
  for (const g of inCreationOrder(ctx.world.with("ai"))) {
    if (g.faction === hunting && Math.hypot(g.position.x - at.x, g.position.z - at.z) <= REPORT_LEAD_RADIUS) giveLead(g, at);
  }
};

/** Cancels the other calls about an incident that has just been reported. */
const dropCalls = (ctx: SimContext, incident: number): void => {
  for (const c of ctx.world.with("civilian")) if (c.civilian.crowd?.call?.incident === incident) c.civilian.crowd.call = null;
};

/** How a bystander takes a disturbance: a close shot floors it, the rest makes it run or look. */
const react = (ctx: SimContext, d: StreetDisturbance): void => {
  for (const c of inCreationOrder(ctx.world.with("civilian"))) {
    if (c.id === d.sourceId || (c.health?.current ?? 1) <= 0) continue;
    const distance = Math.hypot(c.position.x - d.at.x, c.position.z - d.at.z);
    if (distance > d.radius) continue;
    if (d.kind === "gunshot") scare(ctx, c, distance <= COWER_RADIUS ? "cowering" : "fleeing", d.at);
    else if (d.kind === "hack" || (d.kind === "alarm" && distance > d.radius / 2)) scare(ctx, c, "alarmed", d.at);
    else scare(ctx, c, "fleeing", d.at);
  }
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
    return;
  }
  const security = securityAt(ctx, o.at);
  for (const g of inCreationOrder(ctx.world.with("ai"))) {
    // Someone already fighting the player does not phone it in: it fights.
    if (g.faction !== security || g.ai.alerted || !patrolSees(ctx, g, player)) continue;
    report(ctx, o.crime, "patrol", g.id, player.id, o.at);
    return;
  }
  for (const c of inCreationOrder(ctx.world.with("civilian"))) {
    const mind = c.civilian.crowd;
    if ((c.health?.current ?? 1) <= 0 || mind?.call || (mind?.scared ?? 0) > 0 || !civilianSees(ctx, c, player)) continue;
    scare(ctx, c, "fleeing", player.position);
    const m = c.civilian.crowd;
    if (!m) continue;
    m.call = { crime: o.crime, at: { ...o.at }, incident: o.incident, left: WITNESS_CALL_SECONDS };
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

/** Calls in progress: cut off by the player's aim, through after WITNESS_CALL_SECONDS. */
const runCalls = (ctx: SimContext, player: Entity | null, dt: number): void => {
  for (const c of inCreationOrder(ctx.world.with("civilian"))) {
    const mind = c.civilian.crowd;
    if (player && aimedAt(player, c)) {
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
  }
};

const zoneActive = (ctx: SimContext, zone: NonNullable<NonNullable<Entity["device"]>["restricted"]>): boolean => {
  if (!zone.during) return true;
  const c = ctx.state.domain.contracts.active;
  return c?.status === "active" && contractKind(c) === zone.during;
};

/** Cameras watching no-go zones (ADR-0029): the spot meter, the alarm, the guards sent to look. */
const runCameras = (ctx: SimContext, player: Entity | null, dt: number, aware: Map<EntityId, { state: AwarenessState; level: number }>): void => {
  for (const cam of inCreationOrder(ctx.world.with("device"))) {
    const d = cam.device;
    if (d.kind !== "camera") continue;
    d.cooldown = Math.max(0, d.cooldown - dt);
    const zone = d.restricted;
    const inside =
      !!player && !!zone && zoneActive(ctx, zone) && player.position.x >= zone.minX && player.position.x <= zone.maxX && player.position.z >= zone.minZ && player.position.z <= zone.maxZ;
    const sees = inside && !!player && cameraSees(ctx, cam, player);
    d.spot = Math.max(0, Math.min(1, d.spot + (sees ? dt / CAMERA_SPOT_SECONDS : -dt * 0.5)));
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

/** Does anyone of the hunting security see the player (contact)? */
const hunterContact = (ctx: SimContext, faction: FactionId, player: Entity): boolean => {
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

/** Where one searcher looks: around the last known position, spread by its id. */
const searchPoint = (heat: HeatState, e: Entity): Vec3 | null => {
  const at = heat.lastKnown;
  if (!at) return null;
  const a = e.id * 2.4;
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
    return;
  }
  // The searchers keep combing the area around the last known position.
  for (const e of live) {
    const p = searchPoint(heat, e);
    if (p && e.ai && !e.ai.alerted && !e.ai.lastKnown) giveLead(e, p);
  }
  const type = SECURITY_ENEMY[heat.faction];
  if (!player || !type || live.length >= HEAT_REINFORCEMENTS[heat.level] || watch.reinforce > 0) return;
  const at = entryFor(ctx, player, heat.lastKnown ?? player.position);
  if (!at) return;
  watch.reinforce = REINFORCE_INTERVAL;
  const g = gangerEntity(ctx.streamer.takeId(), { key: "", position: at, yaw: 0 }, null, ENEMY_TYPES[type].hp, "", undefined, type);
  delete g.key;
  g.security = true;
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
