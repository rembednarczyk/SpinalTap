import {
  ACT_ONE_ENDING_FLAG,
  ENDINGS,
  type DomainEvents,
  type DomainState,
  EMPTY_INPUT,
  type EntitySnapshot,
  EventBus,
  type GameCommand,
  type InputFrame,
  type SaveSnapshot,
  SAVE_SCHEMA_VERSION,
  buyCyberware,
  buyItem,
  createDomainState,
  credit,
  generateContract,
  recordChoice,
  resolveEnding,
  setAlias,
  setEnding,
  shopTerms,
} from "@seki/core";
import { World } from "miniplex";
import { SeededRandom } from "./rng/seeded-random";
import { aimSpreadOf, createSystems, statsFor } from "./systems";
import type { Entity } from "./world/components";
import type { DomainHolder, SessionState, SimContext, System } from "./world/context";
import { adjustReputation, applyReputationCause, grantMemory, raiseFlag, raiseProgress } from "./world/domain-ops";
import { PLAYER_SPAWN } from "./content/district-m0";
import type { DistrictId } from "./content/world-map";
import { IdAllocator, entitySnapshotOf, playerEntity } from "./world/factory";
import { WorldStreamer } from "./world/streaming";

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
  readonly session: SessionState = { dialogueActive: false, gameOver: false, focusId: null, lastThreat: null };
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
    this.streamer.loadInitial(this.world, domain.flags, focus, saved?.streaming.loadedChunks ?? [], () => this.world.add(player));
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

  get rngState(): number {
    return this.rng.getState();
  }

  player(): Entity | undefined {
    return this.world.with("player").first;
  }

  /** Half-angle of the player's aim cone in radians right now (HUD crosshair); 0 without a player. */
  aimSpread(): number {
    const p = this.player();
    return p ? aimSpreadOf(p, statsFor(this.holder.domain.character)) : 0;
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
    const ctx: SimContext = {
      world: this.world,
      state: this.holder,
      session: this.session,
      rng: this.rng,
      streamer: this.streamer,
      bus: this.bus,
      dt: SIM_DT,
      tick: this.tickCount,
      input,
    };
    for (const cmd of this.commands.splice(0)) this.apply(ctx, cmd);
    for (const system of this.systems) system.run(ctx);
    this.tickCount += 1;
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

  private apply(ctx: SimContext, cmd: GameCommand): void {
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
      case "buy-cyberware": {
        const domain = this.holder.domain;
        const r = buyCyberware(domain.wallet, domain.character, cmd.cyberwareId, shopTerms(domain.reputation.clinic));
        if (!r.ok) {
          ctx.bus.emit("PurchaseFailed", { reason: r.reason });
          break;
        }
        this.holder.domain = { ...domain, wallet: r.wallet, character: r.character };
        if (r.price > 0) ctx.bus.emit("EddiesChanged", { balance: r.wallet.eddies, delta: -r.price });
        ctx.bus.emit("CyberwareInstalled", { cyberwareId: cmd.cyberwareId, replaced: r.replaced, price: r.price });
        if (r.price > 0) applyReputationCause(ctx, { type: "clinic-purchase", kind: "cyberware" });
        raiseProgress(ctx, "cyberware_installed");
        break;
      }
      case "buy-item": {
        const domain = this.holder.domain;
        const r = buyItem(domain.wallet, domain.inventory, domain.equipment, cmd.itemId, shopTerms(domain.reputation.clinic));
        if (!r.ok) {
          ctx.bus.emit("PurchaseFailed", { reason: r.reason });
          break;
        }
        this.holder.domain = { ...domain, wallet: r.wallet, inventory: r.inventory };
        ctx.bus.emit("EddiesChanged", { balance: r.wallet.eddies, delta: -r.price });
        ctx.bus.emit("ItemBought", { itemId: cmd.itemId, price: r.price });
        applyReputationCause(ctx, { type: "clinic-purchase", kind: "item" });
        break;
      }
      case "accept-contract": {
        const domain = this.holder.domain;
        if (domain.contracts.active) break;
        const contract = generateContract(domain.contracts, this.rng, domain.reputation.fixers);
        this.holder.domain = { ...domain, contracts: { ...domain.contracts, active: contract } };
        this.streamer.registerContract(this.world, this.holder.domain.flags, domain.contracts.completed, contract);
        ctx.bus.emit("ContractAccepted", { contract });
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
        applyReputationCause(ctx, { type: "contract-completed" });
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
      case "resolve-ending": {
        const domain = this.holder.domain;
        if (domain.story.ending) break;
        const ending = resolveEnding(domain.story.choices);
        this.holder.domain = { ...domain, story: setEnding(domain.story, ending) };
        raiseFlag(ctx, ACT_ONE_ENDING_FLAG);
        ctx.bus.emit("EndingReached", { endingId: ending, title: ENDINGS[ending].title });
        break;
      }
    }
  }
}
