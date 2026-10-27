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

/** Where the levels meet (ADR-0021): a flight of stairs, a lift or a ladder. */
export type MapLinkKind = "stairs" | "lift" | "ladder";

export interface MapLinkVm {
  readonly kind: MapLinkKind;
  readonly x: number;
  readonly z: number;
}

/** Static district geometry for the minimap. Sent once at startup. */
export interface MapVm {
  readonly bounds: MapRectVm;
  readonly blocks: readonly MapRectVm[];
  readonly streets: readonly MapRectVm[];
  /** Walkable floors above the street (decks, walkways, balconies); lit while the player is up there. */
  readonly decks?: readonly MapRectVm[];
  readonly links?: readonly MapLinkVm[];
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
  /** Height above the street in whole metres while the player is up on a level (ADR-0021); absent on the street. */
  readonly level?: number;
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

/** The aim button held down, or pressed once to aim and again to stop (ADR-0019). */
export type AimMode = "hold" | "toggle";

export interface SettingsVm {
  readonly quality: GraphicsQuality;
  readonly aimMode: AimMode;
  /** Crouch key: held, or pressed once to crouch and again to stand (PC default). */
  readonly crouchMode: AimMode;
  /** Sprint key: held (default), or pressed once to run until stopping. */
  readonly sprintMode: AimMode;
  /** Look speed multiplier, 1 = default. */
  readonly mouseSensitivity: number;
  /** Extra look speed multiplier while aiming down sights (on top of the zoom's own slowdown). */
  readonly adsSensitivity: number;
  /** Mouse up looks down. */
  readonly invertY: boolean;
  readonly touchSensitivity: number;
  /** Vertical field of view in degrees from the hip. */
  readonly fov: number;
  /** Master volume 0..1. */
  readonly volume: number;
  /** Key bindings that differ from the defaults: action id -> codes. */
  readonly bindings: Readonly<Record<string, readonly string[]>>;
  /** First-run hints (controls, interactions) shown while playing. */
  readonly hints: boolean;
}

/** Vertical field of view of the camera by default, degrees (shown rounded; it is 1.08 rad). */
export const DEFAULT_FOV = 62;

/** The settings' field of view in radians; the default is exactly the camera's 1.08 rad, so the NPR reference frame never moves. */
export const fovRadians = (degrees: number): number => (degrees === DEFAULT_FOV ? 1.08 : (degrees * Math.PI) / 180);

export const DEFAULT_SETTINGS: SettingsVm = {
  quality: "high",
  aimMode: "hold",
  crouchMode: "toggle",
  sprintMode: "hold",
  mouseSensitivity: 1,
  adsSensitivity: 1,
  invertY: false,
  touchSensitivity: 1,
  fov: DEFAULT_FOV,
  volume: 0.6,
  bindings: {},
  hints: true,
};

/** A first-run hint: the keys (as labels) and the action, e.g. ["W", "A", "S", "D"] "ruch". */
export interface HintVm {
  readonly id: string;
  readonly keys: readonly string[];
  readonly text: string;
}

/** One remappable control, as the settings list shows it (the app fills the list from the engine's key map). */
export interface ControlBindingVm {
  readonly action: string;
  readonly label: string;
  /** Current codes (defaults or the player's), e.g. "KeyW", "Mouse0", "WheelDown". */
  readonly codes: readonly string[];
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
  /** Body part of the last confirmed hit; a head hit flashes the crosshair red. */
  readonly hitZone: HitZone | null;
  /**
   * Half-angle of the player's aim cone in radians, quantised by the app so the store only
   * changes while the cone actually moves (bloom, getting up or down, starting to run).
   */
  readonly aimSpread: number;
  /** Aiming down sights (ADR-0019): the crosshair tightens. */
  readonly aiming: boolean;
  /** Current field of view as a share of the hip one (below 1 while zoomed in), quantised by the app. */
  readonly aimZoom: number;
  /** Guarding with a melee weapon. */
  readonly blocking: boolean;
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
  /** Shows the screen on `tab`; already there, nothing changes (safe to call twice for one tap). */
  readonly showCharacterTab: (tab: CharacterTab) => void;
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
  /** Remappable controls with their current keys, for the settings and the help screen. */
  readonly controls: readonly ControlBindingVm[];
  /** First-run hint on screen: keys to press and what they do (null when none). */
  readonly hint: HintVm | null;
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
  aiming: false,
  aimZoom: 1,
  blocking: false,
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
  showCharacterTab: () => {},
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
  controls: [],
  hint: null,
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
      showCharacterTab: (tab: CharacterTab) => set((s) => (s.characterTab === tab ? {} : characterTabState(tab))),
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
