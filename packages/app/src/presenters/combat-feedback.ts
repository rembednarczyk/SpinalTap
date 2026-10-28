import type { EntityId } from "@seki/core";
import { type DamageNumberVm, patchUi } from "@seki/ui";
import type { HudPart, HudPartContext, HudPatch } from "./hud-part";

/** A hit by the player keeps the HUD in combat this long. */
export const COMBAT_SECONDS = 5;
const NUMBER_SECONDS = 0.9;
const TOTAL_SECONDS = 1.5;
const NUMBER_LIMIT = 6;

interface DamageEntry {
  id: number;
  target: EntityId;
  amount: number;
  critical: boolean;
  rev: number;
  /** Tick of the last hit it counts. */
  tick: number;
}

/** Combat feedback of wave 1 (ADR-0028): damage numbers, the kill marker, and whether the player is fighting. */
export class CombatFeedback implements HudPart {
  readonly offs: readonly (() => void)[];
  private numbers: DamageEntry[] = [];
  private numberSeq = 0;
  private lastHitTarget: EntityId | null = null;
  private lastHitTick = -Infinity;

  constructor(private readonly ctx: HudPartContext) {
    const { bus, ui, hooks, isPlayer } = ctx;
    this.offs = [
      bus.on("EntityKilled", (e) => {
        // The killing blow came from the player this very step: the kill marker.
        if (e.entityId === this.lastHitTarget && this.lastHitTick === hooks.tick()) {
          patchUi(ui, { hitMarker: ui.getState().hitMarker + 1, hitKind: "kill" });
        }
      }),
      bus.on("DamageDealt", (e) => {
        if (!isPlayer(e.sourceId) || isPlayer(e.targetId)) return;
        this.lastHitTarget = e.targetId;
        this.lastHitTick = hooks.tick();
        this.addDamage(e.targetId, e.amount, e.critical);
      }),
    ];
  }

  /** The player hit someone within the last few seconds. */
  get fighting(): boolean {
    return this.ctx.hooks.tick() - this.lastHitTick < COMBAT_SECONDS * this.ctx.hooks.ticksPerSecond;
  }

  /** Damage numbers fade after a moment; a running total once the target is left alone. */
  expire(tick: number): void {
    const keep = this.ctx.hooks.damageMode() === "total" ? TOTAL_SECONDS : NUMBER_SECONDS;
    const alive = this.numbers.filter((n) => tick - n.tick < keep * this.ctx.hooks.ticksPerSecond);
    if (alive.length === this.numbers.length) return;
    this.numbers = alive;
    this.pushNumbers();
  }

  reset(): HudPatch {
    this.numbers = [];
    this.lastHitTarget = null;
    this.lastHitTick = -Infinity;
    return { damageNumbers: [] };
  }

  private addDamage(target: EntityId, amount: number, critical: boolean): void {
    const mode = this.ctx.hooks.damageMode();
    if (mode === "off") return;
    const tick = this.ctx.hooks.tick();
    const open = mode === "total" ? this.numbers.find((n) => n.target === target) : undefined;
    if (open) {
      open.amount += amount;
      open.critical ||= critical;
      open.rev += 1;
      open.tick = tick;
    } else {
      this.numbers = [...this.numbers, { id: ++this.numberSeq, target, amount, critical, rev: 0, tick }].slice(-NUMBER_LIMIT);
    }
    this.pushNumbers();
  }

  private pushNumbers(): void {
    const vm: DamageNumberVm[] = this.numbers.map((n) => ({ id: n.id, amount: n.amount, critical: n.critical, rev: n.rev }));
    patchUi(this.ctx.ui, { damageNumbers: vm });
  }
}
