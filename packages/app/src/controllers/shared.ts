import type { Simulation } from "@seki/sim";
import { type Toast, type UiStore, dismissToast, pushToast } from "@seki/ui";

/** How long a system toast stays on screen, ms. */
export const TOAST_MS = 4500;

/** The running simulation; a function, since a new game or a load replaces it. */
export type SimRef = () => Simulation;

/**
 * Where the pointer goes after a panel opens or closes (ADR-0031). The app grabs it while the
 * player is in control and frees it for menus and panels.
 */
export interface Focus {
  /** A panel or a menu took over: the pointer is free. */
  panel(): void;
  /** Something closed: the pointer follows whether the player is in control again. */
  settle(): void;
}

export const focusOf = (onFocusChange: ((wantsPointer: boolean) => void) | undefined, inControl: () => boolean): Focus => ({
  panel: () => onFocusChange?.(false),
  settle: () => onFocusChange?.(inControl()),
});

/** A system toast that goes away on its own. */
export const pushToastTimed = (ui: UiStore, kind: Toast["kind"], title: string, text = ""): void => {
  const id = pushToast(ui, { kind, title, text });
  setTimeout(() => dismissToast(ui, id), TOAST_MS);
};
