import type { InputFrame } from "@seki/core";
import type { SimRef } from "./shared";

/**
 * Takedowns (ADR-0065): the interact key, or the touch "Use" button, on a target the simulation
 * offers becomes the `takedown` command, queued for the very step that reads the key. The
 * variant is the default for now (knock out); holding the attack button to the end kills, and
 * the simulation reads that from the input itself. The simulation checks the target again.
 */
export class TakedownController {
  constructor(private readonly sim: SimRef) {}

  /** Called with each step's input, before the step, while the player is in control. */
  input(frame: InputFrame): void {
    if (!frame.interact) return;
    const { takedown, takedownTarget } = this.sim().session;
    if (takedownTarget !== null && takedown === null) this.sim().enqueue({ type: "takedown", lethal: false });
  }
}
