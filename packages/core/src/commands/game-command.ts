import type { MemoryId } from "../character/memories";
import type { CyberwareId } from "../cyberware/cyberware";
import type { ItemId } from "../inventory/inventory";
import type { FactionId } from "../reputation/reputation";

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
  | { readonly type: "complete-contract" };
