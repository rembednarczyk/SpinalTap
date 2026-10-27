import type { ContractKind } from "../contracts/kinds";
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
  /** Without `kind`: an elimination from Kaito. */
  | { readonly type: "accept-contract"; readonly kind?: ContractKind }
  /** Hands the package of a running delivery to Hana. */
  | { readonly type: "deliver-contract" }
  | { readonly type: "complete-contract" }
  /** Main-thread choice made in a memory flashback. The first answer sticks. */
  | { readonly type: "story-choice"; readonly choice: StoryChoiceId; readonly option: StoryOption }
  /** Closes act I: the sim resolves the ending from the recorded choices. */
  | { readonly type: "resolve-ending" };
