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
} from "@seki/core";
import type { World } from "miniplex";
import { SeededRandom } from "./rng/seeded-random";
import { createSystems } from "./systems";
import type { Entity } from "./world/components";
import type { DomainHolder, SessionState, SimContext, System } from "./world/context";
import { adjustReputation, grantMemory, raiseFlag, raiseProgress } from "./world/domain-ops";
import { type IdAllocator, createDistrictWorld, spawnContractTargets } from "./world/factory";

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
  readonly session: SessionState = { dialogueActive: false, gameOver: false, focusId: null };
  private readonly rng: SeededRandom;
  private readonly holder: DomainHolder;
  private readonly systems: readonly System[] = createSystems();
  private readonly commands: GameCommand[] = [];
  private readonly ids: IdAllocator;
  private tickCount = 0;

  private constructor(seed: number, domain: DomainState, bus: EventBus<DomainEvents>) {
    this.seed = seed;
    this.bus = bus;
    this.rng = new SeededRandom(seed);
    this.holder = { domain, flagsDirty: false };
    const built = createDistrictWorld(domain);
    this.world = built.world;
    this.ids = built.ids;
  }

  static create(options: SimulationOptions): Simulation {
    return new Simulation(options.seed, createDomainState(), options.bus ?? new EventBus<DomainEvents>());
  }

  static fromSnapshot(snapshot: SaveSnapshot, bus?: EventBus<DomainEvents>): Simulation {
    const sim = new Simulation(snapshot.seed, snapshot.domain, bus ?? new EventBus<DomainEvents>());
    sim.rng.setState(snapshot.rngState);
    sim.tickCount = snapshot.tick;
    const byKey = new Map(snapshot.entities.map((e) => [e.key, e]));
    for (const e of sim.world) {
      const s = e.key ? byKey.get(e.key) : undefined;
      if (!s) continue;
      e.position = s.position;
      e.prevPosition = s.position;
      e.yaw = s.yaw;
      e.prevYaw = s.yaw;
      e.pitch = s.pitch;
      if (e.health && s.hp !== null) e.health = { ...e.health, current: s.hp };
      if (e.combatant) e.combatant.cooldown = s.cooldown;
      if (e.ai) e.ai.alerted = s.alerted;
    }
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
    const entities: EntitySnapshot[] = [];
    // Sorted by key: world iteration order is not stable across removals.
    for (const e of [...this.world].sort((a, b) => (a.key ?? "").localeCompare(b.key ?? ""))) {
      if (!e.key) continue;
      entities.push({
        key: e.key,
        position: e.position,
        yaw: e.yaw,
        pitch: e.pitch,
        hp: e.health?.current ?? null,
        cooldown: e.combatant?.cooldown ?? 0,
        alerted: e.ai?.alerted ?? false,
      });
    }
    return {
      version: SAVE_SCHEMA_VERSION,
      seed: this.seed,
      rngState: this.rng.getState(),
      tick: this.tickCount,
      entities,
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
        const r = buyCyberware(domain.wallet, domain.character, cmd.cyberwareId);
        if (!r.ok) {
          ctx.bus.emit("PurchaseFailed", { reason: r.reason });
          break;
        }
        this.holder.domain = { ...domain, wallet: r.wallet, character: r.character };
        if (r.price > 0) ctx.bus.emit("EddiesChanged", { balance: r.wallet.eddies, delta: -r.price });
        ctx.bus.emit("CyberwareInstalled", { cyberwareId: cmd.cyberwareId, replaced: r.replaced, price: r.price });
        raiseProgress(ctx, "cyberware_installed");
        break;
      }
      case "buy-item": {
        const domain = this.holder.domain;
        const r = buyItem(domain.wallet, domain.inventory, cmd.itemId);
        if (!r.ok) {
          ctx.bus.emit("PurchaseFailed", { reason: r.reason });
          break;
        }
        this.holder.domain = { ...domain, wallet: r.wallet, inventory: r.inventory };
        ctx.bus.emit("EddiesChanged", { balance: r.wallet.eddies, delta: -r.price });
        ctx.bus.emit("ItemBought", { itemId: cmd.itemId, price: r.price });
        break;
      }
      case "accept-contract": {
        const domain = this.holder.domain;
        if (domain.contracts.active) break;
        const contract = generateContract(domain.contracts, this.rng, domain.reputation.fixers);
        this.holder.domain = { ...domain, contracts: { ...domain.contracts, active: contract } };
        spawnContractTargets(this.world, this.ids, this.holder.domain, contract);
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
        adjustReputation(ctx, "fixers", 3);
        adjustReputation(ctx, "hebi", -5);
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
