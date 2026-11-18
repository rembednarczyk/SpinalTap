/**
 * A finger lifted after a touch press makes the browser fire a compatibility click at that spot.
 * When the press opened something (a dialogue, a shop, a loot panel) the pad button is gone by
 * then, so the click lands on whatever appeared under the thumb, often a dialogue choice that
 * ends the talk. A handler on the button cannot stop it: the button is no longer in the tree.
 *
 * `swallowNextClick` listens on the window in the capture phase and eats the first click that
 * arrives within `ms`, wherever it lands. Given the press's `pointerId`, the window runs from
 * when that finger comes up, however long it was held (G-091: a hold of a second opened the
 * talk past a window counted from the press, and the click on lifting picked a choice). A long
 * press may make no click, and the listener lapses. It also lapses on another finger's press: a
 * ghost click never follows one, but a real tap does, and when the pad's touchend already
 * cancelled the ghost click, the first real tap on the new panel would otherwise be eaten.
 */
export const GHOST_CLICK_MS = 700;

/** However long a finger is held, the guard goes after this (a lost pointerup must not eat taps for good). */
const LONGEST_HOLD_MS = 10_000;

export const swallowNextClick = (target: Window = window, now: () => number = () => performance.now(), ms = GHOST_CLICK_MS, pointerId: number | null = null): void => {
  let until = now() + (pointerId === null ? ms : LONGEST_HOLD_MS);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let held = pointerId !== null;
  const lapse = () => {
    clearTimeout(timer);
    target.removeEventListener("click", eat, true);
    target.removeEventListener("pointerdown", other, true);
    target.removeEventListener("pointerup", lifted, true);
    target.removeEventListener("pointercancel", lifted, true);
  };
  const eat = (e: Event) => {
    lapse();
    if (now() > until) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const other = (e: Event) => {
    if (!held || (e as PointerEvent).pointerId !== pointerId) lapse();
  };
  const lifted = (e: Event) => {
    if ((e as PointerEvent).pointerId !== pointerId) return;
    held = false;
    target.removeEventListener("pointerup", lifted, true);
    target.removeEventListener("pointercancel", lifted, true);
    until = now() + ms;
    clearTimeout(timer);
    timer = setTimeout(lapse, ms);
  };
  target.addEventListener("click", eat, true);
  target.addEventListener("pointerdown", other, true);
  timer = setTimeout(lapse, pointerId === null ? ms : LONGEST_HOLD_MS);
  if (pointerId !== null) {
    target.addEventListener("pointerup", lifted, true);
    target.addEventListener("pointercancel", lifted, true);
  }
};
