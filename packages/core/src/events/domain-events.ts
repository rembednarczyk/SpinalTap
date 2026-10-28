import type { Vec3 } from "../math/vec3";
import type { CameraMode, EntityId } from "../ports/types";
import type { HitZone } from "../combat/combat-rules";
import type { FactionId } from "../reputation/reputation";
import type { CyberwareId, CyberwareSlot } from "../cyberware/cyberware";
import type { PurchaseFailure } from "../shop/ripperdoc";
import type { ShopId, ShopItemId } from "../shop/shops";
import type { Contract, ContractFailure } from "../contracts/contracts";
import type { ActTwoEndingId, EndingId, StoryChoiceId, StoryOption } from "../story/story";
import type { ConsumableId, EquipSlot, ItemDefId, ItemRef, LootLine, ModSlot, Rarity, WeaponId, WeaponSlot } from "../items/types";
import type { GameClock } from "../time/game-clock";
import type { BreachDaemonId, QuickhackFailure, QuickhackId } from "../hacking/quickhacks";
import type { CrimeKind, CrowdState, DisturbanceKind, HeatLevel, WitnessChannel } from "../crime/heat";
import type { BonusCondition, ContractBadge, ContractRank } from "../contracts/debrief";

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
   * loot panel, and `dialogueId` is then the container key. A shop says which one (`shopId`,
   * the clinic when absent); `dialogueId` is then the shopkeeper's ink knot.
   */
  InteractionStarted: { targetId: EntityId; dialogueId: string; kind: "dialogue" | "shop" | "loot"; shopId?: ShopId };
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
  /** `source` "loot": picked up from a bag; "sale": paid by a trader (no payment toast for either). */
  EddiesChanged: { balance: number; delta: number; source?: "loot" | "sale" };
  ReputationChanged: { faction: FactionId; value: number; delta: number };
  MemoryUnlocked: { memoryId: string; title: string; description: string };
  /**
   * `fromBag`: fitted from the inventory for a fee (`price`). `stowed`: the replaced implant went
   * into the bag (false when there was no room and it is gone).
   */
  CyberwareInstalled: { cyberwareId: CyberwareId; replaced: CyberwareId | null; price: number; fromBag?: boolean; stowed?: boolean };
  /** Taken out at the clinic, into the bag. */
  CyberwareRemoved: { cyberwareId: CyberwareId; slot: CyberwareSlot };
  /** `qty` is the number of rounds for a box of ammo, otherwise 1. */
  ItemBought: { itemId: ShopItemId; price: number; shopId?: ShopId; qty?: number };
  PurchaseFailed: { reason: PurchaseFailure; shopId?: ShopId };
  ItemSold: { shopId: ShopId; defId: ItemDefId; qty: number; price: number };
  /** A garment mended to 100; `parts` pieces of "Części broni" went into it. */
  ItemRepaired: { uid: string; defId: ItemDefId; price: number; parts: number };
  /** The backpack grew to `capacity` cells. */
  CapacityUpgraded: { capacity: number; price: number };
  ItemUsed: { itemId: ConsumableId; healed: number };
  AbilityActivated: { abilityId: string; duration: number };
  AbilityEnded: { abilityId: string };
  ContractAccepted: { contract: Contract };
  ContractCleared: { contract: Contract };
  ContractCompleted: { contract: Contract; reward: number };
  /** The job fell through (delivery too late, Oyaji killed). The contract is gone; nothing is paid. */
  ContractFailed: { contract: Contract; reason: ContractFailure };
  /** A docks job's second phase began (ADR-0024): the escort's ambush, the hack's wave. */
  ContractAlarm: { contract: Contract };
  /**
   * A sniper (ADR-0024) started aiming at `targetId`: its laser is on and it fires in `duration`
   * seconds unless the target breaks the line. `duration` 0 turns the laser off (shot, lost sight).
   */
  SniperAimed: { entityId: EntityId; targetId: EntityId; duration: number };
  StoryChoiceMade: { choice: StoryChoiceId; option: StoryOption };
  EndingReached: { act: 1 | 2; endingId: EndingId | ActTwoEndingId; title: string };
  /** Game time jumped forward (the `wait` command); `clock` is the new time. */
  TimeSkipped: { minutes: number; clock: GameClock };
  // Inventory, weapons and loot (ADR-0015).
  ItemAdded: { ref: ItemRef; defId: ItemDefId; qty: number; source: ItemSource };
  ItemRemoved: { ref: ItemRef; qty: number; reason: "used" | "dropped" | "sold" | "installed" | "repair" };
  ItemEquipped: { uid: string; slot: EquipSlot; replaced: string | null };
  ItemUnequipped: { uid: string; slot: EquipSlot };
  ModInstalled: { weaponUid: string; modUid: string; slot: ModSlot };
  ModRemoved: { weaponUid: string; modUid: string; slot: ModSlot };
  /** Something did not fit: the item stays where it was (loot bag, weapon). */
  InventoryFull: { defId: ItemDefId };
  WeaponSwitched: { entityId: EntityId; slot: WeaponSlot; weapon: WeaponId };
  ReloadStarted: { entityId: EntityId; duration: number };
  ReloadFinished: { entityId: EntityId; loaded: number };
  // Melee (ADR-0019).
  /** A swing started; it lands after `windup` seconds and is followed by `recovery`. */
  MeleeSwing: { entityId: EntityId; strike: number; windup: number; recovery: number };
  /** A swing landed: `hits` bodies taken (0 for a miss). */
  MeleeStrike: { entityId: EntityId; strike: number; hits: number };
  /** A guard met an attack; a parried melee blow did no damage and stunned the attacker. */
  AttackBlocked: { attackerId: EntityId; defenderId: EntityId; parried: boolean; kind: "melee" | "projectile"; at: Vec3 };
  /** Knocked off balance: whatever it was doing (a swing, a guard) is cut short. */
  Staggered: { entityId: EntityId; duration: number; cause: "hit" | "parry" };
  // Jumps, falls and ladders (ADR-0021).
  /** Left the ground on a jump. */
  Jumped: { entityId: EntityId; at: Vec3 };
  /**
   * Back on the ground after a jump or a fall from `drop` metres (from the highest point).
   * `hard` landings slow the character for a moment; `damage` is the fall damage, 0 below the
   * threshold. The damage itself also goes out as `DamageDealt` (zone "leg", source = target).
   */
  Landed: { entityId: EntityId; drop: number; hard: boolean; damage: number; at: Vec3 };
  /** Caught a ledge in the air and pulls up onto it, ending at `at`. */
  Mantled: { entityId: EntityId; at: Vec3 };
  /** Got on (`on`) or off a ladder. */
  LadderClimb: { entityId: EntityId; ladder: string; on: boolean };
  LootDropped: { containerKey: string; at: Vec3; best: Rarity | null };
  /** `lines` were moved to the player; `left` lines stayed in the container. */
  LootTaken: { containerKey: string; lines: readonly LootLine[]; left: number };
  LootExpired: { containerKey: string };
  // Crime, crowds and heat (ADR-0028).
  /** Something the street notices, heard or seen up to `radius` metres from `at`. */
  Disturbance: { kind: DisturbanceKind; at: Vec3; radius: number; sourceId: EntityId };
  /** A bystander's reaction changed (presentation: animation, bark, minimap). */
  CrowdReacted: { entityId: EntityId; state: CrowdState };
  /** A civilian started phoning it in; the call lands after `duration` seconds unless cut off. */
  WitnessCalling: { witnessId: EntityId; crime: CrimeKind; duration: number };
  /** A crime reached the district's security. `witnessId` is the civilian, camera or patrol. */
  CrimeReported: { crime: CrimeKind; channel: WitnessChannel; witnessId: EntityId; offenderId: EntityId; at: Vec3 };
  /**
   * The pursuit changed. `searching`: the security lost sight and looks around `lastKnown`;
   * the heat drops one level when `searchLeft` seconds run out with the player unseen.
   */
  HeatChanged: { level: HeatLevel; previous: HeatLevel; searching: boolean; lastKnown: Vec3 | null; searchLeft: number };
  /**
   * An enemy's awareness of the player (stealth feedback for the HUD). `level` 0..1 fills the
   * suspicion; `lastKnown` is where it last saw the player (Deus Ex style silhouette).
   */
  AwarenessChanged: { observerId: EntityId; state: AwarenessState; level: number; lastKnown: Vec3 | null };
  // Scanner and quickhacks (ADR-0028).
  /** The scanner focused something that can be scanned (null: nothing). */
  ScanFocusChanged: { targetId: EntityId | null };
  QuickhackStarted: { hackId: QuickhackId; targetId: EntityId; upload: number; ram: number };
  QuickhackApplied: { hackId: QuickhackId; targetId: EntityId; duration: number };
  QuickhackFailed: { hackId: QuickhackId; targetId: EntityId; reason: QuickhackFailure };
  /** The upload was noticed: the target's network knows where the player is. */
  QuickhackTraced: { hackId: QuickhackId; targetId: EntityId };
  RamChanged: { current: number; max: number };
  /** A terminal breach ended (the UI minigame sends the result as a command). */
  BreachCompleted: { terminalKey: string; daemons: readonly BreachDaemonId[] };
  // Contract layer (ADR-0028).
  /** The optional condition of the running contract is still on (`kept`) or lost for good. */
  ContractBonusChanged: { contractId: string; condition: BonusCondition; kept: boolean };
  /** End-of-contract card: what was earned and how it was paid. Sent after ContractCompleted. */
  ContractDebrief: {
    contractId: string;
    badges: readonly ContractBadge[];
    rank: ContractRank;
    reward: number;
    bonus: number;
    styleBonus: number;
    seconds: number;
  };
  /** A text or a call on the phone (ADR-0028); the app renders `knot` from ink. */
  PhoneMessage: { from: string; kind: "text" | "call"; knot: string; priority: PhonePriority };
}

/** Awareness of the player, from not noticing to fighting. */
export type AwarenessState = "unaware" | "suspicious" | "searching" | "alerted";

/** "story" interrupts (a holocall), "contract" queues, "info" waits for a quiet moment. */
export type PhonePriority = "story" | "contract" | "info";

export type ItemSource = "loot" | "shop" | "quest" | "clinic";

/** "damage": the player was hit. "gunfire": a shot was fired close to the player. */
export type DialogueInterruptReason = "damage" | "gunfire";

/** "warn": a friendly ganger sizes the player up instead of shooting. "flee": a civilian runs away. */
export type NpcReaction = "warn" | "flee";

export type DomainEventType = keyof DomainEvents;
