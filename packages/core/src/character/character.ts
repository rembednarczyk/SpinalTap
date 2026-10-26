import { type CyberwareLoadout, loadoutModifiers } from "../cyberware/cyberware";
import { MEMORY_CATALOG, type MemoryId } from "./memories";
import { BASE_STATS, type DerivedStats, combineModifiers } from "./stats";

export interface CharacterState {
  /** Name the player character goes by. Starts unknown; the fixer gives her an alias. */
  readonly alias: string | null;
  readonly memories: readonly MemoryId[];
  readonly cyberware: CyberwareLoadout;
}

export const createCharacter = (): CharacterState => ({
  alias: null,
  memories: [],
  cyberware: { optics: "hitomi_optics_mk1" },
});

export const deriveStats = (c: CharacterState): DerivedStats =>
  combineModifiers(BASE_STATS, [
    ...loadoutModifiers(c.cyberware),
    ...c.memories.map((id) => MEMORY_CATALOG[id].modifiers),
  ]);

export const hasMemory = (c: CharacterState, id: MemoryId): boolean => c.memories.includes(id);

/** Idempotent: unlocking a memory twice is a no-op. */
export const unlockMemory = (c: CharacterState, id: MemoryId): CharacterState =>
  hasMemory(c, id) ? c : { ...c, memories: [...c.memories, id] };

export const setAlias = (c: CharacterState, alias: string): CharacterState => ({ ...c, alias });
