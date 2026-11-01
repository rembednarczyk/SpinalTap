import { type EntityId, type EventBus, type DomainEvents, type Vec3, terrainHeightAt } from "@seki/core";
import { surfaceLiftAt } from "../content/lublin/roads";
import { TRAFFIC_RANGE, TRAFFIC_ROUTES, TURN_SPEED, type TrafficRoute } from "../content/traffic";
import { pointsAlong } from "../content/traffic-lane";
import type { Entity, VehicleState } from "../world/components";
import type { SimContext, System } from "../world/context";
import { VEHICLE_IDS_PER_ROUTE, halfSize, lanePose, timetable, vehicleCount, vehicleId, vehiclePlan } from "../world/traffic";
import { inPlayerView } from "./crime-system";

type Vehicle = Entity & { vehicle: VehicleState; velocity: Vec3 };

/** Steps between looks at which vehicles come and go (a look may cast a ray per vehicle). */
const LOOK_STEPS = 10;
/** Braking and accelerating (m/s²); how hard a vehicle closes on its timetable (1/s). */
const BRAKE = 6;
const ACCEL = 2.5;
const GAIN = 0.5;
/** A vehicle slows to `TURN_SPEED` this far before a turn round (m): enough to brake from a main road's speed. */
const TURN_BRAKE = 12;
/** Most a vehicle drives over its lane's speed to catch up with its timetable. */
const HURRY = 1.3;
/** A body's radius and the margin a vehicle keeps beside it (m). */
const BODY = 0.38;
const SIDE_MARGIN = 0.35;
/** Gap a vehicle leaves before someone in its way, and before the vehicle ahead (m). */
const STOP_GAP = 1.2;
const FOLLOW_GAP = 2.2;
/** A shot this close frightens a vehicle (m): it stops dead or speeds off for a few seconds. */
const PANIC_RADIUS = 45;
const PANIC_SECONDS = { stop: 5, flee: 6 } as const;
const FLEE = 1.7;
/** The player keeping a vehicle stopped: the horn after this long and again every so often, then a way round (s). */
const HORN_AFTER = 1;
const HORN_EVERY = 3.5;
const PASS_AFTER = 2.5;
/** Room a vehicle leaves the player's body going round them (m). */
const PASS_ROOM = 0.5;
/** Furthest a vehicle steps aside to pass the player, and how fast (m, m/s). */
const MAX_ASIDE = 2.8;
const ASIDE_RATE = 1.2;
const BACK_RATE = 0.6;
/** A vehicle this far off its timetable jumps back onto it, out of sight (m). */
const RESYNC = 40;
/** Within this share of the radius nobody comes or goes in plain view of the player. */
const SEEN_SHARE = 0.6;
/** Across another lane's vehicle, a vehicle appears this far past its side at the least (m): on a parallel lane, not on its line. */
const SPAWN_BESIDE = 1.1;
/** How far along both ways a vehicle appearing beside another looks for them closing in (m). */
const APPEAR_AHEAD = 12;

/** Distance from a point to a lane's bounding box (the quick reject before looking at a lane's vehicles). */
const boxes = TRAFFIC_ROUTES.map((r) => {
  const xs = r.points.map((p) => p[0]);
  const zs = r.points.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
});
const boxDistance = (i: number, x: number, z: number): number => {
  const b = boxes[i]!;
  return Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ));
};

/** Integer hash of an id and a tick, for a reaction the shot does not draw from the shared randomness. */
const coin = (id: EntityId, tick: number): boolean => ((Math.imul(id, 2654435761) ^ Math.imul(tick + 1, 40503)) >>> 7) % 2 === 0;

const flat = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Height a vehicle drives at over (x, z): the ground and the lift of the carriageway the renderer
 * draws there (`SURFACE_LIFT`, G-130), on a bridge that of its deck's paving.
 */
const roadY = (ctx: SimContext, x: number, z: number): number => {
  const g = ctx.streamer.ground;
  const y = g.heightAt(x, z);
  const grid = g.gridAt(x, z);
  return y + surfaceLiftAt(x, z, grid !== null && y !== terrainHeightAt(grid, x, z));
};

/** A vehicle on its lane at arc length `s`, at the clock's time: unkeyed, unsaved, bodiless (it drives itself). */
const vehicleEntity = (ctx: SimContext, route: number, index: number, s: number): Vehicle => {
  const plan = vehiclePlan(ctx.seed, route, index);
  const lane = TRAFFIC_ROUTES[route]!;
  const pose = lanePose(lane, s);
  const at = { x: pose.x, y: roadY(ctx, pose.x, pose.z), z: pose.z };
  return {
    id: vehicleId(route, index),
    position: at,
    prevPosition: at,
    yaw: pose.yaw,
    prevYaw: pose.yaw,
    pitch: 0,
    view: { kind: "vehicle", model: plan.model, tint: plan.tint },
    velocity: { x: pose.tx * plan.speed, y: 0, z: pose.tz * plan.speed },
    vehicle: { route, index, half: halfSize(plan.model), s, v: plan.speed, aside: 0, blocked: 0, horn: 0, panic: null },
  };
};

interface Ahead {
  /** Fastest it may drive to stop in time (m/s). */
  allowed: number;
  /** The player is what holds it up, this far to its right (m). */
  player: number | null;
  /** The player is beside its way, within the room it passes them by, this far to its right (m). */
  beside: number | null;
}

/** Margin round a crossing vehicle's body the one giving way keeps (m). */
const CROSS_MARGIN = 0.5;
/** Vehicles heading apart by more than this (its cosine) cross or merge: they take turns, not follow. */
const MERGE_COS = 0.7;
/** How far ahead both look for a crossing (m): far enough to stop from a hurried drive. */
const CROSS_LOOK = 25;

/**
 * Turns at a crossing: where the two vehicles' lines meet ahead of `self`, the one nearer the
 * meeting point goes first (the lower id on a tie) and the other stops short of it; a vehicle
 * already over the crossing always goes on and clears it, so two never wait for each other.
 * Lowers `out.allowed` when `self` has to give way.
 */
const yieldAtCrossing = (self: Vehicle, o: Vehicle, pose: { x: number; z: number; tx: number; tz: number }, ox: number, oz: number, out: Ahead): void => {
  const st = self.vehicle;
  const det = ox * pose.tz - pose.tx * oz;
  if (Math.abs(det) < 1e-3) return;
  const dx = o.position.x - pose.x;
  const dz = o.position.z - pose.z;
  // Distances along each one's heading to where the lines meet.
  const mine = (ox * dz - dx * oz) / det;
  const theirs = (pose.tx * dz - pose.tz * dx) / det;
  const clear = o.vehicle.half.l + st.half.w + CROSS_MARGIN;
  if (mine - st.half.l < CROSS_MARGIN || mine > CROSS_LOOK) return;
  if (theirs < -clear || theirs > CROSS_LOOK) return;
  const onIt = Math.abs(theirs) < clear;
  const first = theirs < mine - CROSS_MARGIN || (Math.abs(theirs - mine) <= CROSS_MARGIN && o.id < self.id);
  if (!onIt && !first) return;
  const gap = mine - st.half.l - o.vehicle.half.w - CROSS_MARGIN;
  const allowed = gap <= STOP_GAP ? 0 : Math.sqrt(2 * BRAKE * (gap - STOP_GAP));
  if (allowed < out.allowed) {
    out.allowed = allowed;
    out.player = null;
  }
};

/** Points every `WAY_STEP` along a vehicle's own route, from `from` to `to` metres ahead of it. */
const wayAhead = (v: Vehicle, to: number, from = 0): { x: number; z: number }[] => {
  const lane = TRAFFIC_ROUTES[v.vehicle.route]!;
  return pointsAlong(lane.points, v.vehicle.s + from, Math.min(lane.length, v.vehicle.s + to), WAY_STEP, v.vehicle.aside);
};

/**
 * Do two vehicles' ways ahead come within `gap` of each other? The crossing rule reads both ways
 * as straight lines; on a junction's arc (ADR-0055) a stopped vehicle on the lane beside the one
 * being turned into lies across that line, but not across the way.
 */
const waysMeet = (a: readonly { x: number; z: number }[], b: readonly { x: number; z: number }[], gap: number): boolean => a.some((p) => b.some((q) => flat(p, q) < gap));

/** Steps along a vehicle's own route at which `onItsWay` looks for another's body (m). */
const WAY_STEP = 1;
/** How far ahead of another vehicle going its way `onItsWay` reads where it drives next (m). */
const MERGE_AHEAD = 6;
/** Room left beside a body on the way ahead (m): two lanes of a narrow roundabout run 2.6 m apart, and squeeze closer at its corners. */
const WAY_MARGIN = 0.25;

/**
 * Another vehicle's body on the way ahead along `self`'s route, not along a straight line: round
 * a bend or a junction's arc (ADR-0055) one ahead stands off to the side of the heading, and two
 * lanes merging at a shallow angle never cross the straight lines ahead. Of two that each stand on
 * the other's way, the one further behind gives way (the lower id on a tie), so they never wait for
 * each other.
 */
const onItsWay = (self: Vehicle, o: Vehicle, wayOf: () => readonly { x: number; z: number }[], reach: number, out: Ahead): void => {
  const st = self.vehicle;
  const near = reach + o.vehicle.half.l + st.half.w;
  const dx = o.position.x - self.position.x;
  const dz = o.position.z - self.position.z;
  if (Math.abs(dx) > near || Math.abs(dz) > near || dx * dx + dz * dz > near * near) return;
  const tx = Math.sin(self.yaw);
  const tz = Math.cos(self.yaw);
  const itAhead = dx * tx + dz * tz;
  if (itAhead <= 0) return;
  const ox = Math.sin(o.yaw);
  const oz = Math.cos(o.yaw);
  const meAhead = -dx * ox - dz * oz;
  if (itAhead <= 0 || meAhead > itAhead || (meAhead === itAhead && self.id < o.id)) return;
  const width = st.half.w + o.vehicle.half.w + WAY_MARGIN;
  const way = wayOf();
  // Going its way, where it is and where it drives next: two ways closing in at a shallow angle (a
  // lane shifting across into the one beside, where that one turns out, G-075) bring one beside the other.
  const at = ox * tx + oz * tz >= MERGE_COS ? [o.position, ...wayAhead(o, MERGE_AHEAD, WAY_STEP)] : [o.position];
  // `way[k]` lies `k * WAY_STEP` ahead along the route.
  for (let k = 1; k < way.length && k * WAY_STEP <= reach + o.vehicle.half.l; k++) {
    if (at.every((p) => flat(way[k]!, p) >= width)) continue;
    const gap = k * WAY_STEP - st.half.l - o.vehicle.half.l * Math.abs(ox * tx + oz * tz) - o.vehicle.half.w * Math.abs(ox * tz - oz * tx);
    const allowed = gap <= FOLLOW_GAP ? 0 : Math.sqrt(2 * BRAKE * (gap - FOLLOW_GAP));
    if (allowed < out.allowed) {
      out.allowed = allowed;
      out.player = null;
    }
    return;
  }
};

/** What is in a vehicle's way: anyone with a body in front of it, the vehicle ahead going its way, and crossing traffic with right of way. */
const lookAhead = (ctx: SimContext, self: Vehicle, live: ReadonlyMap<EntityId, Vehicle>, pose: { x: number; z: number; tx: number; tz: number }): Ahead => {
  const st = self.vehicle;
  const reach = st.half.l + 4 + (st.v * st.v) / (2 * BRAKE);
  const out: Ahead = { allowed: Infinity, player: null, beside: null };
  const passing = st.blocked > PASS_AFTER;
  for (const b of ctx.world.with("body")) {
    const dx = b.position.x - pose.x;
    const dz = b.position.z - pose.z;
    if (Math.abs(dx) > reach + 3 || Math.abs(dz) > reach + 3) continue;
    const fwd = dx * pose.tx + dz * pose.tz;
    const lat = dx * pose.tz - dz * pose.tx;
    if (fwd < -st.half.l - BODY || fwd > reach) continue;
    if (b.player && Math.abs(lat) < st.half.w + BODY + PASS_ROOM + SIDE_MARGIN) out.beside = lat;
    // Passing the player, the vehicle goes by close.
    if (Math.abs(lat) > st.half.w + BODY + (passing && b.player ? 0.1 : SIDE_MARGIN)) continue;
    const gap = fwd - st.half.l - BODY;
    const allowed = gap <= STOP_GAP ? 0 : Math.sqrt(2 * BRAKE * (gap - STOP_GAP));
    if (allowed < out.allowed) {
      out.allowed = allowed;
      out.player = b.player ? lat : null;
    }
  }
  // Its way ahead, far enough for both the vehicles on it and the crossings.
  // Its way ahead, far enough for both the vehicles on it and the crossings, read once if needed.
  let way: { x: number; z: number }[] | null = null;
  const mine = () => (way ??= wayAhead(self, Math.max(reach + 8, CROSS_LOOK)));
  for (const o of live.values()) {
    if (o === self) continue;
    onItsWay(self, o, mine, reach, out);
    const ox = Math.sin(o.yaw);
    const oz = Math.cos(o.yaw);
    const along = ox * pose.tx + oz * pose.tz;
    // Oncoming traffic keeps to its lane; crossing traffic (merging at a roundabout too, from
    // 45 degrees on) takes turns at the crossing.
    if (along < MERGE_COS) {
      if (along <= -0.7) continue;
      const allowed = out.allowed;
      const player = out.player;
      yieldAtCrossing(self, o, pose, ox, oz, out);
      // Only where their ways meet: read as straight lines they can cross where the ways do not.
      if (out.allowed < allowed && !waysMeet(mine(), wayAhead(o, CROSS_LOOK, -o.vehicle.half.l), st.half.w + o.vehicle.half.w + CROSS_MARGIN)) {
        out.allowed = allowed;
        out.player = player;
      }
      continue;
    }
    const dx = o.position.x - pose.x;
    const dz = o.position.z - pose.z;
    const fwd = dx * pose.tx + dz * pose.tz;
    if (fwd <= 0 || fwd > reach + o.vehicle.half.l) continue;
    // With a margin: two lanes squeeze together in a sharp bend, and the one behind there gives way.
    if (Math.abs(dx * pose.tz - dz * pose.tx) > st.half.w + o.vehicle.half.w + SIDE_MARGIN) continue;
    const gap = fwd - st.half.l - o.vehicle.half.l;
    const allowed = gap <= FOLLOW_GAP ? 0 : Math.sqrt(2 * BRAKE * (gap - FOLLOW_GAP));
    if (allowed < out.allowed) {
      out.allowed = allowed;
      out.player = null;
    }
  }
  return out;
};

/** Pushes the player out of a vehicle's footprint (no knock-down yet: the vehicle has stopped before it, ADR-0050). */
const pushOut = (player: Entity, v: Vehicle): void => {
  const st = v.vehicle;
  const tx = Math.sin(v.yaw);
  const tz = Math.cos(v.yaw);
  const dx = player.position.x - v.position.x;
  const dz = player.position.z - v.position.z;
  const fwd = dx * tx + dz * tz;
  const lat = dx * tz - dz * tx;
  const r = player.body?.radius ?? BODY;
  const inFwd = st.half.l + r - Math.abs(fwd);
  const inLat = st.half.w + r - Math.abs(lat);
  if (inFwd <= 0 || inLat <= 0) return;
  const p = player.position;
  player.position =
    inLat < inFwd
      ? { x: p.x + tz * Math.sign(lat || 1) * inLat, y: p.y, z: p.z - tx * Math.sign(lat || 1) * inLat }
      : { x: p.x + tx * Math.sign(fwd || 1) * inFwd, y: p.y, z: p.z + tz * Math.sign(fwd || 1) * inFwd };
};

/**
 * The street's traffic (ADR-0050): keeps the vehicles of the lanes round the player at the
 * number the hour and the density ask for, drives each along its lane towards where its
 * timetable says it should be, stops it before anyone in its way and behind the vehicle ahead,
 * sounds the horn at the player and goes round them, and frightens it with a shot. Vehicles
 * come and go out of the player's sight; they are never saved and use no shared randomness.
 */
export const createTrafficSystem = (): System => {
  const live = new Map<EntityId, Vehicle>();
  const shots: Vec3[] = [];
  let bus: EventBus<DomainEvents> | null = null;
  let wait = 0;
  let last: Vec3 | null = null;
  return {
    name: "traffic",
    run(ctx) {
      const range = TRAFFIC_RANGE[ctx.traffic];
      if (range.radius <= 0 && live.size === 0) return;
      if (ctx.bus !== bus) {
        bus = ctx.bus;
        bus.on("Disturbance", (d) => {
          if (d.kind === "gunshot") shots.push(d.at);
        });
      }
      for (const [id, e] of live) if (!ctx.world.has(e)) live.delete(id);
      const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
      const focus = player?.position ?? null;
      // A new game, a load, a metro ride or a teleport: the street fills at once.
      const fresh = focus !== null && (last === null || flat(focus, last) > 40);
      last = focus;
      wait -= 1;
      if (wait <= 0 || fresh) {
        wait = LOOK_STEPS;
        comeAndGo(ctx, live, player, range.radius, fresh);
      }
      const near = shots.splice(0);
      for (const v of [...live.values()].sort((a, b) => a.id - b.id)) drive(ctx, live, v, player, near);
    },
  };
};

/** Would the player see a vehicle come or go at `p`? */
const watched = (ctx: SimContext, player: Entity | null, p: Vec3, radius: number): boolean =>
  player !== null && flat(p, player.position) < radius * SEEN_SHARE && inPlayerView(ctx, player, p);

const remove = (ctx: SimContext, live: Map<EntityId, Vehicle>, v: Vehicle): void => {
  ctx.world.remove(v);
  live.delete(v.id);
  // Gone without a fall: the renderer takes it out as it does an unloaded chunk's.
  ctx.streamer.streamedOut.add(v.id);
};

/** Vehicles that should drive near the player come, the others go (out of sight). */
const comeAndGo = (ctx: SimContext, live: Map<EntityId, Vehicle>, player: Entity | null, radius: number, fresh: boolean): void => {
  const focus = player?.position;
  for (const v of [...live.values()]) {
    const count = vehicleCount(ctx.seed, v.vehicle.route, ctx.traffic, ctx.state.domain.clock);
    const far = !focus || flat(v.position, focus) > radius * 1.1;
    if (far || (v.vehicle.index >= count && !watched(ctx, player, v.position, radius))) remove(ctx, live, v);
  }
  if (!focus || radius <= 0) return;
  const clock = ctx.state.domain.clock;
  TRAFFIC_ROUTES.forEach((lane, route) => {
    if (boxDistance(route, focus.x, focus.z) > radius) return;
    const count = Math.min(VEHICLE_IDS_PER_ROUTE, vehicleCount(ctx.seed, route, ctx.traffic, clock));
    for (let i = 0; i < count; i++) {
      if (live.has(vehicleId(route, i))) continue;
      const s = timetable(vehiclePlan(ctx.seed, route, i), clock).s;
      const pose = lanePose(lane, s);
      if (flat(pose, focus) > radius) continue;
      if (!fresh && watched(ctx, player, { x: pose.x, y: focus.y, z: pose.z }, radius)) continue;
      if (crowded(live, route, s, lane)) continue;
      const v = vehicleEntity(ctx, route, i, s);
      live.set(v.id, ctx.world.add(v) as Vehicle);
      ctx.streamer.streamedOut.delete(v.id);
    }
  });
};

/**
 * Is there a vehicle too close to arc length `s` of the lane for another to appear there: one
 * of the lane itself, one crossing its way within `CROSS_LOOK` (it could not stop in time
 * for a vehicle that turned up at the crossing), or one beside it that reaches into its way
 * (G-075: 3 Maja's left lane shifts across into the lane its right one turns out of)?
 */
const crowded = (live: ReadonlyMap<EntityId, Vehicle>, route: number, s: number, lane: TrafficRoute): boolean => {
  const at = lanePose(lane, s);
  let ahead: { x: number; z: number }[] | null = null;
  for (const o of live.values()) {
    if (o.vehicle.route !== route) {
      const across = Math.abs(Math.sin(o.yaw) * at.tx + Math.cos(o.yaw) * at.tz) < 0.7;
      if (across && flat(o.position, at) < CROSS_LOOK) return true;
      // One of another lane on the same line its way (a trolleybus on a car lane, lanes meeting at a
      // junction, ADR-0055) keeps it as far as one of its own lane would; one beside it does not.
      const [ox, oz] = [Math.sin(o.yaw), Math.cos(o.yaw)];
      const [dx, dz] = [at.x - o.position.x, at.z - o.position.z];
      if (Math.abs(dx * ox + dz * oz) < o.vehicle.half.l + 9 && Math.abs(dx * oz - dz * ox) < o.vehicle.half.w + SPAWN_BESIDE) return true;
      // Turned across its way (in a turn beside it), the other's body reaches out wider than its width.
      const along = Math.abs(ox * at.tx + oz * at.tz);
      const reach = o.vehicle.half.w * along + o.vehicle.half.l * Math.sqrt(Math.max(0, 1 - along * along));
      if (Math.abs(dx * at.tx + dz * at.tz) < o.vehicle.half.l + 9 && Math.abs(dx * at.tz - dz * at.tx) < reach + SPAWN_BESIDE) return true;
      // Nor one beside it whose way closes in on its own just ahead: they would meet before either could give way.
      if (flat(o.position, at) < APPEAR_AHEAD + o.vehicle.half.l + 9) {
        ahead ??= pointsAlong(lane.points, s, Math.min(lane.length, s + APPEAR_AHEAD), WAY_STEP);
        const theirs = wayAhead(o, APPEAR_AHEAD);
        if (ahead.some((p) => theirs.some((q) => flat(p, q) < o.vehicle.half.w + SPAWN_BESIDE))) return true;
      }
      continue;
    }
    if (Math.abs(o.vehicle.s - s) < o.vehicle.half.l + 9 || Math.abs(o.vehicle.s - s) > lane.length - 9) return true;
  }
  return false;
};

/** Is the place a vehicle would jump back onto its timetable free: no other vehicle as close as `crowded` lets one appear by? */
const freeFor = (live: ReadonlyMap<EntityId, Vehicle>, self: Vehicle, at: { x: number; z: number }): boolean =>
  [...live.values()].every((o) => o === self || flat(o.position, at) >= o.vehicle.half.l + 9);

/** One step of one vehicle: its timetable, what is in its way, a shot, the player; then on along the lane. */
const drive = (ctx: SimContext, live: Map<EntityId, Vehicle>, v: Vehicle, player: Entity | null, shots: readonly Vec3[]): void => {
  const st = v.vehicle;
  const lane = TRAFFIC_ROUTES[st.route]!;
  const plan = vehiclePlan(ctx.seed, st.route, st.index);
  const dt = ctx.dt;
  const tt = timetable(plan, ctx.state.domain.clock);
  let lag = tt.s - st.s;
  if (lag > lane.length / 2) lag -= lane.length;
  if (lag < -lane.length / 2) lag += lane.length;
  // Far off its timetable (the clock skipped ahead, a long hold-up): back on it where nobody sees.
  const turning = () => lane.turns?.some(([a, b]) => st.s > a - TURN_BRAKE && st.s < b) === true;
  // Not onto another vehicle: a queue held up ahead (a junction) would stack its vehicles in one place.
  if (Math.abs(lag) > RESYNC && !watched(ctx, player, v.position, TRAFFIC_RANGE[ctx.traffic].radius) && freeFor(live, v, lanePose(lane, tt.s))) {
    st.s = tt.s;
    lag = 0;
    // It lands at the speed of where it lands: braking from its old speed would take it through a turn round fast.
    st.v = Math.min(st.v, tt.v, turning() ? TURN_SPEED : Infinity);
  }
  let want = Math.max(0, Math.min(plan.speed * HURRY, tt.v + GAIN * lag));
  if (turning()) want = Math.min(want, TURN_SPEED);
  if (!st.panic && shots.some((p) => flat(p, v.position) < PANIC_RADIUS)) {
    const kind = coin(v.id, ctx.tick) ? "stop" : "flee";
    st.panic = { kind, left: PANIC_SECONDS[kind] };
  }
  if (st.panic) {
    want = st.panic.kind === "stop" ? 0 : plan.speed * FLEE;
    st.panic.left -= dt;
    if (st.panic.left <= 0) st.panic = null;
  }
  const pose = lanePose(lane, st.s, st.aside);
  const ahead = lookAhead(ctx, v, live, pose);
  st.horn = Math.max(0, st.horn - dt);
  if (ahead.player !== null && ahead.allowed < 0.5) st.blocked += dt;
  // Going round the player, it keeps going round until past them: a step aside that just clears
  // them would otherwise end the pass, and back in the lane it is held up again (a van stood so).
  else if (!(st.blocked > PASS_AFTER && ahead.beside !== null)) st.blocked = Math.max(0, st.blocked - dt);
  if (st.blocked > HORN_AFTER && st.horn <= 0 && ahead.player !== null) {
    st.horn = HORN_EVERY;
    ctx.bus.emit("VehicleHorned", { vehicleId: v.id, at: { ...v.position } });
  }
  let target = 0;
  const by = ahead.player ?? ahead.beside;
  if (st.blocked > PASS_AFTER && by !== null) {
    // Round the player on the side away from them, as far as it takes.
    const clear = st.half.w + BODY + PASS_ROOM;
    target = st.aside + (by >= 0 ? by - clear : by + clear);
    target = Math.max(-MAX_ASIDE, Math.min(MAX_ASIDE, target));
  }
  const rate = (target !== 0 ? ASIDE_RATE : BACK_RATE) * dt;
  if (st.blocked > PASS_AFTER || by === null) st.aside += Math.max(-rate, Math.min(rate, target - st.aside));
  const goal = Math.min(want, ahead.allowed);
  st.v += Math.max(-BRAKE * 1.5 * dt, Math.min(ACCEL * dt, goal - st.v));
  if (goal <= 0 && st.v < 0.05) st.v = 0;
  st.s += st.v * dt;
  if (st.s >= lane.length) {
    // The end of the lane: gone out of sight, round to its start again (held while the player watches).
    const end = lanePose(lane, lane.length);
    if (!watched(ctx, player, { x: end.x, y: v.position.y, z: end.z }, TRAFFIC_RANGE[ctx.traffic].radius)) {
      remove(ctx, live, v);
      return;
    }
    st.s = lane.length - 0.01;
    st.v = 0;
  }
  const next = lanePose(lane, st.s, st.aside);
  const y = roadY(ctx, next.x, next.z);
  v.velocity = { x: (next.x - v.position.x) / dt, y: 0, z: (next.z - v.position.z) / dt };
  v.position = { x: next.x, y, z: next.z };
  v.yaw = next.yaw;
  if (player) pushOut(player, v);
};
