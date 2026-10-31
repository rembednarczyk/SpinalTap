import { BUFF_CATALOG, type DomainState, capacityMax, capacityUsed, cooldownRateOf } from "@seki/core";
import { DASH_COOLDOWN } from "@seki/sim";
import { type BuffVm, type CapacityVm, type DashVm, translate } from "@seki/ui";
import type { HudPart, HudPartContext, HudPartFrame, HudPatch } from "./hud-part";

/** The minimap stays zoomed out this long after a dash (ADR-0035). */
export const DASH_ZOOM_SECONDS = 0.8;

/** Seconds of the dash cooldown with the buffs that run now (synthetic coffee shortens it). */
export const dashCooldownSeconds = (domain: DomainState): number => DASH_COOLDOWN / cooldownRateOf(domain.buffs);

export const capacityVm = (domain: DomainState): CapacityVm => ({
  used: capacityUsed(domain.character.cyberware),
  max: capacityMax(domain.contracts.completed, domain.capacityShards),
});

/**
 * The wave 2 body (ADR-0035): implant capacity, buffs and the dash icon, read from the domain
 * each frame so a load shows them as they were; the events add the toasts (a buff taken, a
 * bullet sent back).
 */
export class BodyHud implements HudPart {
  readonly offs: readonly (() => void)[];
  private dashTick: number | null = null;
  private tick = 0;

  constructor(private readonly ctx: HudPartContext) {
    const { bus, hooks, isPlayer } = ctx;
    this.offs = [
      bus.on("BuffApplied", (e) => ctx.toast("system", BUFF_CATALOG[e.buffId].name, `${Math.round(e.duration)} s`)),
      bus.on("Dashed", (e) => {
        if (isPlayer(e.entityId)) this.dashTick = hooks.tick();
      }),
      bus.on("ProjectileReflected", (e) => {
        if (!isPlayer(e.defenderId)) return;
        const locale = ctx.ui.getState().settings.locale;
        ctx.toast("system", translate(locale, "combat.reflected"), translate(locale, "combat.reflectedText"));
      }),
    ];
  }

  /** A dash happened a moment ago: the minimap zooms out. */
  get dashing(): boolean {
    return this.dashTick !== null && (this.tick - this.dashTick) / this.ctx.hooks.ticksPerSecond < DASH_ZOOM_SECONDS;
  }

  frame(f: HudPartFrame): HudPatch {
    this.tick = f.tick;
    const domain = this.ctx.hooks.domain();
    return { capacity: capacityVm(domain), buffs: this.buffVm(domain), dash: this.dashVm(domain, f.tick) };
  }

  reset(): HudPatch {
    this.dashTick = null;
    return { buffs: [], dash: null, capacity: null };
  }

  private buffVm(domain: DomainState): BuffVm[] {
    return domain.buffs
      .filter((b) => b.left > 0)
      .map((b) => ({ id: b.id, name: BUFF_CATALOG[b.id].name, left: Math.ceil(b.left), total: BUFF_CATALOG[b.id].duration }));
  }

  private dashVm(domain: DomainState, tick: number): DashVm | null {
    if (this.dashTick === null) return null;
    const total = dashCooldownSeconds(domain);
    const left = total - (tick - this.dashTick) / this.ctx.hooks.ticksPerSecond;
    return { cooldown: Math.max(0, Math.ceil(left * 10) / 10), total: Math.round(total * 10) / 10 };
  }
}
