import type { Vec3 } from "../math/vec3";
import type { CameraMode, EntityId } from "../ports/types";
import type { FactionId } from "../reputation/reputation";

export interface DomainEvents {
  ShotFired: { shooterId: EntityId; from: Vec3; to: Vec3; hitEntity: EntityId | null };
  DamageDealt: { sourceId: EntityId; targetId: EntityId; amount: number; critical: boolean; at: Vec3 };
  EntityKilled: { entityId: EntityId; tag: string | null };
  PlayerDied: { entityId: EntityId };
  InteractionFocusChanged: { targetId: EntityId | null; prompt: string | null };
  InteractionStarted: { targetId: EntityId; dialogueId: string };
  CameraModeChanged: { mode: CameraMode };
  QuestAdvanced: { questId: string; stepId: string; objective: string };
  QuestCompleted: { questId: string; title: string };
  EddiesChanged: { balance: number; delta: number };
  ReputationChanged: { faction: FactionId; value: number; delta: number };
  MemoryUnlocked: { memoryId: string; title: string; description: string };
}

export type DomainEventType = keyof DomainEvents;
