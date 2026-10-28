import type { InputFrame } from "@seki/core";
import type { TouchIntents } from "@seki/ui";

/**
 * Touch actions the virtual pad does not carry yet (ADR-0035): the dash button of the action
 * arc goes into the next input frame here, as the touch scanner does in the hack controller.
 * Once the engine's `VirtualPad` has a dash button, this becomes a plain pad press.
 */
export class TouchController implements TouchIntents {
  private dash = false;

  touchDash(): void {
    this.dash = true;
  }

  /** The frame with a pending touch dash merged in (an edge: one step only). */
  withTouch(input: InputFrame): InputFrame {
    if (!this.dash) return input;
    this.dash = false;
    return input.dash ? input : { ...input, dash: true };
  }

  reset(): void {
    this.dash = false;
  }
}
