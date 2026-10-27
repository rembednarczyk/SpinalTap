import type { ContractKind } from "../contracts/kinds";
import type { MemoryId } from "../character/memories";
import type { CyberwareId } from "../cyberware/cyberware";
import type { FactionId } from "../reputation/reputation";
import type { StoryChoiceId, StoryOption } from "../story/story";
import type { EquipSlot, ItemRef, ModSlot, StackableId } from "../items/types";

/**
 * Requests from outside the simulation (narrative, UI). They are queued and applied at
 * the start of the next fixed step, so they are part of the deterministic input stream.
 */
export type GameCommand =
  | { readonly type: "set-flag"; readonly flag: string }
  | { readonly type: "change-reputation"; readonly faction: FactionId; readonly delta: number }
  | { readonly type: "unlock-memory"; readonly memoryId: MemoryId }
  | { readonly type: "set-alias"; readonly alias: string }
  | { readonly type: "end-dialogue" }
  | { readonly type: "buy-cyberware"; readonly cyberwareId: CyberwareId }
  | { readonly type: "buy-item"; readonly itemId: StackableId }
  /** Without `kind`: an elimination from Kaito. */
  | { readonly type: "accept-contract"; readonly kind?: ContractKind }
  /** Hands the package of a running delivery to Hana. */
  | { readonly type: "deliver-contract" }
  | { readonly type: "complete-contract" }
  /** Main-thread choice made in a memory flashback. The first answer sticks. */
  | { readonly type: "story-choice"; readonly choice: StoryChoiceId; readonly option: StoryOption }
  /** Closes act I: the sim resolves the ending from the recorded choices. */
  | { readonly type: "resolve-ending" }
  /**
   * Lets game time pass in one jump (ADR-0017), e.g. waiting for a stall to open. Whole game
   * minutes, at least 1. NPCs following a daily plan are put where it says at the new time.
   */
  | { readonly type: "wait"; readonly minutes: number }
  // Inventory and loot (ADR-0015). None of them consumes randomness.
  /** Puts a weapon or garment from the bag into its slot (or `slot`, for a weapon). */
  | { readonly type: "equip-item"; readonly uid: string; readonly slot?: EquipSlot }
  | { readonly type: "unequip-item"; readonly slot: EquipSlot }
  | { readonly type: "use-item"; readonly ref: ItemRef }
  /** Drops `qty` of a stack (an instance always drops whole) in a bag at the player's feet. */
  | { readonly type: "drop-item"; readonly ref: ItemRef; readonly qty: number }
  | { readonly type: "install-mod"; readonly weaponUid: string; readonly modUid: string }
  | { readonly type: "remove-mod"; readonly weaponUid: string; readonly slot: ModSlot }
  /** Takes one line of a loot container, or everything that fits. */
  | { readonly type: "take-loot"; readonly containerKey: string; readonly line: number | "all" };
