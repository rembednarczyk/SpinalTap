import type { DisguiseRole, EntityId } from "@seki/core";
import type { DisguiseVm } from "@seki/ui";
import type { HudPart, HudPartContext, HudPatch } from "./hud-part";

export const DISGUISE_LABELS: Readonly<Record<DisguiseRole, string>> = {
  hebi: "Przebranie: Hebi",
  tessen_guard: "Przebranie: ochrona Tessen",
  tessen_staff: "Przebranie: obsługa Tessen",
};

/**
 * Disguises (ADR-0032, ADR-0035): the role badge by the health bar, the enforcers who can see
 * through it (on the minimap) and the warning when the disguise is blown.
 */
export class DisguiseHud implements HudPart {
  readonly offs: readonly (() => void)[];
  private role: DisguiseRole | null = null;
  private blown = false;
  /** Who saw through the disguise; marked as enforcers from then on. */
  private readonly seenBy = new Set<EntityId>();

  constructor(ctx: HudPartContext) {
    const { bus } = ctx;
    this.offs = [
      bus.on("DisguiseChanged", (e) => {
        this.role = e.role;
        this.blown = false;
        if (e.role === null) this.seenBy.clear();
      }),
      bus.on("DisguiseBlown", (e) => {
        this.blown = true;
        this.seenBy.add(e.observerId);
        ctx.toast("heat", "Przykrywka spalona", `${DISGUISE_LABELS[e.role]}: ktoś cię rozpoznał`);
      }),
      bus.on("EntityKilled", (e) => this.seenBy.delete(e.entityId)),
    ];
  }

  /** The player passes for someone: enforcers matter and show on the minimap. */
  get disguised(): boolean {
    return this.role !== null;
  }

  /** Observers known to see through the disguise (from `DisguiseBlown`). */
  get enforcers(): ReadonlySet<EntityId> {
    return this.seenBy;
  }

  frame(): HudPatch {
    const vm: DisguiseVm | null = this.role ? { role: this.role, label: DISGUISE_LABELS[this.role], blown: this.blown } : null;
    return { disguise: vm };
  }

  reset(): HudPatch {
    this.role = null;
    this.blown = false;
    this.seenBy.clear();
    return { disguise: null };
  }
}
