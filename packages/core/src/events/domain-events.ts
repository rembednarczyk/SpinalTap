import type { Vec3 } from "../math/vec3";
import type { CameraMode, EntityId } from "../ports/types";
import type { FactionId } from "../reputation/reputation";
import type { CyberwareId } from "../cyberware/cyberware";
import type { ItemId } from "../inventory/inventory";
import type { PurchaseFailure } from "../shop/ripperdoc";
import type { Contract } from "../contracts/contracts";

export interface DomainEvents {
  ShotFired: { shooterId: EntityId; from: Vec3; to: Vec3; hitEntity: EntityId | null };
  DamageDealt: { sourceId: EntityId; targetId: EntityId; amount: number; critical: boolean; headshot: boolean; at: Vec3 };
  EntityKilled: { entityId: EntityId; tag: string | null };
  PlayerDied: { entityId: EntityId };
  InteractionFocusChanged: { targetId: EntityId | null; prompt: string | null };
  /** kind "shop" opens the ripperdoc panel instead of an ink conversation. */
  InteractionStarted: { targetId: EntityId; dialogueId: string; kind: "dialogue" | "shop" };
  CameraModeChanged: { mode: CameraMode };
  QuestAdvanced: { questId: string; stepId: string; objective: string };
  QuestCompleted: { questId: string; title: string };
  EddiesChanged: { balance: number; delta: number };
  ReputationChanged: { faction: FactionId; value: number; delta: number };
  MemoryUnlocked: { memoryId: string; title: string; description: string };
  CyberwareInstalled: { cyberwareId: CyberwareId; replaced: CyberwareId | null; price: number };
  ItemBought: { itemId: ItemId; price: number };
  PurchaseFailed: { reason: PurchaseFailure };
  ItemUsed: { itemId: ItemId; healed: number };
  AbilityActivated: { abilityId: string; duration: number };
  AbilityEnded: { abilityId: string };
  ContractAccepted: { contract: Contract };
  ContractCleared: { contract: Contract };
  ContractCompleted: { contract: Contract; reward: number };
}

export type DomainEventType = keyof DomainEvents;
