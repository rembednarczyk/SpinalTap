import type { Screen } from "@seki/ui";

/** What the pointer lock follows: the screen, the browser input and the user gesture (main.tsx). */
export interface PointerFocusDeps {
  readonly screen: () => Screen;
  /** The game reads the mouse and keys (`BrowserInput.enabled`). */
  readonly setEnabled: (on: boolean) => void;
  readonly lock: () => void;
  readonly release: () => void;
  readonly touch: boolean;
  /** A user gesture is under way (`navigator.userActivation.isActive`); undefined where unknown. */
  readonly gesture: () => boolean | undefined;
}

/**
 * `SessionDeps.onFocusChange` for the browser: the pointer locks while the player is in control
 * and is let go for panels and menus. Leaving the loading screen (ADR-0057) is the one case
 * without the click: the game can start long after it, and a lock asked for without a gesture is
 * refused for good (`BrowserInput.lockUnavailable`), so the next click on the game takes it
 * instead. A panel closed with Esc locks again at once, as before.
 */
export const pointerFocus = (deps: PointerFocusDeps): ((wantsPointer: boolean) => void) => {
  let last = deps.screen();
  return (wantsPointer) => {
    const screen = deps.screen();
    const fromLoading = last === "loading" && screen === "playing";
    last = screen;
    deps.setEnabled(wantsPointer);
    if (deps.touch) return;
    if (!wantsPointer) deps.release();
    else if (!fromLoading || deps.gesture() !== false) deps.lock();
  };
};
