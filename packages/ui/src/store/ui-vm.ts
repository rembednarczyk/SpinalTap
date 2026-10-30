import { DEFAULT_LOCALE, type ItemCategory, type ItemDefId, type ItemRef, type Locale, type Rarity, type WeaponSlot, degToRad, verticalFov } from "@seki/core";
import type { ColorblindMode, DamageNumbersMode } from "./hud-vm";
import type { MapAreaVm, MapLabelVm, MapPlaceVm, MapPolygon } from "./map-vm";
import type { RadioStationId } from "./wave2-vm";

// View models of the UI store: what the areas of `UiState` hold (ADR-0031).

export type Screen = "title" | "playing" | "paused" | "dead";

export interface DialogueLineVm {
  readonly speaker: string | null;
  readonly text: string;
}

/** Kind of a dialogue option (ADR-0039); the same set as the narrative's `DialogueTone`. */
export type DialogueToneVm = "main" | "optional" | "leave" | "aggressive" | "persuade" | "hack" | "lifepath";

export interface DialogueChoiceVm {
  readonly index: number;
  readonly text: string;
  /** `optional` when missing. */
  readonly tone?: DialogueToneVm;
}

export interface DialogueVm {
  /** The lines of the last step, under the wheel. */
  readonly lines: readonly DialogueLineVm[];
  readonly choices: readonly DialogueChoiceVm[];
  readonly ended: boolean;
  /** Earlier lines of this conversation, oldest first, for the scrollable log. */
  readonly history?: readonly DialogueLineVm[];
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
  readonly kind: "quest" | "memory" | "money" | "reputation" | "system" | "cyberware" | "heat" | "radio";
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
  /** The HUD follows this entry now. */
  readonly tracked?: boolean;
  /** The player chose it (as opposed to the game picking it). */
  readonly pinned?: boolean;
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

/** Static district geometry for the minimap and the map tab. Sent once at startup. */
export interface MapVm {
  readonly bounds: MapRectVm;
  /** The chunks of the city (ADR-0045): the ground under everything else. */
  readonly ground?: readonly MapRectVm[];
  /** Lublin's surfaces: roads, pavements and squares, green, water, rails. */
  readonly areas?: readonly MapAreaVm[];
  /** Lublin's building outlines. */
  readonly buildings?: readonly MapPolygon[];
  /** Street names, districts, landmarks and metro stations. */
  readonly labels?: readonly MapLabelVm[];
  /** The districts, for the map tab's jumps. */
  readonly places?: readonly MapPlaceVm[];
  readonly blocks: readonly MapRectVm[];
  readonly streets: readonly MapRectVm[];
  /** Walkable floors above the street (decks, walkways, balconies); lit while the player is up there. */
  readonly decks?: readonly MapRectVm[];
  readonly links?: readonly MapLinkVm[];
  /** Open water (the docks, ADR-0024), under everything else. */
  readonly water?: readonly MapRectVm[];
}

/** "enforcer": someone who sees through the player's disguise (ADR-0032). */
export type MapMarkerKind = "fixer" | "ripperdoc" | "vendor" | "target" | "enforcer";

export interface MapMarkerVm {
  readonly id: string;
  readonly kind: MapMarkerKind;
  readonly x: number;
  readonly z: number;
  /** A target shown as an area around (x, z) instead of a point, metres (ADR-0035). */
  readonly radius?: number;
}

export interface MapPlayerVm {
  readonly x: number;
  readonly z: number;
  /** Radians; 0 looks north (+z), PI/2 east (+x). */
  readonly yaw: number;
  /** Height above the street in whole metres while the player is up on a level (ADR-0021); absent on the street. */
  readonly level?: number;
  /** Moving: the minimap looks ahead, with the arrow in the lower third (ADR-0035). */
  readonly moving?: boolean;
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

/** Tabs of the character screen (plan §7): I, Tab, J and M open it on theirs. */
export type CharacterTab = "inventory" | "sheet" | "journal" | "map";

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

export type GraphicsQuality = "high" | "medium" | "low";

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
  /**
   * Horizontal field of view from the hip, degrees (ADR-0049): the same width of the street on
   * any screen; the camera works out the vertical angle for the screen's proportions.
   */
  readonly horizontalFov: number;
  /** Master volume 0..1. */
  readonly volume: number;
  /** Key bindings that differ from the defaults: action id -> codes. */
  readonly bindings: Readonly<Record<string, readonly string[]>>;
  /** First-run hints (controls, interactions) shown while playing. */
  readonly hints: boolean;
  /** Health and ammo stay on screen outside combat too. */
  readonly hudAlwaysShow: boolean;
  /** Damage numbers over the crosshair: none, one per hit, or a running total per target. */
  readonly damageNumbers: DamageNumbersMode;
  // Accessibility (ADR-0028).
  /** HUD size multiplier, 1 = default. */
  readonly hudScale: number;
  /** A legible font (Atkinson Hyperlegible) instead of the narrow display one. */
  readonly legibleFont: boolean;
  /** No aberration, glitch or blinking; the engine reads it too. */
  readonly reduceFlashes: boolean;
  /** The breach minigame has no timer. */
  readonly untimedBreach: boolean;
  /** Colour tokens for colour vision deficiencies (each token has an icon as well). */
  readonly colorblind: ColorblindMode;
  // Wave 2 (ADR-0035).
  /** Radio station playing, null when off. */
  readonly radioStation: RadioStationId | null;
  /** Objective and fixer markers on the minimap; off is the no-markers mode. */
  readonly mapMarkers: boolean;
  /** Outlines of interactive objects in the world; the engine reads it. */
  readonly highlights: boolean;
  /** Language of the menus and texts (ADR-0056); a player setting, never in the save. */
  readonly locale: Locale;
}

/** Horizontal field of view by default, degrees (ADR-0049; the engine's DEFAULT_HORIZONTAL_FOV). */
export const DEFAULT_HORIZONTAL_FOV = 80;

/** Horizontal field of view the settings allow, degrees. */
export const HORIZONTAL_FOV_RANGE: readonly [number, number] = [70, 100];

/** Vertical field of view from the hip (radians) for the setting on a screen of `aspect`, as the camera does it. */
export const hipVerticalFov = (horizontalDegrees: number, aspect: number): number => verticalFov(degToRad(horizontalDegrees), aspect);

export const DEFAULT_SETTINGS: SettingsVm = {
  quality: "high",
  aimMode: "hold",
  crouchMode: "toggle",
  sprintMode: "hold",
  mouseSensitivity: 1,
  adsSensitivity: 1,
  invertY: false,
  touchSensitivity: 1,
  horizontalFov: DEFAULT_HORIZONTAL_FOV,
  volume: 0.6,
  bindings: {},
  hints: true,
  hudAlwaysShow: false,
  damageNumbers: "off",
  hudScale: 1,
  legibleFont: false,
  reduceFlashes: false,
  untimedBreach: false,
  colorblind: "off",
  radioStation: null,
  mapMarkers: true,
  highlights: true,
  locale: DEFAULT_LOCALE,
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
