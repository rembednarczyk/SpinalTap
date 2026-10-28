import type { StatModifiers } from "../character/stats";
import type { HitZone } from "../combat/combat-rules";
import type { SpreadProfile } from "../combat/spread";
import { CYBERWARE_CATALOG, type CyberwareId, isCyberwareId } from "../cyberware/cyberware";
import type {
  AmmoId,
  ConsumableId,
  GarmentId,
  GarmentLook,
  GarmentSlot,
  InstanceDefId,
  ItemCategory,
  ItemDefId,
  JunkId,
  ModId,
  ModSlot,
  StackableId,
  WeaponId,
  WeaponLook,
  WeaponSlot,
} from "./types";

/**
 * Item catalogs (plan: docs/ekwipunek-i-uzbrojenie.md §2 to §4). Numbers are starting values
 * for balancing; systems read them from here and never hard-code them.
 */

export interface StackableDefinition {
  readonly id: StackableId;
  readonly name: string;
  readonly description: string;
  readonly category: "consumable" | "junk";
  /** List price in eddies. */
  readonly value: number;
  /** Pieces per inventory cell. */
  readonly stack: number;
  /** HP restored when used (consumables). */
  readonly heal?: number;
}

export const STACKABLE_CATALOG = {
  medkit: {
    id: "medkit",
    name: "Apteczka",
    description: "Iniektor z biożelem. Przywraca 40 HP.",
    category: "consumable",
    value: 90,
    stack: 9,
    heal: 40,
  },
  bandage: {
    id: "bandage",
    name: "Opatrunek",
    description: "Opatrunek z żelem hemostatycznym. Przywraca 15 HP.",
    category: "consumable",
    value: 30,
    stack: 9,
    heal: 15,
  },
  // Street food from Fumiko's stall on the market (ADR-0026): cheaper per HP than medical
  // kit, but eaten from the bag, never by quick use in a fight.
  ramen: {
    id: "ramen",
    name: "Miska ramenu",
    description: "Tonkotsu od Fumiko, w kubku z pokrywką. Przywraca 30 HP, jeśli zjesz to w spokoju.",
    category: "consumable",
    value: 35,
    stack: 3,
    heal: 30,
  },
  yakitori: {
    id: "yakitori",
    name: "Yakitori",
    description: "Dwa szaszłyki z grilla. Kurczak, podobno. Przywraca 10 HP.",
    category: "consumable",
    value: 10,
    stack: 6,
    heal: 10,
  },
  scrap: {
    id: "scrap",
    name: "Złom elektroniczny",
    description: "Płytki, kable i przekaźniki. Ktoś na targu to kupi.",
    category: "junk",
    value: 12,
    stack: 20,
  },
  weapon_parts: {
    id: "weapon_parts",
    name: "Części broni",
    description: "Sprężyny, iglice, prowadnice. Obniżają koszt naprawy.",
    category: "junk",
    value: 25,
    stack: 10,
  },
  datachip: {
    id: "datachip",
    name: "Chip z danymi",
    description: "Zaszyfrowany chip. Wart tyle, ile ktoś za niego da.",
    category: "junk",
    value: 40,
    stack: 5,
  },
} as const satisfies Record<StackableId, StackableDefinition>;

export const CONSUMABLE_IDS: readonly ConsumableId[] = ["medkit", "bandage", "ramen", "yakitori"];
export const JUNK_IDS: readonly JunkId[] = ["scrap", "weapon_parts", "datachip"];

export interface AmmoDefinition {
  readonly id: AmmoId;
  readonly name: string;
  /** Most rounds of this type the pouch holds. */
  readonly limit: number;
  /** Price of one round. */
  readonly value: number;
}

export const AMMO_CATALOG = {
  "9mm": { id: "9mm", name: "9 mm", limit: 180, value: 1 },
  "44": { id: "44", name: ".44", limit: 48, value: 4 },
  "12g": { id: "12g", name: "Śrut 12", limit: 40, value: 3 },
  "556": { id: "556", name: "5,56 mm", limit: 150, value: 2 },
} as const satisfies Record<AmmoId, AmmoDefinition>;

export interface GarmentDefinition {
  readonly id: GarmentId;
  readonly name: string;
  readonly description: string;
  readonly category: "garment";
  readonly slot: GarmentSlot;
  /** Armor per hit zone it covers. */
  readonly armor: Readonly<Partial<Record<HitZone, number>>>;
  readonly modifiers?: StatModifiers;
  readonly value: number;
  readonly look: GarmentLook;
}

export const GARMENT_CATALOG = {
  seki_jacket: {
    id: "seki_jacket",
    name: "Kurtka Seki",
    description: "Skórzana kurtka z wypalonym logo kuriera. Trochę chroni tors i ręce.",
    category: "garment",
    slot: "torso",
    armor: { torso: 1, arm: 1 },
    value: 150,
    look: { tint: "jacket-seki" },
  },
  cargo_pants: {
    id: "cargo_pants",
    name: "Spodnie cargo",
    description: "Grube płótno i dużo kieszeni.",
    category: "garment",
    slot: "legs",
    armor: { leg: 1 },
    value: 80,
    look: { tint: "cargo" },
  },
  tactical_visor: {
    id: "tactical_visor",
    name: "Wizjer taktyczny",
    description: "Polimerowa osłona oczu i skroni.",
    category: "garment",
    slot: "head",
    armor: { head: 2 },
    value: 300,
    look: { attachments: [{ point: "eyes", mesh: "visor" }] },
  },
  moto_helmet: {
    id: "moto_helmet",
    name: "Kask motocyklowy",
    description: "Ciężki kask z pękniętą szybką. Głowa przeżyje więcej niż ty.",
    category: "garment",
    slot: "head",
    armor: { head: 4 },
    value: 450,
    look: { attachments: [{ point: "head", mesh: "helmet" }] },
  },
  hebi_jacket: {
    id: "hebi_jacket",
    name: "Kurtka Hebi",
    description: "Kurtka gangu z wszytymi płytkami. Chroni tors i ręce.",
    category: "garment",
    slot: "torso",
    armor: { torso: 3, arm: 2 },
    value: 600,
    look: { tint: "jacket-hebi" },
  },
  ballistic_vest: {
    id: "ballistic_vest",
    name: "Kamizelka balistyczna",
    description: "Płyta na klatce piersiowej. Ciężka, wolniej się w niej biega.",
    category: "garment",
    slot: "torso",
    armor: { torso: 5 },
    modifiers: { moveSpeed: -0.2 },
    value: 900,
    look: { tint: "vest", attachments: [{ point: "chest", mesh: "vest-plate" }] },
  },
  kevlar_pants: {
    id: "kevlar_pants",
    name: "Spodnie z kevlarem",
    description: "Wkładki z kevlaru na udach i goleniach.",
    category: "garment",
    slot: "legs",
    armor: { leg: 3 },
    value: 500,
    look: { tint: "kevlar" },
  },
  // Corporate security in the docks (ADR-0024): plates where a Hebi jacket has patches.
  tessen_vest: {
    id: "tessen_vest",
    name: "Pancerz Tessen",
    description: "Korporacyjna kamizelka z płytami na piersi i barkach. Słabe pociski się od niej odbijają.",
    category: "garment",
    slot: "torso",
    armor: { torso: 6, arm: 3 },
    modifiers: { moveSpeed: -0.15 },
    value: 1100,
    look: { tint: "jacket-tessen", attachments: [{ point: "chest", mesh: "vest-plate" }] },
  },
  tessen_helmet: {
    id: "tessen_helmet",
    name: "Hełm ochrony Tessen",
    description: "Lekki hełm z daszkiem. Strzał w twarz dalej boli.",
    category: "garment",
    slot: "head",
    armor: { head: 3 },
    value: 400,
    look: { attachments: [{ point: "head", mesh: "helmet" }] },
  },
} as const satisfies Record<GarmentId, GarmentDefinition>;

/** What a mod changes in `effectiveWeapon`. Multipliers default to 1. */
export interface ModEffect {
  readonly damage?: number;
  /** Multiplier on the base spread. */
  readonly spread?: number;
  /** Multiplier on the magazine (rounded down); per-round weapons get `perRoundBonus` instead. */
  readonly magazine?: number;
  readonly perRoundBonus?: number;
  readonly reload?: number;
  /** Radius in metres in which a shot alerts gangers. */
  readonly alertRadius?: number;
}

export interface ModDefinition {
  readonly id: ModId;
  readonly name: string;
  readonly description: string;
  readonly category: "mod";
  readonly slot: ModSlot;
  readonly effect: ModEffect;
  readonly value: number;
}

export const MOD_CATALOG = {
  suppressor: {
    id: "suppressor",
    name: "Tłumik",
    description: "Strzał słychać tylko z bliska (alarm 8 m zamiast 22 m). Obrażenia ×0,95.",
    category: "mod",
    slot: "muzzle",
    effect: { damage: 0.95, alertRadius: 8 },
    value: 350,
  },
  holo_sight: {
    id: "holo_sight",
    name: "Celownik holo",
    description: "Rozrzut bazowy ×0,8.",
    category: "mod",
    slot: "sight",
    effect: { spread: 0.8 },
    value: 300,
  },
  extended_mag: {
    id: "extended_mag",
    name: "Magazynek powiększony",
    description: "Magazynek ×1,5 (strzelba +2 naboje), przeładowanie ×1,15.",
    category: "mod",
    slot: "magazine",
    effect: { magazine: 1.5, perRoundBonus: 2, reload: 1.15 },
    value: 250,
  },
} as const satisfies Record<ModId, ModDefinition>;

export type WeaponClass = "pistol" | "revolver" | "smg" | "shotgun" | "rifle" | "baton" | "blade";

/** How NPCs fire a weapon: today's ganger balance, independent of the player's numbers. */
export interface NpcWeaponProfile {
  readonly damage: number;
  readonly interval: number;
  readonly range: number;
  readonly spread: SpreadProfile;
}

/**
 * Aiming down sights (ADR-0019). Every value applies at full aim; the simulation eases the aim
 * in over `time` and scales each one with it.
 */
export interface AdsProfile {
  /** Field of view multiplier (below 1 zooms in). */
  readonly zoom: number;
  /** Seconds from the hip to full aim (and back). */
  readonly time: number;
  /** Multiplier on the aim cone. */
  readonly spread: number;
  /** Multiplier on walking speed. */
  readonly move: number;
}

/** One swing of a melee combo (ADR-0019). */
export interface MeleeStrike {
  /** Multiplier on the weapon's damage. */
  readonly damage: number;
  /** Seconds from the start of the swing to the moment it lands. */
  readonly windup: number;
  /** Seconds after it lands before the next action. */
  readonly recovery: number;
  /** Seconds a target that took the hit unguarded is staggered. */
  readonly stagger: number;
}

/** Guard with a melee weapon (the aim button). */
export interface BlockProfile {
  /** Half-angle of the guarded cone in front of the defender, radians. */
  readonly arc: number;
  /** Damage multiplier for a blocked melee hit. */
  readonly melee: number;
  /** Damage multiplier for a blocked shot: a blade does not stop bullets. */
  readonly projectile: number;
  /** Walking speed multiplier while guarding. */
  readonly move: number;
  /** Seconds after raising the guard in which a melee hit is parried. */
  readonly parryWindow: number;
  /** Seconds a parried attacker is stunned. */
  readonly parryStun: number;
}

export interface MeleeProfile {
  readonly combo: readonly [MeleeStrike, ...MeleeStrike[]];
  /** Half-angle of the swing arc in front of the attacker, radians. */
  readonly arc: number;
  /** Seconds after a strike's recovery in which the next one continues the combo. */
  readonly comboWindow: number;
  /** Windup of an NPC's swing (a readable telegraph), replacing the strike's own. */
  readonly npcWindup: number;
  readonly block: BlockProfile;
}

export interface WeaponDefinition {
  readonly id: WeaponId;
  readonly name: string;
  readonly description: string;
  readonly category: "weapon";
  readonly class: WeaponClass;
  readonly slot: WeaponSlot;
  /** Per projectile (a shotgun: per pellet). */
  readonly damage: number;
  readonly pellets: number;
  /** Seconds between shots. */
  readonly interval: number;
  /** Rounds per magazine; 0 for melee. */
  readonly magazine: number;
  /** Seconds for a full reload, or per round for `per-round`. */
  readonly reload: number;
  readonly reloadMode: "magazine" | "per-round";
  readonly ammo: AmmoId | null;
  /** Aim cone (ADR-0016), radians. */
  readonly spread: SpreadProfile;
  readonly range: number;
  /** Seconds to draw; holstering takes half. */
  readonly drawTime: number;
  readonly modSlots: readonly ModSlot[];
  /** Radius in metres in which a shot alerts gangers. */
  readonly alertRadius: number;
  readonly value: number;
  readonly look: WeaponLook;
  readonly npc?: NpcWeaponProfile;
  /** Firearms aim down sights. */
  readonly ads?: AdsProfile;
  /** Melee weapons swing in combos and guard. */
  readonly melee?: MeleeProfile;
}

const PISTOL_SPREAD: SpreadProfile = { base: 0.02, crouch: 0.4, move: 0.03, sprint: 0.06, bloomPerShot: 0.018, bloomMax: 0.06, recovery: 0.07 };
/** The gangers' SMG spray from before ADR-0015; kept as the NPC profile. */
const GANGER_SMG_SPREAD: SpreadProfile = { base: 0.055, crouch: 0.6, move: 0.04, sprint: 0.08, bloomPerShot: 0.01, bloomMax: 0.03, recovery: 0.04 };
const NO_SPREAD: SpreadProfile = { base: 0, crouch: 1, move: 0, sprint: 0, bloomPerShot: 0, bloomMax: 0, recovery: 1 };
const ALL_MODS: readonly ModSlot[] = ["muzzle", "sight", "magazine"];
const GUNSHOT_ALERT = 22;
/** Guard shared by the melee weapons; the blade parries a little longer. */
const MELEE_BLOCK: BlockProfile = { arc: 1.05, melee: 0.25, projectile: 0.7, move: 0.55, parryWindow: 0.18, parryStun: 1.2 };
const MELEE_ALERT = 4;

export const WEAPON_CATALOG = {
  unity9: {
    id: "unity9",
    name: "Unity-9",
    description: "Pistolet, z którym się obudziłaś. Celny i przewidywalny.",
    category: "weapon",
    class: "pistol",
    slot: "secondary",
    damage: 22,
    pellets: 1,
    interval: 0.28,
    magazine: 12,
    reload: 1.4,
    reloadMode: "magazine",
    ammo: "9mm",
    spread: PISTOL_SPREAD,
    range: 60,
    drawTime: 0.4,
    modSlots: ALL_MODS,
    alertRadius: GUNSHOT_ALERT,
    value: 400,
    look: "pistol",
    npc: { damage: 14, interval: 1.1, range: 40, spread: { ...GANGER_SMG_SPREAD, base: 0.045 } },
    ads: { zoom: 0.8, time: 0.16, spread: 0.5, move: 0.75 },
  },
  oni44: {
    id: "oni44",
    name: "Oni .44",
    description: "Rewolwer. Sześć strzałów, każdy jak uderzenie młotem.",
    category: "weapon",
    class: "revolver",
    slot: "secondary",
    damage: 48,
    pellets: 1,
    interval: 0.6,
    magazine: 6,
    reload: 2.4,
    reloadMode: "magazine",
    ammo: "44",
    spread: { base: 0.015, crouch: 0.4, move: 0.035, sprint: 0.07, bloomPerShot: 0.085, bloomMax: 0.12, recovery: 0.1 },
    range: 70,
    drawTime: 0.4,
    modSlots: ["sight"],
    alertRadius: GUNSHOT_ALERT,
    value: 1300,
    look: "revolver",
    ads: { zoom: 0.78, time: 0.2, spread: 0.45, move: 0.7 },
  },
  hebi_smg: {
    id: "hebi_smg",
    name: "Hebi SMG",
    description: "Pistolet maszynowy gangu Hebi. Szybki i rozrzutny.",
    category: "weapon",
    class: "smg",
    slot: "primary",
    damage: 9,
    pellets: 1,
    interval: 0.1,
    magazine: 30,
    reload: 2,
    reloadMode: "magazine",
    ammo: "9mm",
    spread: { base: 0.06, crouch: 0.6, move: 0.035, sprint: 0.07, bloomPerShot: 0.025, bloomMax: 0.08, recovery: 0.12 },
    range: 25,
    drawTime: 0.55,
    modSlots: ALL_MODS,
    alertRadius: GUNSHOT_ALERT,
    value: 700,
    look: "smg",
    npc: { damage: 7, interval: 0.9, range: 18, spread: GANGER_SMG_SPREAD },
    ads: { zoom: 0.72, time: 0.2, spread: 0.6, move: 0.75 },
  },
  raijin12: {
    id: "raijin12",
    name: "Raijin 12",
    description: "Strzelba z ładowaniem po jednym naboju. W zaułku nie ma sobie równych.",
    category: "weapon",
    class: "shotgun",
    slot: "primary",
    damage: 8,
    pellets: 9,
    interval: 0.85,
    magazine: 6,
    reload: 0.5,
    reloadMode: "per-round",
    ammo: "12g",
    spread: { base: 0.1, crouch: 0.85, move: 0.03, sprint: 0.06, bloomPerShot: 0.03, bloomMax: 0.06, recovery: 0.08 },
    range: 14,
    drawTime: 0.7,
    modSlots: ["sight", "magazine"],
    alertRadius: GUNSHOT_ALERT,
    value: 1200,
    look: "shotgun",
    npc: { damage: 6, interval: 1.4, range: 12, spread: { base: 0.11, crouch: 0.85, move: 0.03, sprint: 0.06, bloomPerShot: 0.02, bloomMax: 0.04, recovery: 0.05 } },
    ads: { zoom: 0.85, time: 0.26, spread: 0.8, move: 0.7 },
  },
  tessen_ar5: {
    id: "tessen_ar5",
    name: "Tessen AR-5",
    description: "Karabinek z korporacyjnych magazynów. Celny na całą ulicę.",
    category: "weapon",
    class: "rifle",
    slot: "primary",
    damage: 26,
    pellets: 1,
    interval: 0.15,
    magazine: 24,
    reload: 2.2,
    reloadMode: "magazine",
    ammo: "556",
    spread: { base: 0.03, crouch: 0.5, move: 0.04, sprint: 0.08, bloomPerShot: 0.022, bloomMax: 0.07, recovery: 0.1 },
    range: 80,
    drawTime: 0.7,
    modSlots: ALL_MODS,
    alertRadius: GUNSHOT_ALERT,
    value: 1800,
    look: "rifle",
    // Tessen guards in the docks (ADR-0024): short controlled bursts, accurate at street range.
    npc: { damage: 11, interval: 0.75, range: 30, spread: { ...GANGER_SMG_SPREAD, base: 0.035 } },
    ads: { zoom: 0.55, time: 0.28, spread: 0.35, move: 0.6 },
  },
  kagero_dmr: {
    id: "kagero_dmr",
    name: "Kagero DMR",
    description: "Karabin wyborowy ochrony portu. Jeden strzał, długa przerwa, a potem drugi.",
    category: "weapon",
    class: "rifle",
    slot: "primary",
    damage: 62,
    pellets: 1,
    interval: 0.9,
    magazine: 6,
    reload: 2.8,
    reloadMode: "magazine",
    ammo: "556",
    spread: { base: 0.012, crouch: 0.4, move: 0.06, sprint: 0.12, bloomPerShot: 0.05, bloomMax: 0.08, recovery: 0.08 },
    range: 120,
    drawTime: 0.85,
    modSlots: ["muzzle", "sight"],
    alertRadius: 34,
    value: 2200,
    look: "rifle",
    // The sniper's shot (ADR-0024): telegraphed by the laser, so it may hit hard and true.
    npc: { damage: 34, interval: 2.6, range: 80, spread: { ...NO_SPREAD, base: 0.004 } },
    ads: { zoom: 0.38, time: 0.34, spread: 0.2, move: 0.5 },
  },
  baton: {
    id: "baton",
    name: "Pałka teleskopowa",
    description: "Cicha i zawsze gotowa. Działa tylko z bliska.",
    category: "weapon",
    class: "baton",
    slot: "melee",
    damage: 30,
    pellets: 1,
    interval: 0.6,
    magazine: 0,
    reload: 0,
    reloadMode: "magazine",
    ammo: null,
    spread: NO_SPREAD,
    range: 2.2,
    drawTime: 0.3,
    modSlots: [],
    alertRadius: MELEE_ALERT,
    value: 250,
    look: "baton",
    melee: {
      combo: [
        { damage: 1, windup: 0.16, recovery: 0.3, stagger: 0.45 },
        { damage: 1, windup: 0.14, recovery: 0.3, stagger: 0.45 },
        { damage: 1.5, windup: 0.24, recovery: 0.5, stagger: 0.8 },
      ],
      arc: 0.9,
      comboWindow: 0.45,
      npcWindup: 0.5,
      block: MELEE_BLOCK,
    },
  },
  shirasaya: {
    id: "shirasaya",
    name: "Ostrze Shirasaya",
    description: "Prosta klinga w drewnianej pochwie. Szybka i bezlitosna.",
    category: "weapon",
    class: "blade",
    slot: "melee",
    damage: 45,
    pellets: 1,
    interval: 0.75,
    magazine: 0,
    reload: 0,
    reloadMode: "magazine",
    ammo: null,
    spread: NO_SPREAD,
    range: 2.6,
    drawTime: 0.3,
    modSlots: [],
    alertRadius: MELEE_ALERT,
    value: 1500,
    look: "blade",
    melee: {
      combo: [
        { damage: 1, windup: 0.15, recovery: 0.32, stagger: 0.4 },
        { damage: 1.1, windup: 0.15, recovery: 0.34, stagger: 0.4 },
        { damage: 1.6, windup: 0.26, recovery: 0.55, stagger: 0.75 },
      ],
      arc: 0.75,
      comboWindow: 0.4,
      npcWindup: 0.45,
      block: { ...MELEE_BLOCK, parryWindow: 0.22 },
    },
  },
} as const satisfies Record<WeaponId, WeaponDefinition>;

const has = (catalog: object, id: unknown): boolean => typeof id === "string" && Object.hasOwn(catalog, id);

export const isWeaponId = (id: unknown): id is WeaponId => has(WEAPON_CATALOG, id);
export const isGarmentId = (id: unknown): id is GarmentId => has(GARMENT_CATALOG, id);
export const isModId = (id: unknown): id is ModId => has(MOD_CATALOG, id);
export const isAmmoId = (id: unknown): id is AmmoId => has(AMMO_CATALOG, id);
export const isStackableId = (id: unknown): id is StackableId => has(STACKABLE_CATALOG, id);
export const isConsumableId = (id: unknown): id is ConsumableId => isStackableId(id) && STACKABLE_CATALOG[id].category === "consumable";
export const isInstanceDefId = (id: unknown): id is InstanceDefId =>
  isWeaponId(id) || isGarmentId(id) || isModId(id) || (typeof id === "string" && isCyberwareId(id));

/** Display data shared by every kind of item. */
export interface ItemSummary {
  readonly name: string;
  readonly category: ItemCategory;
  /** List price before rarity and shop terms. */
  readonly value: number;
}

export const itemSummary = (id: ItemDefId): ItemSummary => {
  if (isStackableId(id)) return STACKABLE_CATALOG[id];
  if (isWeaponId(id)) return WEAPON_CATALOG[id];
  if (isGarmentId(id)) return GARMENT_CATALOG[id];
  if (isModId(id)) return MOD_CATALOG[id];
  const implant = CYBERWARE_CATALOG[id satisfies CyberwareId];
  return { name: implant.name, category: "cyberware", value: implant.price };
};
