import {
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
} from "@seki/core";
import { World } from "miniplex";
import { SeededRandom } from "./rng/seeded-random";
import { aimSpreadOf, createSystems, playerStatsOf } from "./systems";
import type { Entity } from "./world/components";
import { type DomainHolder, type SessionState, type SimContext, type System, freshSession } from "./world/context";
import { PLAYER_SPAWN } from "./content/district-m0";
import type { DistrictId } from "./content/world-map";
import { IdAllocator, entitySnapshotOf, playerEntity } from "./world/factory";
import { WorldStreamer } from "./world/streaming";
import { applyCommand } from "./world/command-table";
import { syncPlayerWeapon } from "./world/player-weapon";
import { SIM_DT } from "./step-rate";

export { BREACH_DATAMINE_EDDIES, BREACH_ICEPICK_SECONDS, BREACH_MARK_SECONDS } from "./world/contract-commands";
export { SIM_DT, SIM_HZ } from "./step-rate";

export interface SimulationOptions {
  readonly seed: number;
  readonly bus?: EventBus<DomainEvents>;
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

  /**
   * Builds the world around `focus`: the player first in id order, then every chunk's content
   * (ids reserved up front, see WorldStreamer), then the targets of an active contract.
   */
  private constructor(seed: number, domain: DomainState, bus: EventBus<DomainEvents>, saved?: SaveSnapshot) {
    this.seed = seed;
    this.bus = bus;
    this.rng = new SeededRandom(seed);
    this.holder = { domain, flagsDirty: false };
    this.world = new World<Entity>();
    const ids = new IdAllocator();
    const player = playerEntity(ids.take());
    this.streamer = new WorldStreamer(ids);
    const contract = domain.contracts.active;
    if (contract?.status === "active") this.streamer.registerContract(this.world, domain.flags, domain.contracts.completed, contract);
    const focus = saved?.entities.find((e) => e.key === "player")?.position ?? PLAYER_SPAWN.position;
    this.streamer.loadInitial(this.world, domain.flags, focus, saved?.streaming.loadedChunks ?? [], domain.clock, () => this.world.add(player));
    if (player.combatant) syncPlayerWeapon(domain, player.combatant);
  }

  static create(options: SimulationOptions): Simulation {
    return new Simulation(options.seed, createDomainState(), options.bus ?? new EventBus<DomainEvents>());
  }

  static fromSnapshot(snapshot: SaveSnapshot, bus?: EventBus<DomainEvents>): Simulation {
    const sim = new Simulation(snapshot.seed, snapshot.domain, bus ?? new EventBus<DomainEvents>(), snapshot);
    sim.rng.setState(snapshot.rngState);
    sim.tickCount = snapshot.tick;
    sim.streamer.restoreEntities(sim.world, snapshot.domain.flags, snapshot.entities);
    return sim;
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
    const ctx = this.context(input);
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
      dt: SIM_DT,
      tick: this.tickCount,
      input,
    };
  }

  private applyCommands(ctx: SimContext): void {
    for (const cmd of this.commands.splice(0)) applyCommand(ctx, cmd);
  }

  snapshot(narrative: string | null, label: string, objective: string): SaveSnapshot {
    const entities: EntitySnapshot[] = [...this.streamer.dormantSnapshots()];
    for (const e of this.world) if (e.key) entities.push(entitySnapshotOf({ ...e, key: e.key }));
    // Sorted by key: world iteration order is not stable across removals.
    entities.sort((a, b) => a.key.localeCompare(b.key));
    return {
      version: SAVE_SCHEMA_VERSION,
      seed: this.seed,
      rngState: this.rng.getState(),
      tick: this.tickCount,
      entities,
      streaming: { loadedChunks: this.streamer.loadedChunks },
      domain: this.holder.domain,
      narrative,
      meta: { label, objective },
    };
  }
}
