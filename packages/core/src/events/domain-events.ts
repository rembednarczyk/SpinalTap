import type { Vec3 } from "../math/vec3";
import type { CameraMode, EntityId } from "../ports/types";
import type { HitZone } from "../combat/combat-rules";
import type { FactionId } from "../reputation/reputation";
import type { CyberwareId } from "../cyberware/cyberware";
import type { PurchaseFailure } from "../shop/ripperdoc";
import type { Contract } from "../contracts/contracts";
import type { EndingId, StoryChoiceId, StoryOption } from "../story/story";
import type { ConsumableId, EquipSlot, ItemDefId, ItemRef, LootLine, ModSlot, Rarity, StackableId, WeaponId, WeaponSlot } from "../items/types";

export interface DomainEvents {
  ShotFired: { shooterId: EntityId; from: Vec3; to: Vec3; hitEntity: EntityId | null };
  /** Weapon holstered (drawn: false) or being drawn (ready after DRAW_TIME). */
  WeaponToggled: { entityId: EntityId; drawn: boolean };
  /** `zone` is the body part the shot landed on (ADR-0016). */
  DamageDealt: { sourceId: EntityId; targetId: EntityId; amount: number; critical: boolean; zone: HitZone; at: Vec3 };
  EntityKilled: { entityId: EntityId; tag: string | null };
  PlayerDied: { entityId: EntityId };
  InteractionFocusChanged: { targetId: EntityId | null; prompt: string | null };
  /**
   * kind "shop" opens the ripperdoc panel instead of an ink conversation; kind "loot" opens the
   * loot panel, and `dialogueId` is then the container key.
   */
  InteractionStarted: { targetId: EntityId; dialogueId: string; kind: "dialogue" | "shop" | "loot" };
  /** The NPC will not deal with the player because of their faction's standing. */
  /**
   * A conversation or the shop was cut short by violence: the player was hurt, or someone
   * fired close by. The sim has already given the player control back.
   */
  DialogueInterrupted: { reason: DialogueInterruptReason; sourceId: EntityId };
  InteractionRefused: { targetId: EntityId; dialogueId: string; faction: FactionId };
  /** An NPC visibly reacted to the player's reputation (presentation cue only). */
  NpcReacted: { entityId: EntityId; faction: FactionId; reaction: NpcReaction };
  CameraModeChanged: { mode: CameraMode };
  QuestAdvanced: { questId: string; stepId: string; objective: string };
  QuestCompleted: { questId: string; title: string };
  /** `source` "loot": picked up from a bag (no payment toast). */
  EddiesChanged: { balance: number; delta: number; source?: "loot" };
  ReputationChanged: { faction: FactionId; value: number; delta: number };
  MemoryUnlocked: { memoryId: string; title: string; description: string };
  CyberwareInstalled: { cyberwareId: CyberwareId; replaced: CyberwareId | null; price: number };
  ItemBought: { itemId: StackableId; price: number };
  PurchaseFailed: { reason: PurchaseFailure };
  ItemUsed: { itemId: ConsumableId; healed: number };
  AbilityActivated: { abilityId: string; duration: number };
  AbilityEnded: { abilityId: string };
  ContractAccepted: { contract: Contract };
  ContractCleared: { contract: Contract };
  ContractCompleted: { contract: Contract; reward: number };
  StoryChoiceMade: { choice: StoryChoiceId; option: StoryOption };
  EndingReached: { endingId: EndingId; title: string };
  // Inventory, weapons and loot (ADR-0015).
  ItemAdded: { ref: ItemRef; defId: ItemDefId; qty: number; source: ItemSource };
  ItemRemoved: { ref: ItemRef; qty: number; reason: "used" | "dropped" };
  ItemEquipped: { uid: string; slot: EquipSlot; replaced: string | null };
  ItemUnequipped: { uid: string; slot: EquipSlot };
  ModInstalled: { weaponUid: string; modUid: string; slot: ModSlot };
  ModRemoved: { weaponUid: string; modUid: string; slot: ModSlot };
  /** Something did not fit: the item stays where it was (loot bag, weapon). */
  InventoryFull: { defId: ItemDefId };
  WeaponSwitched: { entityId: EntityId; slot: WeaponSlot; weapon: WeaponId };
  ReloadStarted: { entityId: EntityId; duration: number };
  ReloadFinished: { entityId: EntityId; loaded: number };
  LootDropped: { containerKey: string; at: Vec3; best: Rarity | null };
  /** `lines` were moved to the player; `left` lines stayed in the container. */
  LootTaken: { containerKey: string; lines: readonly LootLine[]; left: number };
  LootExpired: { containerKey: string };
}

export type ItemSource = "loot" | "shop" | "quest" | "clinic";

/** "damage": the player was hit. "gunfire": a shot was fired close to the player. */
export type DialogueInterruptReason = "damage" | "gunfire";

/** "warn": a friendly ganger sizes the player up instead of shooting. "flee": a civilian runs away. */
export type NpcReaction = "warn" | "flee";

export type DomainEventType = keyof DomainEvents;
