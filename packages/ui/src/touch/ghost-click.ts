/**
 * A finger lifted after a touch press makes the browser fire a compatibility click at that spot.
 * When the press opened something (a dialogue, a shop, a loot panel) the pad button is gone by
 * then, so the click lands on whatever appeared under the thumb, often a dialogue choice that
 * ends the talk. A handler on the button cannot stop it: the button is no longer in the tree.
 *
 * `swallowNextClick` listens on the window in the capture phase and eats the first click that
 * arrives within `ms`, wherever it lands. A long press makes no click, and the listener lapses.
 * It also lapses on the next press: a ghost click never follows one, but a real tap does, and
 * when the pad's touchend already cancelled the ghost click, the first real tap on the new
 * panel would otherwise be eaten.
 */
export const GHOST_CLICK_MS = 700;

export const swallowNextClick = (target: Window = window, now: () => number = () => performance.now(), ms = GHOST_CLICK_MS): void => {
  const until = now() + ms;
  const lapse = () => {
    target.removeEventListener("click", eat, true);
    target.removeEventListener("pointerdown", lapse, true);
  };
  const eat = (e: Event) => {
    lapse();
    if (now() > until) return;
    e.preventDefault();
    e.stopPropagation();
  };
  target.addEventListener("click", eat, true);
  target.addEventListener("pointerdown", lapse, true);
  setTimeout(lapse, ms);
};
