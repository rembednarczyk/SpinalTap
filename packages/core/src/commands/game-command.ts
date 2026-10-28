import type { ContractKind } from "../contracts/kinds";
import type { MemoryId } from "../character/memories";
import type { CyberwareId, CyberwareSlot } from "../cyberware/cyberware";
import type { FactionId } from "../reputation/reputation";
import type { ShopId, ShopItemId } from "../shop/shops";
import type { StoryChoiceId, StoryOption } from "../story/story";
import type { EquipSlot, ItemRef, ModSlot } from "../items/types";
import type { BreachDaemonId } from "../hacking/quickhacks";
import type { MetroStationId } from "../world/wave2";

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
  /** One entry of a shop's stock; without `shopId` the clinic (medkits, bandages). */
  | { readonly type: "buy-item"; readonly itemId: ShopItemId; readonly shopId?: ShopId }
  // Trading (plan §6, E10 and E11). The app sends them only while that shop's panel is open;
  // the simulation still refuses the stall outside its hours.
  /** Sells `qty` of a stack, or one loose piece (`qty` ignored). */
  | { readonly type: "sell-item"; readonly shopId: ShopId; readonly ref: ItemRef; readonly qty: number }
  /** Mends a garment at Oyaji's stall; up to `useParts` "Części broni" lower the price. */
  | { readonly type: "repair-item"; readonly uid: string; readonly useParts: number }
  /** The next backpack upgrade at Oyaji's stall. */
  | { readonly type: "upgrade-capacity" }
  /** Doktor Mori fits an implant from the bag for a fee; the replaced one goes into the bag. */
  | { readonly type: "install-cyberware-item"; readonly uid: string }
  /** Doktor Mori takes an implant out, free, into the bag. */
  | { readonly type: "remove-cyberware"; readonly slot: CyberwareSlot }
  /** Without `kind`: an elimination from Kaito. */
  | { readonly type: "accept-contract"; readonly kind?: ContractKind }
  /** Hands the package of a running delivery to Hana. */
  | { readonly type: "deliver-contract" }
  | { readonly type: "complete-contract" }
  /** Main-thread choice made in a memory flashback. The first answer sticks. */
  | { readonly type: "story-choice"; readonly choice: StoryChoiceId; readonly option: StoryOption }
  /** Closes act I (or, with `act: 2`, act II): the sim resolves the ending from the recorded choices. */
  | { readonly type: "resolve-ending"; readonly act?: 1 | 2 }
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
  | { readonly type: "take-loot"; readonly containerKey: string; readonly line: number | "all" }
  // Hacking (ADR-0028).
  /**
   * The result of the terminal minigame (or its auto-solve, which wins fewer daemons). The UI
   * plays the puzzle; the simulation only applies what was won. Disconnecting sends what was
   * won so far (possibly nothing); a breach cut short by damage sends nothing and the terminal
   * can be breached again.
   */
  | { readonly type: "breach-result"; readonly terminalKey: string; readonly daemons: readonly BreachDaemonId[] }
  // Wave 2 (ADR-0032).
  /** Buys a ticket at the platform the player stands on and rides to `to`. */
  | { readonly type: "travel-metro"; readonly to: MetroStationId };
