import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n/use-t";
import type { DialogueIntents } from "../intents";
import type { DialogueVm } from "../store/ui-vm";
import { type WheelSlot, stepSlot, wheelSlots } from "./wheel-layout";

/** Wheel travel (pixels) per step: one notch of a regular mouse wheel. */
const WHEEL_NOTCH = 40;
const CONFIRM_KEYS = new Set(["Enter", " ", "e", "E"]);

export interface DialogueWheelState {
  readonly slots: readonly WheelSlot[];
  /** The highlighted slot. */
  readonly hot: number;
  readonly point: (slot: number) => void;
  readonly pick: (slot: number) => void;
}

/** Elements whose wheel events scroll themselves (the subtitle log), not the highlight. */
const scrollsItself = (target: EventTarget | null): boolean => target instanceof Element && target.closest("[data-dialogue-log]") !== null;

/**
 * Selection on the dialogue wheel (ADR-0039): the highlighted slot and every way to move it or
 * pick it. Keys 1-9 pick a slot at once, the arrows and the mouse wheel move the highlight,
 * E, Enter and Space pick the highlighted one. The highlight starts on the top slot at every
 * new step of the conversation.
 */
export const useDialogueWheel = (dialogue: DialogueVm, intents: DialogueIntents): DialogueWheelState => {
  const t = useT();
  const endText = t("dialogue.end");
  const slots = useMemo(() => wheelSlots(dialogue, endText), [dialogue, endText]);
  const [state, setState] = useState({ of: dialogue, slot: 0 });
  const hot = state.of === dialogue ? Math.min(state.slot, slots.length - 1) : 0;
  const point = useCallback((slot: number) => setState({ of: dialogue, slot }), [dialogue]);
  const pick = useCallback(
    (slot: number) => {
      const action = slots[slot]?.action;
      if (!action) return;
      // A focused button would otherwise take the next Space or Enter as its own click.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (action.kind === "close") intents.closeDialogue();
      else intents.choose(action.index);
    },
    [slots, intents],
  );
  // Wheel travel between notches; kept across re-renders so a slow scroll still adds up.
  const travel = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= slots.length) {
        pick(n - 1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        point(stepSlot(hot, e.key === "ArrowUp" ? -1 : 1, slots.length));
      } else if (CONFIRM_KEYS.has(e.key)) {
        e.preventDefault();
        if (!e.repeat) pick(hot);
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (scrollsItself(e.target)) return;
      travel.current += e.deltaMode === 1 ? e.deltaY * WHEEL_NOTCH : e.deltaY;
      if (Math.abs(travel.current) < WHEEL_NOTCH) return;
      point(stepSlot(hot, travel.current > 0 ? 1 : -1, slots.length));
      travel.current = 0;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [hot, slots, point, pick]);

  return { slots, hot, point, pick };
};
