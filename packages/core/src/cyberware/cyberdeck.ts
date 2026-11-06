import type { CharacterState } from "../character/character";
import { MIN_ITEM_LEVEL, clampItemLevel, levelScale } from "../items/grade";
import { RARITY } from "../items/rarity";
import type { Rarity } from "../items/types";
import type { DomainState } from "../state/domain-state";
import { workingCyberware } from "./active";
import { CYBERWARE_CATALOG, type CyberwareDefinition, type CyberwareId, type CyberwareSlot, installCyberware, uninstallCyberware } from "./cyberware";
import type { ImplantGrade, ImplantGrades } from "./implant-grade";

/**
 * The cyberdeck (decision of 6.11 after ADR-0059 stage 6): the one implant with a tier and a level,
 * like a weapon. It adds RAM to the pool, takes a share off every quickhack's upload and speeds up
 * the RAM regeneration, all scaled like weapon damage (the tier's `damage` × `levelScale`). An
 * installed one keeps its grade in `CharacterState.implantGrades`, by slot, so taking it out puts
 * the same piece back into the bag. First guesses, to be tuned in stage 8.
 */

export interface DeckStats {
  /** RAM added to the pool. */
  readonly ram: number;
  /** Multiplier of a quickhack's upload time (below 1 is faster). */
  readonly uploadScale: number;
  /** Multiplier of the RAM regeneration. */
  readonly regenScale: number;
}

export const NO_DECK: DeckStats = { ram: 0, uploadScale: 1, regenScale: 1 };

/** RAM a tier adds on top of the deck's own: one from rare on, two for a legendary one. */
export const DECK_TIER_RAM: Readonly<Record<Rarity, number>> = { common: 0, uncommon: 0, rare: 1, epic: 1, legendary: 2, unique: 0 };
/** One RAM more every this many item levels (15 and 30). */
export const DECK_LEVEL_RAM_EVERY = 15;
/** Never more than this share off the upload from the deck alone. */
export const MAX_DECK_UPLOAD = 0.3;

export const COMMON_GRADE: ImplantGrade = { rarity: "common", level: MIN_ITEM_LEVEL };

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Whether an implant has a tier and a level of its own (a cyberdeck). */
export const isGradedImplant = (id: CyberwareId): boolean => {
  const def: CyberwareDefinition = CYBERWARE_CATALOG[id];
  return def.deck !== undefined;
};

/** What a deck of this grade does; NO_DECK for an implant that is none. */
export const deckStats = (id: CyberwareId, grade: ImplantGrade = COMMON_GRADE): DeckStats => {
  const def: CyberwareDefinition = CYBERWARE_CATALOG[id];
  if (!def.deck) return NO_DECK;
  const level = clampItemLevel(grade.level);
  const power = RARITY[grade.rarity].damage * levelScale(level);
  return {
    ram: def.deck.ram + DECK_TIER_RAM[grade.rarity] + Math.floor(level / DECK_LEVEL_RAM_EVERY),
    uploadScale: round3(1 - Math.min(MAX_DECK_UPLOAD, def.deck.upload * power)),
    regenScale: round3(1 + def.deck.regen * power),
  };
};

/** The grade an installed implant has: its own for a deck (common level 1 when none is saved), else none. */
export const installedGrade = (character: Pick<CharacterState, "cyberware" | "implantGrades">, slot: CyberwareSlot): ImplantGrade | undefined => {
  const id = character.cyberware[slot];
  if (id === undefined || !isGradedImplant(id)) return undefined;
  return character.implantGrades?.[slot] ?? COMMON_GRADE;
};

/** The same implant of the same grade is already in its slot. */
export const isInstalled = (character: Pick<CharacterState, "cyberware" | "implantGrades">, id: CyberwareId, grade?: ImplantGrade): boolean => {
  const slot = CYBERWARE_CATALOG[id].slot;
  if (character.cyberware[slot] !== id) return false;
  if (!isGradedImplant(id)) return true;
  const have = installedGrade(character, slot) ?? COMMON_GRADE;
  const want = grade ?? COMMON_GRADE;
  return have.rarity === want.rarity && clampItemLevel(have.level) === clampItemLevel(want.level);
};

const withGrade = (grades: ImplantGrades | undefined, slot: CyberwareSlot, grade: ImplantGrade | undefined): Pick<CharacterState, "implantGrades"> => {
  const next: Partial<Record<CyberwareSlot, ImplantGrade>> = { ...grades };
  if (grade) next[slot] = { rarity: grade.rarity, level: clampItemLevel(grade.level) };
  else delete next[slot];
  return Object.keys(next).length > 0 ? { implantGrades: next } : {};
};

const withoutGrades = (character: CharacterState): CharacterState => {
  const { implantGrades: _, ...rest } = character;
  return rest;
};

export interface ImplantFit {
  readonly character: CharacterState;
  readonly replaced: CyberwareId | null;
  /** The grade of the replaced implant, when it had one. */
  readonly replacedGrade?: ImplantGrade;
}

/** Puts `id` into its slot with its grade (a deck only); the one there comes out with its own. */
export const fitImplant = (character: CharacterState, id: CyberwareId, grade?: ImplantGrade): ImplantFit => {
  const slot = CYBERWARE_CATALOG[id].slot;
  const replacedGrade = installedGrade(character, slot);
  const { loadout, replaced } = installCyberware(character.cyberware, id);
  const own = isGradedImplant(id) ? (grade ?? COMMON_GRADE) : undefined;
  const next = { ...withoutGrades(character), cyberware: loadout, ...withGrade(character.implantGrades, slot, own) };
  return replacedGrade ? { character: next, replaced, replacedGrade } : { character: next, replaced };
};

/** Empties a slot; the grade of what came out, if it had one. */
export const takeOutImplant = (character: CharacterState, slot: CyberwareSlot): { readonly character: CharacterState; readonly grade?: ImplantGrade } => {
  const grade = installedGrade(character, slot);
  const next = { ...withoutGrades(character), cyberware: uninstallCyberware(character.cyberware, slot), ...withGrade(character.implantGrades, slot, undefined) };
  return grade ? { character: next, grade } : { character: next };
};

/** The working deck's numbers (a deck over the pool does nothing, ADR-0059 stage 3c); NO_DECK without one. */
export const workingDeck = (domain: DomainState): DeckStats => {
  const working = workingCyberware(domain);
  for (const slot of Object.keys(working) as CyberwareSlot[]) {
    const id = working[slot];
    if (id !== undefined && isGradedImplant(id)) return deckStats(id, installedGrade(domain.character, slot));
  }
  return NO_DECK;
};
