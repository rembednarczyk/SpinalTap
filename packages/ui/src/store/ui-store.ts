import {
  type AmmoPouch,
  type CameraMode,
  EMPTY_EQUIPMENT,
  EMPTY_INVENTORY,
  type Equipment,
  type InventoryState,
  type CyberwareLoadout,
  type DayPhase,
  type HitZone,
  type ItemCategory,
  type ItemDefId,
  type ItemRef,
  type Rarity,
  type ReputationState,
  type SaveSlotInfo,
  type ShopId,
  type WeaponSlot,
  createReputation,
} from "@seki/core";
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

export interface WeaponSlotVm {
  readonly slot: WeaponSlot;
  /** Key and touch number of the slot. */
  readonly key: 1 | 2 | 3;
  /** Weapon in the slot, null when empty. */
  readonly name: string | null;
  readonly rarity: Rarity | null;
}

/** HUD weapon strip: the three slots and the active weapon's rounds. */
export interface WeaponStripVm {
  readonly slots: readonly WeaponSlotVm[];
  readonly active: WeaponSlot;
  /** Rounds in the magazine; null for melee or an empty hand. */
  readonly loaded: number | null;
  readonly magazine: number | null;
  /** Matching rounds in the pouch; null when the weapon takes none. */
  readonly reserve: number | null;
  readonly ammoName: string | null;
  readonly reloading: boolean;
  readonly holstered: boolean;
}

export interface LootLineVm {
  /** Index in the container, for `takeLoot`. */
  readonly index: number;
  readonly kind: "eddies" | "ammo" | "stack" | "item";
  readonly label: string;
  readonly qty: number;
  readonly rarity: Rarity | null;
}

/** The bag being searched. */
export interface LootVm {
  readonly key: string;
  readonly title: string;
  readonly lines: readonly LootLineVm[];
}

/** A piece the player carries, as a shop counter shows it. Prices are quoted with the core functions. */
export interface TradeItemVm {
  /** Uid of an instance or id of a stack. */
  readonly key: string;
  readonly ref: ItemRef;
  readonly defId: ItemDefId;
  readonly name: string;
  readonly category: ItemCategory;
  /** Null for stacks. */
  readonly rarity: Rarity | null;
  readonly qty: number;
  /** Garments only. */
  readonly condition: number | null;
  /** Equipped, mounted or carrying mods: it cannot be sold until it is taken off. */
  readonly inUse: boolean;
}

/** What the open shop needs to know about the bag. */
export interface TradeVm {
  readonly items: readonly TradeItemVm[];
  readonly capacity: number;
  readonly freeCells: number;
  readonly weaponParts: number;
}

export const EMPTY_TRADE: TradeVm = { items: [], capacity: 24, freeCells: 24, weaponParts: 0 };

/** Tabs of the character screen (plan §7): I, Tab and J open it on theirs. */
export type CharacterTab = "inventory" | "sheet" | "journal";

/** Numbers of the stats panel, worked out by the app from the domain and the player. */
export interface CharacterStatsVm {
  readonly hp: number;
  readonly maxHp: number;
  /** Armor per hit zone, implants and clothes together. */
  readonly armor: Readonly<Record<"head" | "torso" | "arm" | "leg", number>>;
  /** 0..1. */
  readonly critChance: number;
  readonly critMultiplier: number;
  /** Aim cone of the active weapon standing still, in degrees; null for melee or an empty hand. */
  readonly spread: number | null;
  /** Walk speed in m/s. */
  readonly moveSpeed: number;
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
  /** Body part of the last confirmed hit; a head hit flashes the crosshair red. */
  readonly hitZone: HitZone | null;
  /**
   * Half-angle of the player's aim cone in radians, quantised by the app so the store only
   * changes while the cone actually moves (bloom, getting up or down, starting to run).
   */
  readonly aimSpread: number;
  /** The player is crouched (or getting down). */
  readonly crouched: boolean;
  /** Bumped when the player takes damage. */
  readonly hurtFlash: number;
  readonly slots: readonly SaveSlotInfo[];
  readonly memories: readonly string[];
  readonly hasSaves: boolean;
  readonly busy: boolean;
  readonly medkits: number;
  /** How many more medkits fit in the bag. */
  readonly medkitRoom: number;
  readonly ability: AbilityVm | null;
  readonly weapons: WeaponStripVm | null;
  readonly cyberware: CyberwareLoadout;
  readonly reputation: ReputationState;
  readonly contractsDone: number;
  readonly shopOpen: boolean;
  /** Which counter the shop panel shows while `shopOpen`. */
  readonly shopId: ShopId;
  /** The bag as the open shop sees it (kept fresh only while a shop is open). */
  readonly trade: TradeVm;
  /** Open loot panel, or null. */
  readonly loot: LootVm | null;
  /** Open tab of the character screen, null while it is closed. */
  readonly characterTab: CharacterTab | null;
  /** Opens the screen on `tab`, or closes it when it already shows that tab. */
  readonly toggleCharacter: (tab: CharacterTab) => void;
  readonly closeCharacter: () => void;
  /** The screen shows the character sheet (kept in step with `characterTab`). */
  readonly sheetOpen: boolean;
  /** Toggles the character sheet (Tab). */
  readonly toggleSheet: () => void;
  readonly journal: JournalVm;
  /** The screen shows the journal (kept in step with `characterTab`). */
  readonly journalOpen: boolean;
  /** Toggles the journal (J). */
  readonly toggleJournal: () => void;
  /** The player's bag, slots and ammo pouch, straight from the domain (immutable, by reference). */
  readonly inventory: InventoryState;
  readonly equipment: Equipment;
  readonly ammo: AmmoPouch;
  readonly characterStats: CharacterStatsVm | null;
  readonly map: MapVm | null;
  readonly mapPlayer: MapPlayerVm | null;
  readonly mapMarkers: readonly MapMarkerVm[];
  readonly settings: SettingsVm;
  /** True when a saved setting only takes effect after the page is reloaded. */
  readonly reloadNeeded: boolean;
  /** Game time as "HH:MM"; null before a game runs. */
  readonly clock: string | null;
  readonly day: number;
  readonly dayPhase: DayPhase;
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
  hitZone: null,
  aimSpread: 0,
  crouched: false,
  hurtFlash: 0,
  slots: [],
  memories: [],
  hasSaves: false,
  busy: false,
  medkits: 0,
  medkitRoom: 9,
  ability: null,
  weapons: null,
  cyberware: {},
  reputation: createReputation(),
  contractsDone: 0,
  shopOpen: false,
  shopId: "clinic",
  trade: EMPTY_TRADE,
  loot: null,
  characterTab: null,
  toggleCharacter: () => {},
  closeCharacter: () => {},
  sheetOpen: false,
  toggleSheet: () => {},
  journal: EMPTY_JOURNAL,
  journalOpen: false,
  toggleJournal: () => {},
  inventory: EMPTY_INVENTORY,
  equipment: EMPTY_EQUIPMENT,
  ammo: {},
  characterStats: null,
  map: null,
  mapPlayer: null,
  mapMarkers: [],
  settings: DEFAULT_SETTINGS,
  reloadNeeded: false,
  clock: null,
  day: 1,
  dayPhase: "night",
};

export type UiStore = StoreApi<UiState>;

/** The tab and the two flags that mirror it. */
export const characterTabState = (tab: CharacterTab | null): Pick<UiState, "characterTab" | "sheetOpen" | "journalOpen"> => ({
  characterTab: tab,
  sheetOpen: tab === "sheet",
  journalOpen: tab === "journal",
});

/** `sheetOpen` or `journalOpen` in the initial state open the screen on that tab. */
const initialTab = (initial: Partial<UiState>): CharacterTab | null =>
  initial.characterTab !== undefined ? initial.characterTab : initial.sheetOpen ? "sheet" : initial.journalOpen ? "journal" : null;

export const createUiStore = (initial: Partial<UiState> = {}): UiStore =>
  createStore<UiState>((set) => {
    const toggle = (tab: CharacterTab) => set((s) => characterTabState(s.characterTab === tab ? null : tab));
    return {
      ...initialUiState,
      toggleCharacter: toggle,
      closeCharacter: () => set(characterTabState(null)),
      toggleSheet: () => toggle("sheet"),
      toggleJournal: () => toggle("journal"),
      ...initial,
      ...characterTabState(initialTab(initial)),
    };
  });

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
