/**
 * A finger lifted after a touch press makes the browser fire a compatibility click at that spot.
 * When the press opened something (a dialogue, a shop, a loot panel) the pad button is gone by
 * then, so the click lands on whatever appeared under the thumb, often a dialogue choice that
 * ends the talk. A handler on the button cannot stop it: the button is no longer in the tree.
 *
 * `swallowNextClick` listens on the window in the capture phase and eats the first click that
 * arrives within `ms`, wherever it lands. A long press makes no click, and the listener lapses.
 */
export const GHOST_CLICK_MS = 700;

export const swallowNextClick = (target: Window = window, now: () => number = () => performance.now(), ms = GHOST_CLICK_MS): void => {
  const until = now() + ms;
  const eat = (e: Event) => {
    target.removeEventListener("click", eat, true);
    if (now() > until) return;
    e.preventDefault();
    e.stopPropagation();
  };
  target.addEventListener("click", eat, true);
  setTimeout(() => target.removeEventListener("click", eat, true), ms);
};
