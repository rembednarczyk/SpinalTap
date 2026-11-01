import {
  type DifficultyProfile,
  type DomainEvents,
  type DomainState,
  EMPTY_INPUT,
  type EntitySnapshot,
  type GameClock,
  EventBus,
  type GameCommand,
  type InputFrame,
  type SaveSnapshot,
  SAVE_SCHEMA_VERSION,
  createDomainState,
  difficultyProfile,
  isDifficultyProfile,
} from "@seki/core";
import { World } from "miniplex";
import { SeededRandom } from "./rng/seeded-random";
import { aimSpreadOf, createSystems, playerStatsOf } from "./systems";
import type { Entity } from "./world/components";
import { type DomainHolder, type SessionState, type SimContext, type System, freshSession } from "./world/context";
import { PLAYER_SPAWN } from "./content/district-m0";
import type { ChunkDef, DistrictId } from "./content/world-map";
import { IdAllocator, entitySnapshotOf, playerEntity } from "./world/factory";
import { WorldStreamer } from "./world/streaming";
import { bindGround } from "./world/ground";
import { applyCommand } from "./world/command-table";
import { syncPlayerWeapon } from "./world/player-weapon";
import { SIM_DT } from "./step-rate";
import { CROWD_CAP, type CrowdDensity } from "./content/crowd";
import type { TrafficDensity } from "./content/traffic";
import { isMicroKey } from "./world/micro-events";
import { doorSnapshots, restoreDoors } from "./systems/door-system";
import { withAttackLock } from "./world/takedown";
import { withCarry } from "./world/bodies";
import { resumeSession } from "./world/session-resume";
import { reinforcementsSnapshot, restoreReinforcements } from "./world/reinforcements";

export { BREACH_DATAMINE_EDDIES, BREACH_ICEPICK_SECONDS, BREACH_MARK_SECONDS } from "./world/contract-commands";
export { SIM_DT, SIM_HZ } from "./step-rate";

export interface SimulationOptions {
  readonly seed: number;
  readonly bus?: EventBus<DomainEvents>;
  /** The crowd of residents (ADR-0041); none without. Never saved, so it changes no outcome. */
  readonly crowd?: CrowdDensity;
  /** The street's traffic (ADR-0050); the crowd's density by default. Never saved either. */
  readonly traffic?: TrafficDensity;
  /**
   * The chunks of the world; the city's own (WORLD_CHUNKS) by default. Tests and tools give a
   * small world of their own here (ADR-0043: a chunk with terrain and prisms).
   */
  readonly chunks?: readonly ChunkDef[];
  /**
   * The difficulty a new game starts on (ADR-0066); "normal" without. In the domain before the
   * world is built, so the enemies round the start already appear with its health.
   */
  readonly difficulty?: DifficultyProfile;
}

/**
 * The headless game simulation: an ECS world, the domain state and a fixed system order.
 * Talks to the outside world only through the event bus, queued commands and snapshots.
 */
export class Simulation {
  readonly bus: EventBus<DomainEvents>;
  readonly seed: number;
  readonly world: World<Entity>;
  readonly session: SessionState = freshSession();
  private readonly rng: SeededRandom;
  private readonly holder: DomainHolder;
  private readonly systems: readonly System[] = createSystems();
  private readonly commands: GameCommand[] = [];
  readonly streamer: WorldStreamer;
  private tickCount = 0;
  private crowdCap = 0;
  private trafficDensity: TrafficDensity = "off";

  /**
   * Builds the world around `focus`: the player first in id order, then every chunk's content
   * (ids reserved up front, see WorldStreamer), then the targets of an active contract.
   */
  private constructor(seed: number, domain: DomainState, bus: EventBus<DomainEvents>, saved?: SaveSnapshot, chunks?: readonly ChunkDef[]) {
    this.seed = seed;
    this.bus = bus;
    this.rng = new SeededRandom(seed);
    this.holder = { domain, flagsDirty: false };
    this.world = new World<Entity>();
    const ids = new IdAllocator();
    const player = playerEntity(ids.take());
    this.streamer = chunks ? new WorldStreamer(ids, chunks) : new WorldStreamer(ids);
    bindGround(this.world, this.streamer.ground);
    this.streamer.enemyHealth = () => this.holder.domain.difficulty.npcHealth;
    // The people of a job stay in the world after it ends, done or lost, until the next is taken
    // (G-178): the guards of an alarm fight on, an ambush waits by the way out (ADR-0034).
    // An ended one is made with the jobs done when it was taken: its pay counts one more since.
    // Replaced jobs first, as they were taken: their saved people come back with them.
    for (const f of saved?.formerContracts ?? []) this.streamer.restoreFormer(f);
    const active = domain.contracts.active;
    const site = active ? { contract: active, completed: domain.contracts.completed } : saved?.endedContract;
    if (site) this.streamer.registerContract(this.world, domain.flags, site.completed, site.contract);
    const focus = saved?.entities.find((e) => e.key === "player")?.position ?? PLAYER_SPAWN.position;
    this.streamer.loadInitial(this.world, domain.flags, focus, saved?.streaming.loadedChunks ?? [], domain.clock, () => this.world.add(player));
    if (player.combatant) syncPlayerWeapon(domain, player.combatant);
  }

  static create(options: SimulationOptions): Simulation {
    const fresh = createDomainState();
    // A profile out of range is refused, as the `set-difficulty` command refuses it.
    const domain = options.difficulty && isDifficultyProfile(options.difficulty) ? { ...fresh, difficulty: difficultyProfile(options.difficulty) } : fresh;
    const sim = new Simulation(options.seed, domain, options.bus ?? new EventBus<DomainEvents>(), undefined, options.chunks);
    sim.setCrowd(options.crowd ?? "off");
    sim.setTraffic(options.traffic ?? options.crowd ?? "off");
    return sim;
  }

  static fromSnapshot(snapshot: SaveSnapshot, bus?: EventBus<DomainEvents>, crowd: CrowdDensity = "off", traffic: TrafficDensity = crowd): Simulation {
    const sim = new Simulation(snapshot.seed, snapshot.domain, bus ?? new EventBus<DomainEvents>(), snapshot);
    sim.setCrowd(crowd);
    sim.setTraffic(traffic);
    sim.rng.setState(snapshot.rngState);
    sim.tickCount = snapshot.tick;
    sim.streamer.restoreEntities(sim.world, snapshot.domain.flags, snapshot.entities);
    restoreDoors(sim, snapshot.doors ?? []);
    // The heat's reinforcements (G-179), before the body on her shoulder: it may be one of them.
    restoreReinforcements(sim.world, sim.session.watch, snapshot.reinforcements, () => sim.streamer.takeId(), sim.domain.difficulty.npcHealth);
    // The body on her shoulder (ADR-0065) is saved on the body.
    sim.session.carrying = sim.world.with("downed").entities.find((b) => b.downed.carried)?.id ?? null;
    // A profile asked for in the fight still waits for its end (G-171).
    sim.session.pendingDifficulty = snapshot.pendingDifficulty ?? null;
    resumeSession(sim.session, sim.domain, sim.player(), sim.streamer);
    return sim;
  }

  /** How many residents a chunk holds (ADR-0041); takes effect from the next step. */
  setCrowd(density: CrowdDensity): void {
    this.crowdCap = CROWD_CAP[density];
  }

  /** How much traffic drives round the player (ADR-0050); takes effect from the next step. */
  setTraffic(density: TrafficDensity): void {
    this.trafficDensity = density;
  }

  get domain(): DomainState {
    return this.holder.domain;
  }

  get tick(): number {
    return this.tickCount;
  }

  /** Time of day (domain state, advanced every step). */
  get clock(): GameClock {
    return this.holder.domain.clock;
  }

  get rngState(): number {
    return this.rng.getState();
  }

  player(): Entity | undefined {
    return this.world.with("player").first;
  }

  /** Half-angle of the player's aim cone in radians right now (HUD crosshair); 0 without a player. */
  aimSpread(): number {
    const p = this.player();
    return p ? aimSpreadOf(p, playerStatsOf(this.holder.domain)) : 0;
  }

  /** District the player stands in, or null between chunk bounds. */
  get district(): DistrictId | null {
    const p = this.player();
    return p ? this.streamer.districtAt(p.position) : null;
  }

  enqueue(command: GameCommand): void {
    this.commands.push(command);
  }

  /** Advances the simulation by one fixed step of SIM_DT seconds. */
  step(input: InputFrame = EMPTY_INPUT): void {
    const ctx = this.context(withCarry(this.session.carrying, withAttackLock(this.session, input)));
    this.applyCommands(ctx);
    for (const system of this.systems) system.run(ctx);
    this.tickCount += 1;
  }

  /**
   * Runs only the command phase of the next step, now (ADR-0015): the character menu stops the
   * clock, yet what the player equips or uses there shows at once. The context is the one the
   * next step would build (same tick), so the outcome is the same as leaving the commands for
   * that step; menu commands use neither randomness nor time. A replay records them in the
   * frame of the next step, as before.
   */
  applyPendingCommands(): void {
    if (this.commands.length > 0) this.applyCommands(this.context(EMPTY_INPUT));
  }

  private context(input: InputFrame): SimContext {
    return {
      world: this.world,
      state: this.holder,
      session: this.session,
      rng: this.rng,
      seed: this.seed,
      streamer: this.streamer,
      bus: this.bus,
      crowdCap: this.crowdCap,
      traffic: this.trafficDensity,
      dt: SIM_DT,
      tick: this.tickCount,
      input,
    };
  }

  private applyCommands(ctx: SimContext): void {
    for (const cmd of this.commands.splice(0)) applyCommand(ctx, cmd);
  }

  snapshot(narrative: string | null, label: string, objective: string): SaveSnapshot {
    const entities: EntitySnapshot[] = this.streamer.dormantSnapshots().filter((s) => !isMicroKey(s.key));
    // The people of a micro-event are transient (ADR-0034): a save leaves them out.
    for (const e of this.world) if (e.key && !isMicroKey(e.key)) entities.push(entitySnapshotOf({ ...e, key: e.key }));
    // A metro rider is out of the world, already on the destination platform (ADR-0034).
    const rider = this.session.passenger;
    if (rider?.key) entities.push(entitySnapshotOf({ ...rider, key: rider.key }));
    // Sorted by key: world iteration order is not stable across removals.
    entities.sort((a, b) => a.key.localeCompare(b.key));
    const ended = this.holder.domain.contracts.active ? null : this.streamer.registeredContract;
    const former = this.streamer.formerSnapshots(this.world);
    const reinforcements = reinforcementsSnapshot(this.world, this.session.watch);
    return {
      version: SAVE_SCHEMA_VERSION,
      seed: this.seed,
      rngState: this.rng.getState(),
      tick: this.tickCount,
      entities,
      streaming: { loadedChunks: this.streamer.loadedChunks },
      doors: doorSnapshots(this),
      domain: this.holder.domain,
      ...(this.session.pendingDifficulty ? { pendingDifficulty: this.session.pendingDifficulty } : {}),
      ...(ended ? { endedContract: ended } : {}),
      ...(former.length > 0 ? { formerContracts: former } : {}),
      ...(reinforcements ? { reinforcements } : {}),
      narrative,
      meta: { label, objective },
    };
  }
}
