import type { AbilityId } from "../abilities/abilities";
import type { StatModifiers } from "../character/stats";

export type CyberwareSlot = "optics" | "nervous" | "skeleton" | "arms";

export interface CyberwareDefinition {
  readonly id: string;
  readonly name: string;
  readonly slot: CyberwareSlot;
  readonly price: number;
  readonly description: string;
  readonly modifiers: StatModifiers;
  /** Active ability granted while installed. */
  readonly ability?: AbilityId;
}

export const CYBERWARE_CATALOG = {
  hitomi_optics_mk1: {
    id: "hitomi_optics_mk1",
    name: "Optyka Hitomi Mk1",
    slot: "optics",
    price: 0,
    description: "Optyka startowa z prostym wspomaganiem celowania. Szansa na krytyk +4%, stabilność celowania +10%.",
    modifiers: { critChance: 0.04, aimStability: 0.1 },
  },
  subdermal_weave: {
    id: "subdermal_weave",
    name: "Splot podskórny",
    slot: "skeleton",
    price: 650,
    description: "Siatka z polimeru pod skórą, także pod skalpem. Pancerz +4, pancerz głowy +3, maks. HP +15.",
    modifiers: { armor: 4, maxHp: 15, headArmor: 3 },
  },
  synapse_booster: {
    id: "synapse_booster",
    name: "Wzmacniacz synaps",
    slot: "nervous",
    price: 900,
    description: "Szybsze przetwarzanie celu. Mnożnik krytyka +0,4, stabilność celowania +10%.",
    modifiers: { critMultiplier: 0.4, aimStability: 0.1 },
  },
  kairos_overclock: {
    id: "kairos_overclock",
    name: "Akcelerator Kairos",
    slot: "nervous",
    price: 1100,
    description: "Aktywny [Q]: przez 4 s świat zwalnia do 30%. Odnowienie 16 s.",
    modifiers: {},
    ability: "reflex_overdrive",
  },
  steady_grip: {
    id: "steady_grip",
    name: "Stabilizator chwytu",
    slot: "arms",
    price: 500,
    description: "Mniej odrzutu, pewniejszy strzał. Obrażenia +4, stabilność celowania +30%.",
    modifiers: { damageBonus: 4, aimStability: 0.3 },
  },
} as const satisfies Record<string, CyberwareDefinition>;

export type CyberwareId = keyof typeof CYBERWARE_CATALOG;

export const isCyberwareId = (id: string): id is CyberwareId => Object.hasOwn(CYBERWARE_CATALOG, id);

/** Installed implants keyed by slot. One implant per slot. */
export type CyberwareLoadout = Readonly<Partial<Record<CyberwareSlot, CyberwareId>>>;

export interface InstallResult {
  readonly loadout: CyberwareLoadout;
  /** Implant removed from the slot to make room, if any. */
  readonly replaced: CyberwareId | null;
}

export const installCyberware = (loadout: CyberwareLoadout, id: CyberwareId): InstallResult => {
  const def = CYBERWARE_CATALOG[id];
  return { loadout: { ...loadout, [def.slot]: id }, replaced: loadout[def.slot] ?? null };
};

export const uninstallCyberware = (loadout: CyberwareLoadout, slot: CyberwareSlot): CyberwareLoadout => {
  const next: Partial<Record<CyberwareSlot, CyberwareId>> = { ...loadout };
  delete next[slot];
  return next;
};

export const loadoutModifiers = (loadout: CyberwareLoadout): StatModifiers[] =>
  Object.values(loadout)
    .filter((id): id is CyberwareId => id !== undefined)
    .map((id) => CYBERWARE_CATALOG[id].modifiers);

/** The active ability of the installed implants, if any. */
export const loadoutAbility = (loadout: CyberwareLoadout): AbilityId | null => {
  for (const id of Object.values(loadout)) {
    if (id === undefined) continue;
    const def: CyberwareDefinition = CYBERWARE_CATALOG[id];
    if (def.ability) return def.ability;
  }
  return null;
};
