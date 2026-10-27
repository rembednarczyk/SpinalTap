import { type CameraMode, type CyberwareLoadout, type ReputationState, type SaveSlotInfo, createReputation } from "@seki/core";
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

export interface AbilityVm {
  readonly name: string;
  /** Seconds left while active, 0 otherwise. */
  readonly activeTime: number;
  readonly cooldown: number;
  readonly cooldownTotal: number;
}

export interface Toast {
  readonly id: number;
  readonly kind: "quest" | "memory" | "money" | "reputation" | "system" | "cyberware";
  readonly title: string;
  readonly text: string;
}

export interface JournalStepVm {
  readonly objective: string;
  readonly done: boolean;
}

export interface JournalQuestVm {
  readonly id: string;
  readonly title: string;
  readonly kind: "main" | "side" | "contract";
  readonly status: "active" | "completed";
  /** Steps reached so far, in order; the current one is the last with `done: false`. */
  readonly steps: readonly JournalStepVm[];
}

export interface JournalMemoryVm {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface JournalVm {
  readonly quests: readonly JournalQuestVm[];
  readonly memories: readonly JournalMemoryVm[];
}

export const EMPTY_JOURNAL: JournalVm = { quests: [], memories: [] };

/** Axis-aligned footprint on the ground plane, in metres (x east, z north). */
export interface MapRectVm {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
}

/** Static district geometry for the minimap. Sent once at startup. */
export interface MapVm {
  readonly bounds: MapRectVm;
  readonly blocks: readonly MapRectVm[];
  readonly streets: readonly MapRectVm[];
}

export type MapMarkerKind = "fixer" | "ripperdoc" | "target";

export interface MapMarkerVm {
  readonly id: string;
  readonly kind: MapMarkerKind;
  readonly x: number;
  readonly z: number;
}

export interface MapPlayerVm {
  readonly x: number;
  readonly z: number;
  /** Radians; 0 looks north (+z), PI/2 east (+x). */
  readonly yaw: number;
}

export type GraphicsQuality = "high" | "low";

export interface SettingsVm {
  readonly quality: GraphicsQuality;
  /** Look speed multiplier, 1 = default. */
  readonly mouseSensitivity: number;
  readonly touchSensitivity: number;
  /** Master volume 0..1. */
  readonly volume: number;
}

export const DEFAULT_SETTINGS: SettingsVm = { quality: "high", mouseSensitivity: 1, touchSensitivity: 1, volume: 0.6 };

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
  readonly medkits: number;
  readonly ability: AbilityVm | null;
  readonly cyberware: CyberwareLoadout;
  readonly reputation: ReputationState;
  readonly contractsDone: number;
  readonly shopOpen: boolean;
  readonly sheetOpen: boolean;
  /** Toggles the character sheet (Tab or the on-screen button). */
  readonly toggleSheet: () => void;
  readonly journal: JournalVm;
  readonly journalOpen: boolean;
  /** Toggles the journal (J or the on-screen button). Closes the character sheet. */
  readonly toggleJournal: () => void;
  readonly map: MapVm | null;
  readonly mapPlayer: MapPlayerVm | null;
  readonly mapMarkers: readonly MapMarkerVm[];
  readonly settings: SettingsVm;
  /** True when a saved setting only takes effect after the page is reloaded. */
  readonly reloadNeeded: boolean;
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
  medkits: 0,
  ability: null,
  cyberware: {},
  reputation: createReputation(),
  contractsDone: 0,
  shopOpen: false,
  sheetOpen: false,
  toggleSheet: () => {},
  journal: EMPTY_JOURNAL,
  journalOpen: false,
  toggleJournal: () => {},
  map: null,
  mapPlayer: null,
  mapMarkers: [],
  settings: DEFAULT_SETTINGS,
  reloadNeeded: false,
};

export type UiStore = StoreApi<UiState>;

export const createUiStore = (initial: Partial<UiState> = {}): UiStore =>
  createStore<UiState>((set) => ({
    ...initialUiState,
    toggleSheet: () => set((s) => ({ sheetOpen: !s.sheetOpen, journalOpen: false })),
    toggleJournal: () => set((s) => ({ journalOpen: !s.journalOpen, sheetOpen: false })),
    ...initial,
  }));

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
