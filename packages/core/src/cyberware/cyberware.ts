import type { AbilityId } from "../abilities/abilities";
import type { StatModifiers } from "../character/stats";

export type CyberwareSlot = "optics" | "nervous" | "skeleton" | "arms";

/**
 * A perk that changes how the game plays (ADR-0033): a dash (also once in the air) and
 * bullets sent back off a guarding melee weapon.
 */
export type CyberPerk = "dash" | "deflect";

export interface CyberwareDefinition {
  readonly id: string;
  /** Catalog key of the name (`cyberware.<id>.name`, ADR-0056); `description` likewise. */
  readonly name: string;
  readonly slot: CyberwareSlot;
  readonly price: number;
  readonly description: string;
  readonly modifiers: StatModifiers;
  /** Active ability granted while installed. */
  readonly ability?: AbilityId;
  /** Cyberware capacity it takes, 2 to 8 (ADR-0033). */
  readonly capacity: number;
  readonly perk?: CyberPerk;
}

export const CYBERWARE_CATALOG = {
  hitomi_optics_mk1: {
    id: "hitomi_optics_mk1",
    name: "cyberware.hitomi_optics_mk1.name",
    slot: "optics",
    price: 0,
    description: "cyberware.hitomi_optics_mk1.desc",
    capacity: 2,
    modifiers: { critChance: 0.04, aimStability: 0.1 },
  },
  subdermal_weave: {
    id: "subdermal_weave",
    name: "cyberware.subdermal_weave.name",
    slot: "skeleton",
    price: 650,
    description: "cyberware.subdermal_weave.desc",
    capacity: 4,
    modifiers: { armor: 4, maxHp: 15, headArmor: 3 },
  },
  synapse_booster: {
    id: "synapse_booster",
    name: "cyberware.synapse_booster.name",
    slot: "nervous",
    price: 900,
    description: "cyberware.synapse_booster.desc",
    capacity: 5,
    modifiers: { critMultiplier: 0.4, aimStability: 0.1 },
  },
  kairos_overclock: {
    id: "kairos_overclock",
    name: "cyberware.kairos_overclock.name",
    slot: "nervous",
    price: 1100,
    description: "cyberware.kairos_overclock.desc",
    capacity: 7,
    modifiers: {},
    ability: "reflex_overdrive",
  },
  steady_grip: {
    id: "steady_grip",
    name: "cyberware.steady_grip.name",
    slot: "arms",
    price: 500,
    description: "cyberware.steady_grip.desc",
    capacity: 3,
    modifiers: { damageBonus: 4, aimStability: 0.3 },
  },
  // Wave 2 (ADR-0033). The legs go into the skeleton slot (tendons and joints of the frame), so
  // the dash competes with the subdermal weave: mobility or armour.
  kitsune_tendons: {
    id: "kitsune_tendons",
    name: "cyberware.kitsune_tendons.name",
    slot: "skeleton",
    price: 950,
    capacity: 6,
    description: "cyberware.kitsune_tendons.desc",
    modifiers: { moveSpeed: 0.2 },
    perk: "dash",
  },
  tsubame_reflex: {
    id: "tsubame_reflex",
    name: "cyberware.tsubame_reflex.name",
    slot: "arms",
    price: 1150,
    capacity: 8,
    description: "cyberware.tsubame_reflex.desc",
    modifiers: {},
    perk: "deflect",
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

/** Does an installed implant give the perk? */
export const hasPerk = (loadout: CyberwareLoadout, perk: CyberPerk): boolean => {
  for (const id of Object.values(loadout)) {
    if (id === undefined) continue;
    const def: CyberwareDefinition = CYBERWARE_CATALOG[id];
    if (def.perk === perk) return true;
  }
  return false;
};
