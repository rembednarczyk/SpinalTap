import type { EntityId } from "@seki/core";
import { type DisguiseVm, translate } from "@seki/ui";
import type { HudPart, HudPartContext, HudPatch } from "./hud-part";

/**
 * Disguises (ADR-0033, ADR-0035): the role badge by the health bar, read from the domain so a
 * load keeps it; the warning toast when it is blown; who saw through it, for the minimap.
 */
export class DisguiseHud implements HudPart {
  readonly offs: readonly (() => void)[];
  /** Who saw through the disguise; marked as enforcers from then on. */
  private readonly seenBy = new Set<EntityId>();

  constructor(private readonly ctx: HudPartContext) {
    const { bus } = ctx;
    this.offs = [
      bus.on("DisguiseChanged", (e) => {
        if (e.role === null) this.seenBy.clear();
      }),
      bus.on("DisguiseBlown", (e) => {
        this.seenBy.add(e.observerId);
        const locale = ctx.ui.getState().settings.locale;
        ctx.toast("heat", translate(locale, "disguise.blown"), translate(locale, "disguise.blownText", { disguise: translate(locale, `disguise.${e.role}`) }));
      }),
      bus.on("EntityKilled", (e) => this.seenBy.delete(e.entityId)),
    ];
  }

  /** The player passes for someone: enforcers matter and show on the minimap. */
  get disguised(): boolean {
    return this.ctx.hooks.domain().disguise.role !== null;
  }

  /** Observers known to see through the disguise (from `DisguiseBlown`). */
  get enforcers(): ReadonlySet<EntityId> {
    return this.seenBy;
  }

  frame(): HudPatch {
    const { role, blown } = this.ctx.hooks.domain().disguise;
    const vm: DisguiseVm | null = role ? { role, label: translate(this.ctx.ui.getState().settings.locale, `disguise.${role}`), blown } : null;
    return { disguise: vm };
  }

  reset(): HudPatch {
    this.seenBy.clear();
    return { disguise: null };
  }
}
