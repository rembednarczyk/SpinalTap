import type { AttributeId, GameCommand, PerkId } from "@seki/core";
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
 * Character progression from the sheet (ADR-0059, stages 2 and 3): a point spent on an attribute
 * is the `spend-attribute-point` command, a perk rank the `spend-perk-point` one. The clock stands while the menu is open, so its command phase
 * runs now and the sheet shows the new value in this frame, like the menu's own actions.
 */
export class ProgressionController implements ProgressionIntents {
  constructor(private readonly deps: ProgressionControllerDeps) {}

  spendAttributePoint(attribute: AttributeId): void {
    this.spend({ type: "spend-attribute-point", attribute });
  }

  /** A rank of a perk (stage 3), the same way. */
  spendPerkPoint(perk: PerkId): void {
    this.spend({ type: "spend-perk-point", perk });
  }

  private spend(command: GameCommand): void {
    if (!this.deps.menuOpen()) return;
    const sim = this.deps.sim();
    sim.enqueue(command);
    sim.applyPendingCommands();
    this.deps.syncHud();
  }
}
