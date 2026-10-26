import type { CameraMode, SaveSlotInfo } from "@seki/core";
import { createStore, type StoreApi } from "zustand/vanilla";

export type Screen = "title" | "playing" | "paused" | "dead";

export interface DialogueLineVm {
  readonly speaker: string | null;
  readonly text: string;
}

export interface DialogueVm {
  readonly lines: readonly DialogueLineVm[];
  readonly choices: readonly { readonly index: number; readonly text: string }[];
  readonly ended: boolean;
}

export interface Toast {
  readonly id: number;
  readonly kind: "quest" | "memory" | "money" | "reputation" | "system";
  readonly title: string;
  readonly text: string;
}

export interface UiState {
  readonly screen: Screen;
  readonly hp: number;
  readonly maxHp: number;
  readonly eddies: number;
  readonly alias: string | null;
  readonly questTitle: string | null;
  readonly objective: string | null;
  readonly cameraMode: CameraMode;
  readonly prompt: string | null;
  readonly dialogue: DialogueVm | null;
  readonly toasts: readonly Toast[];
  /** Bumped on every confirmed hit; the crosshair animates on change. */
  readonly hitMarker: number;
  /** Bumped when the player takes damage. */
  readonly hurtFlash: number;
  readonly slots: readonly SaveSlotInfo[];
  readonly memories: readonly string[];
  readonly hasSaves: boolean;
  readonly busy: boolean;
}

export const initialUiState: UiState = {
  screen: "title",
  hp: 100,
  maxHp: 100,
  eddies: 0,
  alias: null,
  questTitle: null,
  objective: null,
  cameraMode: "FPP",
  prompt: null,
  dialogue: null,
  toasts: [],
  hitMarker: 0,
  hurtFlash: 0,
  slots: [],
  memories: [],
  hasSaves: false,
  busy: false,
};

export type UiStore = StoreApi<UiState>;

export const createUiStore = (initial: Partial<UiState> = {}): UiStore => createStore<UiState>(() => ({ ...initialUiState, ...initial }));

/** Applies only the fields that actually changed, so per-frame pushes do not re-render React. */
export const patchUi = (store: UiStore, patch: Partial<UiState>): void => {
  const current = store.getState();
  const changed = (Object.keys(patch) as (keyof UiState)[]).some((k) => !Object.is(current[k], patch[k]));
  if (changed) store.setState(patch);
};

const TOAST_LIMIT = 4;
let toastSeq = 0;

export const pushToast = (store: UiStore, toast: Omit<Toast, "id">): number => {
  const id = ++toastSeq;
  store.setState((s) => ({ toasts: [...s.toasts, { ...toast, id }].slice(-TOAST_LIMIT) }));
  return id;
};

export const dismissToast = (store: UiStore, id: number): void => {
  store.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
};
