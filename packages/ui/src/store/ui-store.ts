import {
  type AmmoPouch,
  BASE_RAM,
  type CameraMode,
  EMPTY_EQUIPMENT,
  EMPTY_INVENTORY,
  type Equipment,
  type InventoryState,
  type CyberwareLoadout,
  type DayPhase,
  type HitZone,
  type ReputationState,
  type SaveSlotInfo,
  type ShopId,
  createReputation,
} from "@seki/core";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  type BreachVm,
  type ContractBonusVm,
  type ContractDebriefVm,
  type DamageNumberVm,
  type DetectionVm,
  EMPTY_PHONE,
  type HeatVm,
  type HitKind,
  type MapPointVm,
  NO_HEAT,
  type PhoneNoticeVm,
  type PhoneVm,
  type RamVm,
  type ScanNoteVm,
  type ScanTargetVm,
  type UploadVm,
} from "./hud-vm";
import {
  type AbilityVm,
  type CharacterStatsVm,
  type CharacterTab,
  type ControlBindingVm,
  DEFAULT_SETTINGS,
  type DialogueVm,
  EMPTY_JOURNAL,
  EMPTY_TRADE,
  type HintVm,
  type JournalVm,
  type LoadingVm,
  type LootVm,
  type MapMarkerVm,
  type MapPlayerVm,
  type MapVm,
  NO_LOADING,
  type Screen,
  type SettingsVm,
  type Toast,
  type TradeVm,
  type WeaponStripVm,
} from "./ui-vm";
import type { BuffVm, CapacityVm, ContractHookVm, DashVm, DisguiseVm, MetroMapVm, MetroRideVm } from "./wave2-vm";

export * from "./hud-vm";
export * from "./ui-vm";
export * from "./map-vm";
export * from "./wave2-vm";

// ---- Areas of the UI state (ADR-0031) ----
// One flat Zustand store; each area below is its own type, and the comment says who writes it.

/** Session and screen: which screen, saves, toasts and the interaction prompt. Written by the app's session and save controller. */
export interface SessionUiState {
  readonly screen: Screen;
  /** The loading screen's bar (ADR-0057), written by the app's loading controller. */
  readonly loading: LoadingVm;
  readonly prompt: string | null;
  /**
   * What holding the attack button does with the prompt's target (a takedown's kill, ADR-0065),
   * shown with the prompt; null for nothing.
   */
  readonly promptHold: string | null;
  readonly toasts: readonly Toast[];
  readonly slots: readonly SaveSlotInfo[];
  readonly hasSaves: boolean;
  readonly busy: boolean;
  /** First-run hint on screen: keys to press and what they do (null when none). */
  readonly hint: HintVm | null;
}

/** The player's HUD outside combat: health, money, implants, standing, clock. Written by the app's HUD sync. */
export interface PlayerHudUiState {
  readonly hp: number;
  readonly maxHp: number;
  readonly eddies: number;
  readonly alias: string | null;
  readonly cameraMode: CameraMode;
  readonly memories: readonly string[];
  readonly medkits: number;
  /** How many more medkits fit in the bag. */
  readonly medkitRoom: number;
  readonly ability: AbilityVm | null;
  readonly cyberware: CyberwareLoadout;
  readonly reputation: ReputationState;
  /** Game time as "HH:MM"; null before a game runs. */
  readonly clock: string | null;
  readonly day: number;
  readonly dayPhase: DayPhase;
}

/** Combat feedback: crosshair, hit markers, damage numbers, weapons, heat and detection. Written by the HUD sync and the combat presenters. */
export interface CombatUiState {
  /** Bumped on every confirmed hit; the crosshair animates on change. */
  readonly hitMarker: number;
  /** Body part of the last confirmed hit; a head hit flashes the crosshair red. */
  readonly hitZone: HitZone | null;
  /** What the last confirmed hit did: a plain hit, a critical one or a kill (each its own marker). */
  readonly hitKind: HitKind;
  readonly damageNumbers: readonly DamageNumberVm[];
  /** The player fights or is hunted; outside it the health bar and ammo hide (unless always shown). */
  readonly combat: boolean;
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
  readonly weapons: WeaponStripVm | null;
  readonly heat: HeatVm;
  readonly detection: readonly DetectionVm[];
}

/** Quests and contracts: the objective line, the contract cards. Written by the HUD sync and the contract presenters. */
export interface ContractsUiState {
  readonly questTitle: string | null;
  readonly objective: string | null;
  readonly contractsDone: number;
  readonly debrief: ContractDebriefVm | null;
  readonly contractBonus: ContractBonusVm | null;
  /** Hooks found during the running contract (ADR-0032), for the tracker. */
  readonly contractHooks: readonly ContractHookVm[];
}

/** The conversation on screen. Written by the dialogue controller. */
export interface DialogueUiState {
  readonly dialogue: DialogueVm | null;
}

/** The open shop counter. Written by the shop controller (and the HUD sync while it is open). */
export interface TradeUiState {
  readonly shopOpen: boolean;
  /** Which counter the shop panel shows while `shopOpen`. */
  readonly shopId: ShopId;
  /** The bag as the open shop sees it (kept fresh only while a shop is open). */
  readonly trade: TradeVm;
}

/** The bag being searched. Written by the loot controller and the HUD sync. */
export interface LootUiState {
  /** Open loot panel, or null. */
  readonly loot: LootVm | null;
}

/** Character screen: tabs, the bag and the worn pieces, the stats and the journal. Tabs are switched by the UI itself through the actions here. */
export interface CharacterUiState {
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
}

/** Minimap: the static district, the player, markers, witnesses and the last known position. Written by the HUD sync. */
export interface MapUiState {
  readonly map: MapVm | null;
  readonly mapPlayer: MapPlayerVm | null;
  readonly mapMarkers: readonly MapMarkerVm[];
  /** Where the enemies last saw the player (silhouette on the minimap), null when nobody looks. */
  readonly lastKnown: { readonly x: number; readonly z: number } | null;
  /** Civilians phoning a crime in, as minimap markers. */
  readonly witnesses: readonly MapPointVm[];
  /** Minimap range as a multiple of the default (ADR-0035): above 1 while sprinting or dashing. */
  readonly mapZoom: number;
}

/** The phone (ADR-0028). Written by the phone controller and the phone presenter. */
export interface PhoneUiState {
  readonly phone: PhoneVm;
  readonly phoneOpen: boolean;
  /** Holocall or notification on top of the HUD, null when none. */
  readonly phoneNotice: PhoneNoticeVm | null;
}

/** Scanner, quickhacks and the breach minigame (ADR-0028). Written by the hack controller and the hacking presenter. */
export interface HackingUiState {
  /** The scanner is held. */
  readonly scanning: boolean;
  readonly scanTarget: ScanTargetVm | null;
  readonly ram: RamVm;
  readonly upload: UploadVm | null;
  readonly scanNote: ScanNoteVm | null;
  readonly breach: BreachVm | null;
}

/** Settings and key bindings. Written by the settings controller. */
export interface SettingsUiState {
  readonly settings: SettingsVm;
  /** Remappable controls with their current keys, for the settings and the help screen. */
  readonly controls: readonly ControlBindingVm[];
  /** True when a saved setting only takes effect after the page is reloaded. */
  readonly reloadNeeded: boolean;
}

/** The metro (ADR-0035): the line map at the kiosk and the ride screen. Written by the metro controller. */
export interface MetroUiState {
  readonly metroMap: MetroMapVm | null;
  readonly metroRide: MetroRideVm | null;
}

/** Wave 2 body HUD (ADR-0035): implant capacity, buffs, the dash and the disguise. Written by the wave 2 presenters. */
export interface BodyUiState {
  /** Cyberware capacity in use and the limit; null until the simulation reports it. */
  readonly capacity: CapacityVm | null;
  readonly buffs: readonly BuffVm[];
  /** The dash icon; null until the player has dashed once. */
  readonly dash: DashVm | null;
  readonly disguise: DisguiseVm | null;
}

/** The whole UI state: the sum of the areas above, flat at run time. */
export type UiState = SessionUiState &
  PlayerHudUiState &
  CombatUiState &
  ContractsUiState &
  DialogueUiState &
  TradeUiState &
  LootUiState &
  CharacterUiState &
  MapUiState &
  PhoneUiState &
  HackingUiState &
  SettingsUiState &
  MetroUiState &
  BodyUiState;

export const initialUiState: UiState = {
  screen: "title",
  loading: NO_LOADING,
  hp: 100,
  maxHp: 100,
  eddies: 0,
  alias: null,
  questTitle: null,
  objective: null,
  cameraMode: "FPP",
  prompt: null,
  promptHold: null,
  dialogue: null,
  toasts: [],
  hitMarker: 0,
  hitZone: null,
  hitKind: "hit",
  damageNumbers: [],
  combat: false,
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
  phone: EMPTY_PHONE,
  phoneOpen: false,
  phoneNotice: null,
  debrief: null,
  contractBonus: null,
  heat: NO_HEAT,
  detection: [],
  lastKnown: null,
  witnesses: [],
  scanning: false,
  scanTarget: null,
  ram: { current: BASE_RAM, max: BASE_RAM },
  upload: null,
  scanNote: null,
  breach: null,
  contractHooks: [],
  mapZoom: 1,
  metroMap: null,
  metroRide: null,
  capacity: null,
  buffs: [],
  dash: null,
  disguise: null,
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

/**
 * Toasts that outlive the rest when too many come at once: the story (quests, endings,
 * memories) and those marked `keep` (a level up, a failed save or load). Ordinary system
 * toasts (a purchase, a refusal at the counter) come and go in order like the rest.
 */
const isKeptToast = (t: Toast): boolean => t.kind === "quest" || t.kind === "memory" || t.keep === true;

/**
 * Shows a toast; over TOAST_LIMIT the oldest toast goes, but one that is not kept first, so a
 * burst (an ending with its reputation, level-up and quest toasts) does not push the ending out.
 * When every toast is kept, the oldest goes.
 */
export const pushToast = (store: UiStore, toast: Omit<Toast, "id">): number => {
  const id = ++toastSeq;
  store.setState((s) => {
    const toasts = [...s.toasts, { ...toast, id }];
    while (toasts.length > TOAST_LIMIT) {
      const minor = toasts.findIndex((t) => !isKeptToast(t));
      toasts.splice(minor >= 0 && minor < toasts.length - 1 ? minor : 0, 1);
    }
    return { toasts };
  });
  return id;
};

export const dismissToast = (store: UiStore, id: number): void => {
  store.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
};
