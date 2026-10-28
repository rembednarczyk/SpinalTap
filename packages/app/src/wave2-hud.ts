import type { DomainEvents, EntityId, EventBus } from "@seki/core";
import type { Entity } from "@seki/sim";
import { type UiState, type UiStore, patchUi } from "@seki/ui";
import { BodyHud } from "./presenters/body-hud";
import { ContractIntel } from "./presenters/contract-intel";
import { DisguiseHud } from "./presenters/disguise-hud";
import { type HudPart, type HudPatch, type Wave1Hooks, createReuse, hudPartContext } from "./presenters/hud-part";

/**
 * Presentation of wave 2 (ADR-0035): the body (capacity, buffs, the dash, a reflected bullet),
 * disguises and contract hooks, each a presenter of its own, like the wave 1 HUD. The metro and
 * the radio are controllers, since the player acts on them.
 */
export class Wave2Hud {
  private readonly body: BodyHud;
  private readonly disguise: DisguiseHud;
  private readonly parts: readonly HudPart[];
  private readonly reuse = createReuse();

  constructor(
    bus: EventBus<DomainEvents>,
    private readonly ui: UiStore,
    private readonly hooks: Wave1Hooks,
  ) {
    const ctx = hudPartContext(bus, ui, hooks);
    this.body = new BodyHud(ctx);
    this.disguise = new DisguiseHud(ctx);
    this.parts = [this.body, this.disguise, new ContractIntel(ctx)];
  }

  /** A dash a moment ago (the minimap zooms out). */
  get dashing(): boolean {
    return this.body.dashing;
  }

  /** Enforcers to mark on the minimap; none while the player wears no disguise. */
  get enforcers(): ReadonlySet<EntityId> {
    return this.disguise.disguised ? this.disguise.enforcers : new Set();
  }

  get disguised(): boolean {
    return this.disguise.disguised;
  }

  dispose(): void {
    for (const part of this.parts) for (const off of part.offs) off();
  }

  reset(): void {
    this.reuse.clear();
    const patch: HudPatch = {};
    for (const part of this.parts) Object.assign(patch, part.reset());
    patchUi(this.ui, patch);
  }

  sync(player: Entity | undefined, busy: boolean, calm: boolean): Partial<UiState> {
    const tick = this.hooks.tick();
    const out: HudPatch = {};
    const frame = { tick, found: new Map(), player, busy, calm };
    for (const part of this.parts) Object.assign(out, part.frame?.(frame));
    return this.reuse.apply(out);
  }
}
