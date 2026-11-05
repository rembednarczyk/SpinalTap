import { BehaviourTree, State } from "mistreevous";
import { type CrowdState, type EntityId, type Vec3, reputationTier } from "@seki/core";
import type { CrowdMind, Entity } from "../../world/components";
import type { SimContext, System } from "../../world/context";
import { inCreationOrder } from "../../world/ordering";
import { followSchedule } from "../../world/schedule";
import { incapacitated } from "../../world/takedown";
import { activityOf } from "../../world/activity";
import { worldTimeScale } from "../ability-system";
import { CIVILIAN_TREE } from "./civilian-tree";
import { type Walker, holdLanePlace, laneSpot } from "./crowd-walk";
import { walkRoutine } from "./passerby-walk";
import { detourStep, steerPoint, straightWalk } from "./steering";

type Agent = ConstructorParameters<typeof BehaviourTree>[1];

/** Passers-by run from a player the street is hostile to (ADR-0070) closer than this (metres). */
export const FLEE_RADIUS = 7;
/**
 * A wary street (ADR-0070) only makes way: a passer-by steps back at a walk from a player
 * closer than this (metres), watching them, and says nothing.
 */
export const YIELD_RADIUS = 3.5;
/**
 * An escape from the player ends (and the next one gets its own cue) only this far from them or
 * once the street stops fearing them: a passer-by going back to its spot steps over FLEE_RADIUS
 * again and again, and each step used to cue a new escape (G-281).
 */
const FLEE_CUE_RESET = 2 * FLEE_RADIUS;
/**
 * A civilian that fears the player and whose spot is within its flee radius plus this (metres)
 * does not go back to it, only stands past the radius and watches the player (ADR-0070): going
 * back stepped it over the radius again, and it turned in and out of it 36 times a second. The
 * rule reads only positions and reputation, so a load mid-stand-off goes on the same.
 */
export const FLEE_DEAD_ZONE = 2;
export const CIVILIAN_FLEE_SPEED = 3.4;
export const CIVILIAN_WALK_SPEED = 1.4;
/** Fastest a civilian hurries to catch up with its daily plan (after fleeing, say). */
const CIVILIAN_SCHEDULE_SPEED = 1.6;
const HOME_TOLERANCE = 0.3;

/**
 * The crowd (ADR-0029). A shot this close makes a bystander cower for `COWER_SECONDS`, then run;
 * running lasts `FLEE_SECONDS` (refreshed by every new scare), watching (`alarmed`)
 * `ALARMED_SECONDS`. Then it calms down and goes back to its plan.
 */
export const COWER_RADIUS = 6;
export const COWER_SECONDS = 4;
export const FLEE_SECONDS = 8;
export const ALARMED_SECONDS = 5;
/** The running bystander heads for a point this far ahead, away from the danger, round obstacles. */
const FLEE_LOOKAHEAD = 6;
/** Turns tried, in order, when the way straight away is blocked; the probe is this long. */
const FLEE_TURNS = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];
const FLEE_PROBE = 2.5;
/**
 * Hysteresis of the turn (G-317): the way it runs on (read from its heading) is kept while it is
 * open this much further than the probe, and a way closer to straight away takes over only once
 * it is open as far. Along a wall the probe of the next way in opened and closed every step, and
 * the heading swung by 0.8 rad 24 times. Half a metre already lets it run up and down a blind
 * alley closer to the player; 1.5 m keeps others swinging (flee-wall.test.ts).
 */
const FLEE_SWITCH_MARGIN = 1;
/** How close its heading has to be to a turn to count as running on it (radians). */
const FLEE_HELD_TURN = Math.PI / 8;
/**
 * How far off the middle the side lines of a way run, of the body's radius: a gap between them
 * (0.38 m) is too narrow to run through. 0.8 and 1 shut more ways by the walls of the deptak and
 * swung more walkers than they stopped (seeds 3, 7, 17, 29, 43, G-338).
 */
const FLEE_PROBE_SIDE = 0.5;

/**
 * Is the way along `heading` open `reach` metres for the body, not just for a line through its
 * middle (G-338)? Between a lamp post and a planter 0.2 m apart the knee-high line went through
 * where the body, 0.76 m wide, did not: the probe of the way straight away opened and closed
 * every step, the heading swung by a quarter turn 242 times and the walker stood still. So a
 * way with something across both side lines too is shut. With one side on a wall it stays
 * open: the body slides along it, and shutting it swung walkers along walls (flee-wall.test.ts).
 */
const bodyWalk = (ctx: SimContext, from: Vec3, heading: number, reach: number, radius: number): boolean => {
  const [ux, uz] = [Math.sin(heading), Math.cos(heading)];
  const line = (s: number): boolean => {
    const start = { x: from.x + uz * s, y: from.y, z: from.z - ux * s };
    return straightWalk(ctx.world, start, { x: start.x + ux * reach, y: from.y, z: start.z + uz * reach });
  };
  const side = radius * FLEE_PROBE_SIDE;
  return line(0) && (side <= 0 || line(side) || line(-side));
};

/**
 * Does the walk along `turn` off `away`, round its obstacle as `steerPoint` takes it, bend back
 * across the line straight away from the danger or nearer to it (straight away itself: back
 * towards the danger)? Then the probe of that way was cut by a corner the walk goes round, not
 * by the wall alongside, and keeping the way it ran on led a chased walker off the way out of an
 * alley into a corner, where it swung at the player's feet (G-317, flee-wall.test.ts).
 */
const bendsBack = (ctx: SimContext, from: Vec3, away: number, turn: number): boolean => {
  const heading = away + turn;
  const p = steerPoint(ctx.world, from, { x: from.x + Math.sin(heading) * FLEE_LOOKAHEAD, y: from.y, z: from.z + Math.cos(heading) * FLEE_LOOKAHEAD });
  const off = Math.atan2(p.x - from.x, p.z - from.z) - away;
  const bend = Math.atan2(Math.sin(off), Math.cos(off));
  if (Math.abs(bend - turn) <= FLEE_HELD_TURN) return false;
  if (turn === 0) return Math.abs(bend) > Math.PI / 2;
  return Math.sign(bend) !== Math.sign(turn) || Math.abs(bend) < Math.abs(turn);
};

/**
 * The turn off `away` to run on: straight away when the way is open, else the open way closest
 * to it (a wall at its back), with the hysteresis above. A way back towards the danger is never
 * kept, so it does not run up and down a blind alley closer to the player. Nor is a heading it
 * only walked on (`running` false): kept for its first step, it turned 1.5 rad on the next. Nor
 * is any heading kept past a way closer to straight away that `bendsBack`. Null when every way
 * is blocked.
 */
const fleeTurn = (ctx: SimContext, from: Vec3, away: number, yaw: number, running: boolean, radius: number): number | null => {
  const open = (turn: number, reach: number): boolean => bodyWalk(ctx, from, away + turn, reach, radius);
  const best = FLEE_TURNS.find((t) => open(t, FLEE_PROBE));
  if (best === undefined || !running) return best ?? null;
  const runsOn = (t: number): boolean => Math.abs(Math.atan2(Math.sin(yaw - away - t), Math.cos(yaw - away - t))) <= FLEE_HELD_TURN;
  const held = FLEE_TURNS.find((t) => Math.abs(t) <= Math.PI / 2 && runsOn(t));
  const far = FLEE_PROBE + FLEE_SWITCH_MARGIN;
  if (held === undefined || held === best || open(best, far) || !open(held, far)) return best;
  return bendsBack(ctx, from, away, best) ? best : held;
};

/**
 * How close its heading has to be to a way for that to be the way it ran on its last step
 * (radians, G-326): one step turns the heading towards a moving point by hundredths of a radian,
 * round a corner by up to a tenth. With 0.05 a walker let go of its way round on such a bend and
 * swung again (flee-wall.test.ts, seed 29).
 */
const FLEE_HELD_STEP = 0.15;

/** The angle between `heading` and the way from `from` to `to`, unsigned. */
const offHeading = (from: Vec3, to: Vec3, heading: number): number => {
  const d = Math.atan2(to.x - from.x, to.z - from.z) - heading;
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
};

/**
 * The point to run towards this step, `steerPoint` with hysteresis (G-326): a runner that took
 * the way round on its last step (`heading`, the way its velocity points) keeps it while the
 * straight walk is free again. Not its yaw: making way, it faces the player. The knee-high
 * line grazed a corner that the way round, in cells with room for a body, keeps clear of: the
 * line opened and closed every step, and the heading swung by 0.42 rad 25 times.
 */
const fleeStep = (ctx: SimContext, from: Vec3, ahead: Vec3, heading: number, running: boolean): Vec3 => {
  if (!straightWalk(ctx.world, from, ahead)) return steerPoint(ctx.world, from, ahead, true);
  if (!running || offHeading(from, ahead, heading) <= FLEE_HELD_STEP) return ahead;
  const round = detourStep(ctx.world, from, ahead);
  return round && offHeading(from, round, heading) <= FLEE_HELD_STEP ? round : ahead;
};

const FEAR: Readonly<Record<CrowdState, number>> = { calm: 0, alarmed: 1, fleeing: 2, cowering: 3 };

const STATE_SECONDS: Readonly<Record<CrowdState, number>> = { calm: 0, alarmed: ALARMED_SECONDS, fleeing: FLEE_SECONDS, cowering: COWER_SECONDS };

const mindOf = (c: Entity & { civilian: NonNullable<Entity["civilian"]> }): CrowdMind =>
  (c.civilian.crowd ??= { state: "calm", timer: 0, from: c.position, call: null, scared: 0 });

/**
 * Scares a bystander (ADR-0029): it moves to `state` unless it is already more afraid, and the
 * timer starts over. CrowdReacted goes out when the state changes.
 */
export const scare = (ctx: SimContext, c: Entity, state: CrowdState, from: Vec3): void => {
  if (!c.civilian) return;
  const mind = mindOf(c as Entity & { civilian: NonNullable<Entity["civilian"]> });
  if (FEAR[state] < FEAR[mind.state]) return;
  mind.from = { x: from.x, y: from.y, z: from.z };
  mind.timer = STATE_SECONDS[state];
  if (mind.state === state) return;
  mind.state = state;
  ctx.bus.emit("CrowdReacted", { entityId: c.id, state });
};

/**
 * Calms the street for a save (G-240). The crowd's fear is not saved and a loaded game starts
 * calm (ADR-0029), so the game it is saved from calms down too: both go on the same. Calls in
 * progress are settled first (`settleCalls`). Being scared off the phone (`scared`) goes too: it
 * is not in the save either, and only lets a witness call sooner.
 */
export const calmStreet = (ctx: SimContext): void => {
  for (const c of inCreationOrder(ctx.world.with("civilian"))) {
    const mind = c.civilian.crowd;
    if (!mind) continue;
    delete c.civilian.crowd;
    if (mind.state !== "calm") ctx.bus.emit("CrowdReacted", { entityId: c.id, state: "calm" });
  }
};

type Civilian = Entity & { civilian: NonNullable<Entity["civilian"]>; velocity: NonNullable<Entity["velocity"]> };

const onLane = (c: Civilian): c is Civilian & Walker => !!c.passerby?.lane;

/**
 * Where a civilian goes back to: its routine's spot, its place on a crowd route (ADR-0041),
 * its daily plan's place or its home.
 */
const spotOf = (ctx: SimContext, c: Civilian): Vec3 | null => {
  if (onLane(c)) return laneSpot(ctx, c);
  if (c.passerby) return c.passerby.goal;
  return c.schedule?.pose?.position ?? c.civilian.home;
};

/** Activities done sitting or lying (ADR-0040): the figure keeps its heading on the seat. */
const SEATED: ReadonlySet<string> = new Set(["sit", "sleep"]);

/**
 * Sitting (a bench, a stool, home) or lying down: the street's opinion does not turn it round
 * (ADR-0070). Read from the activity rule itself, not the stored `activity`, so a load goes on
 * the same.
 */
const seated = (ctx: SimContext, c: Civilian): boolean => {
  const now = activityOf(c, ctx.state.domain.clock);
  return now !== null && SEATED.has(now);
};

/** Turns `self` to look at the player, unless it sits. */
const facePlayer = (ctx: SimContext, self: Civilian, player: Entity): void => {
  if (seated(ctx, self)) return;
  self.yaw = Math.atan2(player.position.x - self.position.x, player.position.z - self.position.z);
};

/**
 * A resident with a shop or a conversation (ADR-0070): the street's opinion changes its prices
 * and its words, it does not chase it off its spot. A shot still does (ADR-0029).
 */
const isResident = (c: Entity): boolean => c.interactable?.kind === "shop" || c.interactable?.kind === "dialogue";

/** How a passer-by keeps away from the player: runs (hostile street), makes way (wary) or not at all. */
type PlayerFear = "flee" | "yield" | null;

const hasRoutine = (c: Civilian): c is Civilian & { passerby: NonNullable<Entity["passerby"]> } => c.passerby !== undefined;

class CivilianAgent {
  ctx: SimContext | null = null;
  self: Civilian | null = null;
  player: Entity | null = null;
  distance = Infinity;
  /** Presentation memory only: one "flee" cue per escape, never read back into the state. */
  fleeing = false;

  private crowd = (): CrowdState => this.self?.civilian.crowd?.state ?? "calm";
  IsCowering = (): boolean => this.crowd() === "cowering";
  IsFleeing = (): boolean => this.crowd() === "fleeing";
  IsAlarmed = (): boolean => this.crowd() === "alarmed";

  /** The street's opinion of the player by tiers (ADR-0070); residents are never chased off. */
  private playerFear = (): PlayerFear => {
    const { ctx, self } = this;
    if (!ctx || !self || isResident(self)) return null;
    const tier = reputationTier(ctx.state.domain.reputation[self.faction ?? "civilians"]);
    return tier === "hostile" ? "flee" : tier === "wary" ? "yield" : null;
  };
  private fearRadius = (): number => (this.playerFear() === "yield" ? YIELD_RADIUS : FLEE_RADIUS);

  FearsPlayer = (): boolean => this.playerFear() !== null;
  PlayerNearby = (): boolean => this.player !== null && this.distance <= this.fearRadius();

  /** Past the flee radius, in the dead zone, with its spot in it too: going back would step it in. */
  SpotNearPlayer = (): boolean => {
    const { ctx, self, player } = this;
    const reach = this.fearRadius() + FLEE_DEAD_ZONE;
    if (!ctx || !self || !player || this.distance > reach) return false;
    const spot = spotOf(ctx, self);
    return spot !== null && Math.hypot(spot.x - player.position.x, spot.z - player.position.z) <= reach;
  };

  /** A resident of a street hostile to the player (ADR-0070), with the player close. */
  ResentsPlayer = (): boolean => {
    const { ctx, self } = this;
    if (!ctx || !self || !isResident(self) || this.player === null || this.distance > FLEE_RADIUS) return false;
    return reputationTier(ctx.state.domain.reputation[self.faction ?? "civilians"]) === "hostile";
  };

  /** Keeps to its spot and its plan, and turns to the player while it stands. */
  StayFacingPlayer = (): State => {
    const state = this.ReturnHome();
    const { ctx, self, player } = this;
    if (!ctx || !self || !player || self.velocity.x !== 0 || self.velocity.z !== 0) return state;
    facePlayer(ctx, self, player);
    return state;
  };

  /**
   * Stands where it is and keeps an eye on the player (seated, it only stays put). A walker of
   * a crowd route holds its place on it, or the clock would walk the place on without it.
   */
  WatchPlayer = (): State => {
    const { ctx, self, player } = this;
    if (!ctx || !self || !player) return State.FAILED;
    if (onLane(self)) holdLanePlace(self);
    facePlayer(ctx, self, player);
    self.velocity = { x: 0, y: 0, z: 0 };
    return State.SUCCEEDED;
  };

  /** Down on the ground, hands over the head: it stays where it is. */
  Cower = (): State => {
    if (!this.self) return State.FAILED;
    this.self.velocity = { x: 0, y: 0, z: 0 };
    return State.SUCCEEDED;
  };

  /** Runs away from what scared it, around whatever is in the way. */
  FleeFromDanger = (): State => {
    const { ctx, self } = this;
    const from = self?.civilian.crowd?.from;
    if (!ctx || !self || !from) return State.FAILED;
    this.runFrom(ctx, self, from, this.player?.yaw ?? 0, CIVILIAN_FLEE_SPEED);
    return State.SUCCEEDED;
  };

  /** Stops and looks at the commotion. */
  WatchDanger = (): State => {
    const from = this.self?.civilian.crowd?.from;
    if (!this.self || !from) return State.FAILED;
    this.self.velocity = { x: 0, y: 0, z: 0 };
    this.self.yaw = Math.atan2(from.x - this.self.position.x, from.z - this.self.position.z);
    return State.SUCCEEDED;
  };

  FleeFromPlayer = (): State => {
    const { ctx, self, player } = this;
    if (!ctx || !self || !player) return State.FAILED;
    if (this.playerFear() === "yield") {
      // Makes way: a step back at a walk, an eye on the player, no word (no NpcReacted).
      this.runFrom(ctx, self, player.position, player.yaw, CIVILIAN_WALK_SPEED);
      self.yaw = Math.atan2(player.position.x - self.position.x, player.position.z - self.position.z);
      return State.SUCCEEDED;
    }
    this.runFrom(ctx, self, player.position, player.yaw, CIVILIAN_FLEE_SPEED);
    if (!this.fleeing) {
      this.fleeing = true;
      ctx.bus.emit("NpcReacted", { entityId: self.id, faction: self.faction ?? "civilians", reaction: "flee" });
    }
    return State.SUCCEEDED;
  };

  private runFrom(ctx: SimContext, self: Civilian, from: Vec3, fallbackYaw: number, speed: number): void {
    const dx = self.position.x - from.x;
    const dz = self.position.z - from.z;
    const d = Math.hypot(dx, dz);
    // Standing exactly on top of it: run along the street, away from the player's facing.
    const away = d < 1e-6 ? fallbackYaw : Math.atan2(dx, dz);
    const running = Math.hypot(self.velocity.x, self.velocity.z) > 0.9 * speed;
    const turn = fleeTurn(ctx, self.position, away, self.yaw, running, self.body?.radius ?? 0) ?? 0;
    const ux = Math.sin(away + turn);
    const uz = Math.cos(away + turn);
    const ahead = { x: self.position.x + ux * FLEE_LOOKAHEAD, y: self.position.y, z: self.position.z + uz * FLEE_LOOKAHEAD };
    const p = fleeStep(ctx, self.position, ahead, Math.atan2(self.velocity.x, self.velocity.z), running);    const sx = p.x - self.position.x;
    const sz = p.z - self.position.z;
    const s = Math.hypot(sx, sz);
    const [vx, vz] = s < 1e-6 ? [ux, uz] : [sx / s, sz / s];
    self.velocity = { x: vx * speed, y: 0, z: vz * speed };
    self.yaw = Math.atan2(vx, vz);
  }

  /** Back to the spot: wherever the daily plan says right now, or the fixed home without one. */
  ReturnHome = (): State => {
    const { self, ctx } = this;
    if (!self) return State.FAILED;
    if (this.distance > FLEE_CUE_RESET || this.playerFear() !== "flee") this.fleeing = false;
    // A background passer-by goes on with its routine (ADR-0040).
    if (ctx && hasRoutine(self)) {
      walkRoutine(ctx, self, ctx.dt);
      return State.SUCCEEDED;
    }
    const pose = self.schedule?.pose;
    if (pose && ctx) {
      followSchedule(self, pose, CIVILIAN_SCHEDULE_SPEED, ctx.dt);
      return State.SUCCEEDED;
    }
    const dx = self.civilian.home.x - self.position.x;
    const dz = self.civilian.home.z - self.position.z;
    const d = Math.hypot(dx, dz);
    if (d <= HOME_TOLERANCE) {
      self.velocity = { x: 0, y: 0, z: 0 };
      return State.SUCCEEDED;
    }
    self.velocity = { x: (dx / d) * CIVILIAN_WALK_SPEED, y: 0, z: (dz / d) * CIVILIAN_WALK_SPEED };
    self.yaw = Math.atan2(dx, dz);
    return State.SUCCEEDED;
  };
}

/** One step of a bystander's fear: cowering turns into running, running and watching into calm. */
const calmDown = (ctx: SimContext, c: Civilian, dt: number): void => {
  const mind = c.civilian.crowd;
  if (!mind) return;
  mind.scared = Math.max(0, mind.scared - dt);
  if (mind.state === "calm") return;
  mind.timer -= dt;
  if (mind.timer > 0) return;
  const next: CrowdState = mind.state === "cowering" ? "fleeing" : "calm";
  mind.state = next;
  mind.timer = STATE_SECONDS[next];
  ctx.bus.emit("CrowdReacted", { entityId: c.id, state: next });
};

/**
 * Bystanders react to the street (ADR-0029) and to its opinion of the player: scared by a
 * disturbance they cower, run or watch, and calm down after a while; when the civilians think
 * badly of the player, passers-by keep their distance (ADR-0070); otherwise they stay at (or
 * walk back to) their spot or follow their daily plan. Uses no randomness, so it cannot shift
 * the RNG stream of the combat systems.
 */
export const createCivilianAiSystem = (): System => {
  const brains = new Map<EntityId, { tree: BehaviourTree; agent: CivilianAgent }>();
  return {
    name: "civilian-ai",
    run(ctx) {
      const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
      const alive = new Set<EntityId>();
      const dt = ctx.dt * worldTimeScale(ctx);
      const helpers = new Set<EntityId | null>(ctx.world.with("downed").entities.map((b) => b.downed.finder));
      for (const c of inCreationOrder(ctx.world.with("civilian", "velocity"))) {
        alive.add(c.id);
        // Knocked out or held in a takedown (ADR-0065): it lies still and takes no fright. Stopped
        // by someone knocked out to wake it: it stands by it.
        if (incapacitated(ctx, c) || helpers.has(c.id)) {
          c.velocity = { x: 0, y: 0, z: 0 };
          continue;
        }
        let brain = brains.get(c.id);
        if (!brain) {
          const agent = new CivilianAgent();
          brain = { agent, tree: new BehaviourTree(CIVILIAN_TREE, agent as unknown as Agent) };
          brains.set(c.id, brain);
        }
        calmDown(ctx, c, dt);
        brain.agent.ctx = ctx;
        brain.agent.self = c;
        brain.agent.player = player;
        brain.agent.distance = player ? Math.hypot(player.position.x - c.position.x, player.position.z - c.position.z) : Infinity;
        brain.tree.step();
        if ((c.hackFx?.crippled ?? 0) > 0) c.velocity = { x: 0, y: 0, z: 0 };
      }
      for (const id of [...brains.keys()]) if (!alive.has(id)) brains.delete(id);
    },
  };
};
