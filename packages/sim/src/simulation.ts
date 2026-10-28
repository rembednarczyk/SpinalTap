import {
  ACT_ONE_ENDING_FLAG,
  ACT_TWO_ENDINGS,
  ACT_TWO_ENDING_FLAG,
  ENDINGS,
  endingFlag,
  resolveActTwoEnding,
  setActTwoEnding,
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
  SECONDS_PER_MINUTE,
  advanceClock,
  createDomainState,
  PROTECTEE_KEY,
  contractKind,
  credit,
  generateContractOfKind,
  hasFlag,
  recordChoice,
  resolveEnding,
  setAlias,
  setEnding,
} from "@seki/core";
import { World } from "miniplex";
import { SeededRandom } from "./rng/seeded-random";
import { aimSpreadOf, createSystems, playerStatsOf } from "./systems";
import type { Entity } from "./world/components";
import type { DomainHolder, SessionState, SimContext, System } from "./world/context";
import { deadFlag } from "./systems/death-system";
import { adjustReputation, applyReputationCause, clearContract, grantMemory, raiseFlag, raiseProgress } from "./world/domain-ops";
import { PLAYER_SPAWN } from "./content/district-m0";
import { oyajiStallOpen } from "./content/schedules";
import type { DistrictId } from "./content/world-map";
import { IdAllocator, entitySnapshotOf, playerEntity } from "./world/factory";
import { WorldStreamer } from "./world/streaming";
import { applyItemCommand, isItemCommand } from "./world/item-commands";
import { applyTradeCommand, isTradeCommand } from "./world/trade-commands";
import { syncPlayerWeapon } from "./world/player-weapon";
import { inCreationOrder } from "./world/ordering";
import { placeOnSchedule } from "./world/schedule";

export const SIM_HZ = 60;

export const SIM_DT = 1 / SIM_HZ;

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
  readonly session: SessionState = { dialogueActive: false, gameOver: false, focusId: null, focusPrompt: null, lastThreat: null };
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
    for (const cmd of this.commands.splice(0)) this.apply(ctx, cmd);
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

  /**
   * Closes act II (ADR-0023): only after act I and the archive choice, once. The ending moves the
   * factions it names and may bring a memory, whose flashback then plays like any other.
   */
  private resolveActTwo(ctx: SimContext): void {
    const domain = this.holder.domain;
    const ending = resolveActTwoEnding(domain.story.choices);
    if (!domain.story.ending || domain.story.act2Ending || !ending) return;
    this.holder.domain = { ...domain, story: setActTwoEnding(domain.story, ending) };
    const def = ACT_TWO_ENDINGS[ending];
    for (const { faction, delta } of def.reputation) adjustReputation(ctx, faction, delta);
    if ("memory" in def) grantMemory(ctx, def.memory);
    raiseFlag(ctx, ACT_TWO_ENDING_FLAG);
    raiseFlag(ctx, endingFlag(ending));
    ctx.bus.emit("EndingReached", { act: 2, endingId: ending, title: def.title });
  }

  /** Oyaji has patched himself up since the last raid (only matters while he is in the world). */
  private patchUpProtectee(): void {
    for (const e of this.world.with("health")) if (e.key === PROTECTEE_KEY) e.health = { ...e.health, current: e.health.max };
  }

  private apply(ctx: SimContext, cmd: GameCommand): void {
    if (isItemCommand(cmd)) {
      applyItemCommand(ctx, cmd);
      return;
    }
    if (isTradeCommand(cmd)) {
      applyTradeCommand(ctx, cmd);
      return;
    }
    switch (cmd.type) {
      case "set-flag":
        raiseFlag(ctx, cmd.flag);
        break;
      case "change-reputation":
        adjustReputation(ctx, cmd.faction, cmd.delta);
        break;
      case "unlock-memory":
        grantMemory(ctx, cmd.memoryId);
        break;
      case "set-alias":
        this.holder.domain = { ...this.holder.domain, character: setAlias(this.holder.domain.character, cmd.alias) };
        break;
      case "end-dialogue":
        this.session.dialogueActive = false;
        break;
      case "accept-contract": {
        const domain = this.holder.domain;
        const kind = cmd.kind ?? "eliminate";
        if (domain.contracts.active) break;
        // Nobody to protect once Oyaji is dead, and Hebi raid his stall only while it is open.
        if (kind === "protect" && (hasFlag(domain.flags, deadFlag(PROTECTEE_KEY)) || !oyajiStallOpen(domain.clock))) break;
        const contract = generateContractOfKind(
          kind,
          { log: domain.contracts, reputation: domain.reputation, flags: domain.flags, tick: ctx.tick, ticksPerSecond: SIM_HZ },
          this.rng,
        );
        this.holder.domain = { ...domain, contracts: { ...domain.contracts, active: contract } };
        if (kind === "protect") this.patchUpProtectee();
        this.streamer.registerContract(this.world, this.holder.domain.flags, domain.contracts.completed, contract);
        ctx.bus.emit("ContractAccepted", { contract });
        break;
      }
      case "deliver-contract": {
        const contract = this.holder.domain.contracts.active;
        if (contract?.status !== "active" || contractKind(contract) !== "delivery") break;
        clearContract(ctx);
        break;
      }
      case "complete-contract": {
        const domain = this.holder.domain;
        const contract = domain.contracts.active;
        if (contract?.status !== "cleared") break;
        const paid = credit(domain.wallet, contract.reward);
        this.holder.domain = {
          ...domain,
          wallet: paid.ok ? paid.wallet : domain.wallet,
          contracts: { active: null, completed: domain.contracts.completed + 1 },
        };
        if (paid.ok) ctx.bus.emit("EddiesChanged", { balance: paid.wallet.eddies, delta: contract.reward });
        applyReputationCause(ctx, { type: "contract-completed", kind: contractKind(contract) });
        ctx.bus.emit("ContractCompleted", { contract, reward: contract.reward });
        raiseProgress(ctx, "contract_completed");
        break;
      }
      case "story-choice": {
        const story = recordChoice(this.holder.domain.story, cmd.choice, cmd.option);
        if (story === this.holder.domain.story) break;
        this.holder.domain = { ...this.holder.domain, story };
        ctx.bus.emit("StoryChoiceMade", { choice: cmd.choice, option: cmd.option });
        break;
      }
      case "wait": {
        const minutes = Math.floor(cmd.minutes);
        if (!(minutes >= 1)) break;
        const clock = advanceClock(this.holder.domain.clock, minutes * SECONDS_PER_MINUTE);
        this.holder.domain = { ...this.holder.domain, clock };
        // A cut, not a fast-forward: everyone on a daily plan is where it says at the new time.
        for (const e of inCreationOrder(this.world.with("schedule"))) {
          if (!e.ai?.alerted) placeOnSchedule(e, e.schedule.def, clock);
        }
        ctx.bus.emit("TimeSkipped", { minutes, clock });
        break;
      }
      case "resolve-ending": {
        if (cmd.act === 2) {
          this.resolveActTwo(ctx);
          break;
        }
        const domain = this.holder.domain;
        if (domain.story.ending) break;
        const ending = resolveEnding(domain.story.choices);
        this.holder.domain = { ...domain, story: setEnding(domain.story, ending) };
        raiseFlag(ctx, ACT_ONE_ENDING_FLAG);
        raiseFlag(ctx, endingFlag(ending));
        ctx.bus.emit("EndingReached", { act: 1, endingId: ending, title: ENDINGS[ending].title });
        break;
      }
    }
  }
}
