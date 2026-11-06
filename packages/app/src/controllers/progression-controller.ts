import type { AttributeId } from "@seki/core";
import type { ProgressionIntents } from "@seki/ui";
import type { SimRef } from "./shared";

export interface ProgressionControllerDeps {
  readonly sim: SimRef;
  /** The character menu is open: the sheet is where the points are spent. */
  readonly menuOpen: () => boolean;
  /** Pushes the HUD (and the sheet's numbers) after the command. */
  readonly syncHud: () => void;
}

/**
 * Character progression from the sheet (ADR-0059, stage 2): a point spent on an attribute is the
 * `spend-attribute-point` command. The clock stands while the menu is open, so its command phase
 * runs now and the sheet shows the new value in this frame, like the menu's own actions.
 */
export class ProgressionController implements ProgressionIntents {
  constructor(private readonly deps: ProgressionControllerDeps) {}

  spendAttributePoint(attribute: AttributeId): void {
    if (!this.deps.menuOpen()) return;
    const sim = this.deps.sim();
    sim.enqueue({ type: "spend-attribute-point", attribute });
    sim.applyPendingCommands();
    this.deps.syncHud();
  }
}
