import type { BuffId } from "@seki/core";
import { type BuffVm, type DashVm, patchUi } from "@seki/ui";
import type { HudPart, HudPartContext, HudPartFrame, HudPatch } from "./hud-part";

/**
 * Dash cooldown in seconds, for the HUD icon only (the simulation enforces its own).
 * TODO(core): read the cooldown from core once sim A exports it with the legs cyberware.
 */
export const DASH_COOLDOWN_SECONDS = 1.2;
/** The minimap stays zoomed out this long after a dash (ADR-0035). */
export const DASH_ZOOM_SECONDS = 0.8;

export const BUFF_NAMES: Readonly<Record<BuffId, string>> = {
  regen: "Regeneracja",
  quick_cooldown: "Szybkie odnowienie",
  steady: "Pewna ręka",
};

interface Buff {
  readonly until: number;
  readonly total: number;
}

/** The wave 2 body (ADR-0035): implant capacity, buffs from food, the dash icon and a reflected bullet. */
export class BodyHud implements HudPart {
  readonly offs: readonly (() => void)[];
  private readonly buffs = new Map<BuffId, Buff>();
  private dashTick: number | null = null;
  private tick = 0;

  constructor(private readonly ctx: HudPartContext) {
    const { bus, ui, hooks, isPlayer } = ctx;
    this.offs = [
      bus.on("CyberwareCapacityChanged", (e) => patchUi(ui, { capacity: { used: e.used, max: e.max } })),
      bus.on("BuffApplied", (e) => {
        this.buffs.set(e.buffId, { until: hooks.tick() + Math.ceil(e.duration * hooks.ticksPerSecond), total: Math.round(e.duration) });
        ctx.toast("system", BUFF_NAMES[e.buffId], `${Math.round(e.duration)} s`);
      }),
      bus.on("BuffEnded", (e) => this.buffs.delete(e.buffId)),
      bus.on("Dashed", (e) => {
        if (isPlayer(e.entityId)) this.dashTick = hooks.tick();
      }),
      bus.on("ProjectileReflected", (e) => {
        if (isPlayer(e.defenderId)) ctx.toast("system", "Pocisk odbity", "Ostrze odesłało kulę do strzelca");
      }),
    ];
  }

  /** A dash happened a moment ago: the minimap zooms out. */
  get dashing(): boolean {
    return this.dashTick !== null && (this.tick - this.dashTick) / this.ctx.hooks.ticksPerSecond < DASH_ZOOM_SECONDS;
  }

  frame(f: HudPartFrame): HudPatch {
    this.tick = f.tick;
    return { buffs: this.buffVm(f.tick), dash: this.dashVm(f.tick) };
  }

  reset(): HudPatch {
    this.buffs.clear();
    this.dashTick = null;
    return { buffs: [], dash: null, capacity: null };
  }

  private buffVm(tick: number): BuffVm[] {
    const out: BuffVm[] = [];
    for (const [id, b] of this.buffs) {
      const left = Math.ceil((b.until - tick) / this.ctx.hooks.ticksPerSecond);
      if (left > 0) out.push({ id, name: BUFF_NAMES[id], left, total: b.total });
    }
    return out;
  }

  private dashVm(tick: number): DashVm | null {
    if (this.dashTick === null) return null;
    const left = DASH_COOLDOWN_SECONDS - (tick - this.dashTick) / this.ctx.hooks.ticksPerSecond;
    return { cooldown: Math.max(0, Math.ceil(left * 10) / 10), total: DASH_COOLDOWN_SECONDS };
  }
}
