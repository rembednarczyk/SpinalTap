import {
  COMBAT_RADIUS,
  DISTRACT_RADIUS,
  type DomainState,
  type EntityId,
  FACTIONS,
  type HackTargetKind,
  PING_RADIUS,
  QUICKHACKS,
  type QuickhackId,
  SCAN_CONE,
  SCAN_RANGE,
  SHORT_CIRCUIT_DAMAGE,
  type Vec3,
  applyDamage,
  chainRadius,
  contractKind,
  directionFromAngles,
  factionStance,
  hackCost,
  hackDurationScale,
  hackInSlot,
  perkUploadScale,
  ramRegenScale,
  refundOf,
  regenRam,
  scanRangeScale,
  shortCircuitScale,
  uploadTimeScale,
  workingDeck,
} from "@seki/core";
import type { DeviceKind, Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { chestOf, eyeOf, lineOfSight } from "../world/hitscan";
import { inCreationOrder } from "../world/ordering";
import { grantQuickhackXp, ramMaxOf } from "../world/progression-ops";
import { securityKey } from "../world/reinforcements";
import { alertedNear, disturb, hackFxOf, isEngaged, noteDetected, noteHacked, noteViolence } from "../world/street";
import { scanning, worldTimeScale } from "./ability-system";
import { SEARCH_SECONDS, TRACK_GRACE, effectiveAggroRange, enemySees, giveLead } from "./ai/ganger-perception";
import { cameraSees } from "./crime-system";

/** Seconds a `short_circuit` knocks a device out. */
export const DEVICE_SHORT_SECONDS = 15;
/** The crowd hears a hack's bang this far. */
const HACK_NOISE = 8;
/** Seconds after an enemy's shot during which RAM does not come back. */
const COMBAT_THREAT_SECONDS = 3;

/** What a quickhack can do to this entity, or null when it cannot be scanned. */
export const hackTargetKind = (e: Entity): HackTargetKind | null => {
  if (e.device) return e.device.kind === "camera" ? "camera" : "device";
  if (e.body && e.health && (e.ai || e.sniper || e.civilian || e.escort)) return "person";
  return null;
};

const DEVICE_NAMES: Readonly<Record<DeviceKind, string>> = { camera: "scan.name.camera", vending: "scan.name.vending", speaker: "scan.name.speaker", neon: "scan.name.neon" };

/**
 * What the scanner calls it: the device, the fighter's side, or a passer-by. A key of the app's
 * catalogs (ADR-0056), except a fighter's side, which is the faction's name as core gives it.
 */
export const scanName = (e: Entity): string => {
  if (e.device) return DEVICE_NAMES[e.device.kind];
  if (e.ai || e.sniper) return e.faction ? FACTIONS[e.faction] : "scan.name.enemy";
  return "scan.name.passerBy";
};

/** Where the scanner looks at it: a device's centre, a person's chest. */
const scanPoint = (e: Entity): Vec3 => (e.device ? e.position : chestOf(e));

/**
 * The scanner's focus (ADR-0029): the scannable thing closest to the centre of the view, within
 * `SCAN_RANGE` (longer with Long Range, ADR-0059) and `SCAN_CONE`, in plain sight. Ties go to
 * the nearer one, then creation order.
 */
export const scanFocus = (ctx: SimContext, player: Entity): Entity | null => {
  const eye = eyeOf(player);
  const dir = directionFromAngles(player.yaw, player.pitch);
  let best: Entity | null = null;
  let bestAngle = Infinity;
  let bestDistance = Infinity;
  const range = SCAN_RANGE * scanRangeScale(ctx.state.domain.progression.perks);
  for (const e of inCreationOrder([...ctx.world.with("device"), ...ctx.world.with("body")])) {
    if (e === player || !hackTargetKind(e) || (e.health && e.health.current <= 0)) continue;
    const p = scanPoint(e);
    const dx = p.x - eye.x;
    const dy = p.y - eye.y;
    const dz = p.z - eye.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > range || distance < 1e-6) continue;
    const angle = Math.acos(Math.max(-1, Math.min(1, (dx * dir.x + dy * dir.y + dz * dir.z) / distance)));
    if (angle > SCAN_CONE || angle > bestAngle + 1e-9) continue;
    if (Math.abs(angle - bestAngle) <= 1e-9 && distance >= bestDistance) continue;
    if (!lineOfSight(ctx.world, eye, p)) continue;
    best = e;
    bestAngle = angle;
    bestDistance = distance;
  }
  return best;
};


/**
 * How the upload names its target in the save: the entity's key, a reinforcement's place in the
 * heat (`security:<n>`, G-194: unkeyed, its id changes on loading), else `#<id>`, good only for this session.
 */
const targetRef = (e: Entity): string => e.key ?? (e.security ? `security:${e.security.n}` : `#${e.id}`);

const SECURITY_REF = /^security:(\d+)$/;

/**
 * What a quickhack's XP remembers the target by, across saves (G-202): its key, or a
 * reinforcement's `n` with the tick it came in at, as `n` counts again from 1 in the next heat.
 * Nothing for the others, who are not remembered across a save.
 */
const xpKey = (e: Entity): string | undefined => e.key ?? (e.security ? securityKey(e.security) : undefined);

const findTarget = (ctx: SimContext, ref: string): Entity | null => {
  if (ref.startsWith("#")) {
    const id = Number(ref.slice(1));
    if (id !== ctx.session.watch.uploadId) return null;
    for (const e of ctx.world) if (e.id === id) return e;
    return null;
  }
  const security = SECURITY_REF.exec(ref);
  if (security) {
    const n = Number(security[1]);
    return ctx.world.with("security").entities.find((e) => e.security.n === n) ?? null;
  }
  for (const e of ctx.world) if (e.key === ref) return e;
  return null;
};

const setRam = (ctx: SimContext, ram: number): void => {
  const netrun = ctx.state.domain.netrun;
  if (netrun.ram === ram) return;
  ctx.state.domain = { ...ctx.state.domain, netrun: { ...netrun, ram } };
};

/** The whole number of RAM the HUD shows. */
export const wholeRam = (domain: DomainState): number => Math.floor(domain.netrun.ram + 1e-9);

/** RamChanged whenever the whole number of RAM changes (spending, refunds, regeneration). */
const reportRam = (ctx: SimContext): void => {
  const current = wholeRam(ctx.state.domain);
  if (ctx.session.watch.ram === current) return;
  const first = ctx.session.watch.ram === null;
  ctx.session.watch.ram = current;
  if (!first) ctx.bus.emit("RamChanged", { current, max: ramMaxOf(ctx.state.domain) });
};

/** The breached network's ICEpick (ADR-0029): hacks cost 1 RAM less while the hack job runs. */
const icepick = (ctx: SimContext): boolean => {
  const c = ctx.state.domain.contracts.active;
  return !!c && contractKind(c) === "hack" && (c.breach ?? []).includes("icepick");
};

/** Is the player fighting (RAM does not come back)? */
const inCombat = (ctx: SimContext, player: Entity): boolean => {
  const t = ctx.session.lastThreat;
  return (!!t && (ctx.tick - t.tick) * ctx.dt <= COMBAT_THREAT_SECONDS) || alertedNear(ctx, player, COMBAT_RADIUS);
};

/** Effects and device timers run down in world time (the overdrive and the scanner slow them too). */
const tickEffects = (ctx: SimContext): void => {
  const dt = ctx.dt * worldTimeScale(ctx);
  for (const e of ctx.world.with("hackFx")) {
    const fx = e.hackFx;
    fx.pinged = Math.max(0, fx.pinged - dt);
    fx.blind = Math.max(0, fx.blind - dt);
    fx.crippled = Math.max(0, fx.crippled - dt);
  }
  for (const e of ctx.world.with("device")) {
    e.device.noise = Math.max(0, e.device.noise - dt);
    e.device.broken = Math.max(0, e.device.broken - dt);
  }
};

/**
 * Enemies and cameras that see the player right now (the trace of an upload). An unalerted enemy
 * needs its cone (ADR-0069); the target of `reboot_optics` goes dark before it can look.
 */
const watchers = (ctx: SimContext, player: Entity, except: Entity | null): Entity[] => {
  const out: Entity[] = [];
  const reputation = ctx.state.domain.reputation;
  const heat = ctx.state.domain.heat;
  const chest = chestOf(player);
  for (const g of inCreationOrder(ctx.world.with("ai"))) {
    if (g === except || (g.hackFx?.blind ?? 0) > 0) continue;
    const stance = factionStance(reputation, g.faction ?? "hebi");
    if (stance === "friendly" && !(heat.level > 0 && heat.faction === g.faction)) continue;
    const distance = Math.hypot(player.position.x - g.position.x, player.position.z - g.position.z);
    const sight = effectiveAggroRange(g.ai.aggroRange, stance);
    if (distance > sight || !lineOfSight(ctx.world, eyeOf(g), chest)) continue;
    if (!enemySees(g, player, distance, true, sight)) continue;
    out.push(g);
  }
  for (const c of inCreationOrder(ctx.world.with("device"))) {
    if (c === except || c.device.kind !== "camera") continue;
    if (cameraSees(ctx, c, player)) out.push(c);
  }
  return out;
};

/** A point on the floor in front of a device, for the guards it draws. */
const leadAt = (device: Entity, floor: number): Vec3 => ({ x: device.position.x + Math.sin(device.yaw) * 1.2, y: floor, z: device.position.z + Math.cos(device.yaw) * 1.2 });

/** Ping: marks the target, everyone of its faction near it and every camera on its network. */
const ping = (ctx: SimContext, target: Entity, duration: number): void => {
  const faction = target.device?.faction ?? target.faction;
  const network = target.device?.network;
  for (const e of inCreationOrder([...ctx.world.with("ai"), ...ctx.world.with("sniper"), ...ctx.world.with("device")])) {
    const near = Math.hypot(e.position.x - target.position.x, e.position.z - target.position.z) <= PING_RADIUS && e.faction === faction;
    const wired = !!network && e.device?.network === network;
    if (e === target || near || wired) {
      if (e.device && e.device.kind !== "camera") continue;
      hackFxOf(ctx.world, e).pinged = duration;
    }
  }
  hackFxOf(ctx.world, target).pinged = duration;
};

/** Reboot Optics: the target goes blind and loses the player. */
const rebootOptics = (ctx: SimContext, target: Entity, duration: number): void => {
  hackFxOf(ctx.world, target).blind = duration;
  const ai = target.ai;
  if (ai) {
    // It loses the player: whatever it chases now is the last position it had.
    ai.suspicion = 0;
    if (ai.alerted) ai.lost = Math.max(ai.lost ?? 0, TRACK_GRACE + 1e-3);
  }
  if (target.device) target.device.spot = 0;
};

/** Distract: a noise at the target that draws the guards around it. */
const distract = (ctx: SimContext, target: Entity, duration: number): void => {
  if (target.device) target.device.noise = duration;
  for (const g of inCreationOrder(ctx.world.with("ai"))) {
    if (Math.hypot(g.position.x - target.position.x, g.position.z - target.position.z) <= DISTRACT_RADIUS) giveLead(g, leadAt(target, g.position.y));
  }
  disturb(ctx, "hack", target.position, DISTRACT_RADIUS, target.id);
};

/** Short Circuit: a device breaks for a while, a body takes damage. */
const shortCircuit = (ctx: SimContext, player: Entity, target: Entity): void => {
  if (target.device) {
    target.device.broken = DEVICE_SHORT_SECONDS;
    target.device.noise = 0;
    target.device.spot = 0;
  } else if (target.health) {
    const at = chestOf(target);
    noteViolence(ctx, target, isEngaged(target), at);
    // Overload (ADR-0059): more damage, in whole points.
    const damage = Math.round(SHORT_CIRCUIT_DAMAGE * shortCircuitScale(ctx.state.domain.progression.perks));
    target.health = applyDamage(target.health, damage);
    target.lastHitBy = player.id;
    target.lastHitStyle = "quickhack";
    const ai = target.ai;
    if (ai && !ai.alerted) {
      // Hurt by something it cannot see: it looks around where it stands (seeing the player alerts it).
      ai.lastKnown = { ...target.position };
      ai.search = SEARCH_SECONDS;
    }
    ctx.bus.emit("DamageDealt", { sourceId: player.id, targetId: target.id, amount: damage, critical: false, zone: "torso", at });
  }
  disturb(ctx, "hack", target.position, HACK_NOISE, target.id);
};

/**
 * Chain (ADR-0059): the nearest other target of the same kind within `radius` of the first, in
 * its plain sight, alive and not broken; ties go to creation order. Null when there is none.
 */
const chainTarget = (ctx: SimContext, player: Entity, first: Entity, radius: number): Entity | null => {
  const kind = hackTargetKind(first);
  const from = scanPoint(first);
  let best: Entity | null = null;
  let bestDistance = Infinity;
  for (const e of inCreationOrder([...ctx.world.with("device"), ...ctx.world.with("body")])) {
    if (e === first || e === player || hackTargetKind(e) !== kind || (e.health && e.health.current <= 0) || (e.device?.broken ?? 0) > 0) continue;
    const distance = Math.hypot(e.position.x - first.position.x, e.position.z - first.position.z);
    if (distance > radius || distance >= bestDistance || !lineOfSight(ctx.world, from, scanPoint(e))) continue;
    best = e;
    bestDistance = distance;
  }
  return best;
};

/** How long the hack's effect lasts: the table's, longer with Persistence (ADR-0059). */
const hackDuration = (ctx: SimContext, hackId: QuickhackId): number => QUICKHACKS[hackId].duration * hackDurationScale(ctx.state.domain.progression.perks);

/** What the hack does to the target. */
const applyEffect = (ctx: SimContext, player: Entity, hackId: QuickhackId, target: Entity): void => {
  const duration = hackDuration(ctx, hackId);
  switch (hackId) {
    case "ping":
      ping(ctx, target, duration);
      break;
    case "reboot_optics":
      rebootOptics(ctx, target, duration);
      break;
    case "distract":
      distract(ctx, target, duration);
      break;
    case "cripple_movement":
      hackFxOf(ctx.world, target).crippled = duration;
      break;
    case "short_circuit":
      shortCircuit(ctx, player, target);
      break;
  }
};

/**
 * The upload is through: the effect, and maybe the trace. With Chain (ADR-0059) the effect also
 * jumps to the next target of the kind nearby, with no trace and no XP of its own; its
 * QuickhackChained follows that target's QuickhackApplied, for the HUD's note.
 */
const apply = (ctx: SimContext, player: Entity, hackId: QuickhackId, target: Entity): void => {
  const seen = watchers(ctx, player, hackId === "reboot_optics" ? target : null);
  if (seen.length > 0) {
    // Traced (ADR-0028): the target's network knows where the player is.
    ctx.bus.emit("QuickhackTraced", { hackId, targetId: target.id });
    noteDetected(ctx);
    for (const w of seen) giveLead(w, player.position);
  }
  const duration = hackDuration(ctx, hackId);
  applyEffect(ctx, player, hackId, target);
  noteHacked(ctx);
  ctx.bus.emit("QuickhackApplied", { hackId, targetId: target.id, duration });
  const radius = chainRadius(ctx.state.domain.progression.perks);
  const next = radius > 0 ? chainTarget(ctx, player, target, radius) : null;
  if (next) {
    applyEffect(ctx, player, hackId, next);
    ctx.bus.emit("QuickhackApplied", { hackId, targetId: next.id, duration });
    ctx.bus.emit("QuickhackChained", { hackId, fromId: target.id, targetId: next.id });
  }
  grantQuickhackXp(ctx, target, xpKey(target));
};

/** Starts the n-th hack of the focused target's list (ADR-0028: RAM is paid at the start). */
const start = (ctx: SimContext, focus: Entity, slot: number): void => {
  const kind = hackTargetKind(focus);
  const hackId = kind ? hackInSlot(kind, slot) : null;
  if (!hackId) return;
  const netrun = ctx.state.domain.netrun;
  const fail = (reason: "no-ram" | "busy" | "wrong-target"): void => ctx.bus.emit("QuickhackFailed", { hackId, targetId: focus.id, reason });
  if (netrun.upload) return fail("busy");
  if ((focus.device?.broken ?? 0) > 0) return fail("wrong-target");
  const ram = hackCost(hackId, icepick(ctx));
  if (netrun.ram + 1e-9 < ram) return fail("no-ram");
  // Net, Fast Upload (ADR-0059) and a cyberdeck implant upload faster.
  const { progression } = ctx.state.domain;
  const upload = QUICKHACKS[hackId].upload * uploadTimeScale(progression.attributes) * perkUploadScale(progression.perks) * workingDeck(ctx.state.domain).uploadScale;
  ctx.state.domain = { ...ctx.state.domain, netrun: { ram: netrun.ram - ram, upload: { hackId, target: targetRef(focus), left: upload, ram } } };
  ctx.session.watch.uploadId = focus.id;
  ctx.bus.emit("QuickhackStarted", { hackId, targetId: focus.id, upload, ram });
};

/** Runs the upload: losing the focus cuts it off (half the RAM back), the end applies it. */
const runUpload = (ctx: SimContext, player: Entity, focus: Entity | null): void => {
  const netrun = ctx.state.domain.netrun;
  const upload = netrun.upload;
  if (!upload) return;
  const target = findTarget(ctx, upload.target);
  if (!target || target !== focus) {
    ctx.state.domain = { ...ctx.state.domain, netrun: { ram: Math.min(ramMaxOf(ctx.state.domain), netrun.ram + refundOf(upload)), upload: null } };
    ctx.bus.emit("QuickhackFailed", { hackId: upload.hackId, targetId: target?.id ?? focus?.id ?? player.id, reason: "lost-target" });
    return;
  }
  const left = upload.left - ctx.dt;
  if (left > 1e-9) {
    ctx.state.domain = { ...ctx.state.domain, netrun: { ...netrun, upload: { ...upload, left } } };
    return;
  }
  ctx.state.domain = { ...ctx.state.domain, netrun: { ...netrun, upload: null } };
  apply(ctx, player, upload.hackId, target);
};

/**
 * Scanner and quickhacks (ADR-0028, ADR-0029). Before the AI, so an effect counts in the same
 * step. Held `scan` slows the world (through `worldTimeScale`) and focuses the scannable thing
 * in the middle of the view; `quickhack` n starts the n-th hack of its list. The upload runs in
 * the player's time and needs the focus to stay; RAM comes back outside combat. No randomness:
 * the trace is a rule (someone hostile sees the player when the upload lands).
 */
export const scannerSystem: System = {
  name: "scanner",
  run(ctx) {
    tickEffects(ctx);
    const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
    const focus = player && scanning(ctx) ? scanFocus(ctx, player) : null;
    const focusId: EntityId | null = focus?.id ?? null;
    if (focusId !== ctx.session.watch.focus) {
      ctx.session.watch.focus = focusId;
      const kind = focus ? hackTargetKind(focus) : null;
      ctx.bus.emit("ScanFocusChanged", focus && kind ? { targetId: focus.id, kind, name: scanName(focus), faction: focus.device?.faction ?? focus.faction ?? null } : { targetId: null });
    }
    if (player) {
      runUpload(ctx, player, focus);
      if (focus && ctx.input.quickhack > 0) start(ctx, focus, ctx.input.quickhack);
      const netrun = ctx.state.domain.netrun;
      const max = ramMaxOf(ctx.state.domain);
      // Recycler (ADR-0059) and a cyberdeck implant bring it back faster.
      const regen = ramRegenScale(ctx.state.domain.progression.perks) * workingDeck(ctx.state.domain).regenScale;
      if (!netrun.upload && netrun.ram < max && !inCombat(ctx, player)) setRam(ctx, regenRam(netrun.ram, max, ctx.dt * regen));
    }
    reportRam(ctx);
  },
};
