import type { Vec3 } from "../math/vec3";
import type { CameraMode, EntityId } from "../ports/types";
import type { HitZone } from "../combat/combat-rules";
import type { FactionId } from "../reputation/reputation";
import type { CyberwareId } from "../cyberware/cyberware";
import type { ItemId } from "../inventory/inventory";
import type { PurchaseFailure } from "../shop/ripperdoc";
import type { Contract, ContractFailure } from "../contracts/contracts";
import type { EndingId, StoryChoiceId, StoryOption } from "../story/story";
import type { GameClock } from "../time/game-clock";

export interface DomainEvents {
  ShotFired: { shooterId: EntityId; from: Vec3; to: Vec3; hitEntity: EntityId | null };
  /** Weapon holstered (drawn: false) or being drawn (ready after DRAW_TIME). */
  WeaponToggled: { entityId: EntityId; drawn: boolean };
  /** `zone` is the body part the shot landed on (ADR-0016). */
  DamageDealt: { sourceId: EntityId; targetId: EntityId; amount: number; critical: boolean; zone: HitZone; at: Vec3 };
  EntityKilled: { entityId: EntityId; tag: string | null };
  PlayerDied: { entityId: EntityId };
  InteractionFocusChanged: { targetId: EntityId | null; prompt: string | null };
  /** kind "shop" opens the ripperdoc panel instead of an ink conversation. */
  InteractionStarted: { targetId: EntityId; dialogueId: string; kind: "dialogue" | "shop" };
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
  /** The job fell through (delivery too late, Oyaji killed). The contract is gone; nothing is paid. */
  ContractFailed: { contract: Contract; reason: ContractFailure };
  StoryChoiceMade: { choice: StoryChoiceId; option: StoryOption };
  EndingReached: { endingId: EndingId; title: string };
  /** Game time jumped forward (the `wait` command); `clock` is the new time. */
  TimeSkipped: { minutes: number; clock: GameClock };
}

/** "damage": the player was hit. "gunfire": a shot was fired close to the player. */
export type DialogueInterruptReason = "damage" | "gunfire";

/** "warn": a friendly ganger sizes the player up instead of shooting. "flee": a civilian runs away. */
export type NpcReaction = "warn" | "flee";

export type DomainEventType = keyof DomainEvents;
