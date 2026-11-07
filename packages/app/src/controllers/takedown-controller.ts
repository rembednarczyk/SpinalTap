import type { InputFrame } from "@seki/core";
import type { SimRef } from "./shared";

/**
 * Takedowns (ADR-0065, ADR-0075): the interact key, or the touch "Use" button, on a target the
 * simulation offers becomes the `takedown` command, a grab that waits for the choice. In the
 * grab the interact key again knocks the target out and a fresh press of the attack button (a
 * mouse click, the pad's trigger, the touch fire button) kills it: `takedown-choose`. Each is
 * queued for the very step that reads the key; the simulation checks the target and the grab.
 */
export class TakedownController {
  /** The attack button in the last frame: only a press made in the grab chooses the kill. */
  private fireWas = false;

  constructor(private readonly sim: SimRef) {}

  /** Called with each step's input, before the step, while the player is in control. */
  input(frame: InputFrame): void {
    const pressed = frame.fire && !this.fireWas;
    this.fireWas = frame.fire;
    const { takedown, takedownTarget } = this.sim().session;
    if (takedown?.phase === "grab") {
      if (frame.interact) this.sim().enqueue({ type: "takedown-choose", lethal: false });
      else if (pressed) this.sim().enqueue({ type: "takedown-choose", lethal: true });
      return;
    }
    if (frame.interact && takedownTarget !== null && takedown === null) this.sim().enqueue({ type: "takedown" });
  }
}
