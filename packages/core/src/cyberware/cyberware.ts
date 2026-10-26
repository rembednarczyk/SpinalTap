import type { StatModifiers } from "../character/stats";

export type CyberwareSlot = "optics" | "nervous" | "skeleton" | "arms";

export interface CyberwareDefinition {
  readonly id: string;
  readonly name: string;
  readonly slot: CyberwareSlot;
  readonly price: number;
  readonly modifiers: StatModifiers;
}

export const CYBERWARE_CATALOG = {
  hitomi_optics_mk1: {
    id: "hitomi_optics_mk1",
    name: "Optyka Hitomi Mk1",
    slot: "optics",
    price: 0,
    modifiers: { critChance: 0.04 },
  },
  subdermal_weave: {
    id: "subdermal_weave",
    name: "Splot podskórny",
    slot: "skeleton",
    price: 900,
    modifiers: { armor: 4, maxHp: 15 },
  },
  synapse_booster: {
    id: "synapse_booster",
    name: "Wzmacniacz synaps",
    slot: "nervous",
    price: 1400,
    modifiers: { critMultiplier: 0.4 },
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
