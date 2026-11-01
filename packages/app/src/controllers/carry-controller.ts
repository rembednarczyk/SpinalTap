import type { InputFrame } from "@seki/core";
import type { SimRef } from "./shared";

/**
 * Bodies (ADR-0065, stage 3): the interact key, or the touch "Use" button, with a body on the
 * player's shoulder becomes `drop-body` (the simulation hides it when a hiding place is in
 * reach), and on a body the simulation offers `carry-body`; both queued for the very step that
 * reads the key. The simulation checks the body and the hiding place again.
 */
export class CarryController {
  constructor(private readonly sim: SimRef) {}

  /** Called with each step's input, before the step, while the player is in control. */
  input(frame: InputFrame): void {
    if (!frame.interact) return;
    const { carrying, bodyTarget, takedown } = this.sim().session;
    if (carrying !== null) this.sim().enqueue({ type: "drop-body" });
    else if (bodyTarget !== null && takedown === null) this.sim().enqueue({ type: "carry-body" });
  }
}
