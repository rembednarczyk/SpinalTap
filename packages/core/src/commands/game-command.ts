import type { MemoryId } from "../character/memories";
import type { CyberwareId } from "../cyberware/cyberware";
import type { ItemId } from "../inventory/inventory";
import type { FactionId } from "../reputation/reputation";
import type { StoryChoiceId, StoryOption } from "../story/story";

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
  | { readonly type: "buy-item"; readonly itemId: ItemId }
  | { readonly type: "accept-contract" }
  | { readonly type: "complete-contract" }
  /** Main-thread choice made in a memory flashback. The first answer sticks. */
  | { readonly type: "story-choice"; readonly choice: StoryChoiceId; readonly option: StoryOption }
  /** Closes act I: the sim resolves the ending from the recorded choices. */
  | { readonly type: "resolve-ending" }
  /**
   * Lets game time pass in one jump (ADR-0015), e.g. waiting for a stall to open. Whole game
   * minutes, at least 1. NPCs following a daily plan are put where it says at the new time.
   */
  | { readonly type: "wait"; readonly minutes: number };
