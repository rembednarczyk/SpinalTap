import { type CharacterState, createCharacter } from "../character/character";
import { type Wallet, createWallet } from "../economy/wallet";
import type { CameraMode } from "../ports/types";
import { type QuestLog, startQuest } from "../quest/quest-graph";
import { QUEST_FIRST_CONTRACT } from "../quest/definitions";
import { type ReputationState, createReputation } from "../reputation/reputation";
import { type AbilityState, IDLE_ABILITY } from "../abilities/abilities";
import { type ContractLog, EMPTY_CONTRACTS } from "../contracts/contracts";
import { type AmmoPouch, type Equipment, type InventoryState, starterKit } from "../items/inventory";
import { EMPTY_LOOT, type LootState } from "../items/loot";
import { EMPTY_STORY, type StoryState } from "../story/story";
import { type GameClock, START_CLOCK } from "../time/game-clock";
import type { Flags } from "./flags";
import { type HeatState, NO_HEAT } from "../crime/rules";
import { INITIAL_NETRUN, type NetrunState } from "../hacking/netrun";
import { type BuffList, NO_BUFFS } from "../abilities/buffs";
import { type DisguiseState, NO_DISGUISE } from "../crime/disguise";
import { type MetroState, NO_METRO } from "../world/metro";
import { type EncounterLog, NO_ENCOUNTERS } from "../world/encounters";
import { INITIAL_PROGRESSION, type ProgressionState } from "../progression/progression";
import { type DifficultyProfile, NORMAL_DIFFICULTY } from "../difficulty/difficulty";

export interface Preferences {
  readonly cameraMode: CameraMode;
  /**
   * Journal entry the player chose to follow (a quest id or `contract-<id>`); the HUD and the
   * map show its objective. Absent: the game picks (the main thread, or the running contract).
   */
  readonly trackedQuest?: string;
}

/** Everything about the playthrough that is not an ECS component. */
export interface DomainState {
  readonly character: CharacterState;
  readonly wallet: Wallet;
  readonly reputation: ReputationState;
  readonly quests: QuestLog;
  readonly flags: Flags;
  readonly preferences: Preferences;
  /** Bag, worn and mounted pieces (ADR-0015). */
  readonly inventory: InventoryState;
  readonly equipment: Equipment;
  readonly ammo: AmmoPouch;
  /** Bags lying in the world, with their contents. */
  readonly loot: LootState;
  readonly contracts: ContractLog;
  readonly ability: AbilityState;
  /** Main-thread choices and the resolved ending. Ink variables are synced from it. */
  readonly story: StoryState;
  /** Time of day; the simulation advances it every step. Schedules and lighting follow it. */
  readonly clock: GameClock;
  /** The district security's pursuit (ADR-0029). */
  readonly heat: HeatState;
  /** The cyberdeck: RAM and the upload in progress (ADR-0029). */
  readonly netrun: NetrunState;
  /** Buffs from food, drinks and stims with the seconds left (ADR-0033). */
  readonly buffs: BuffList;
  /** Capacity shards used so far; each grows the cyberware capacity for good (ADR-0033). */
  readonly capacityShards: number;
  /** Who the player passes for, and whether someone saw through it (ADR-0033). */
  readonly disguise: DisguiseState;
  /** A metro ride in progress (ADR-0034). */
  readonly metro: MetroState;
  /** Street encounters already played (ADR-0034). */
  readonly encounters: EncounterLog;
  /** Experience, level, attributes and the points to spend (ADR-0059). */
  readonly progression: ProgressionState;
  /** The difficulty's multipliers (ADR-0066): an input of the simulation, like the seed. */
  readonly difficulty: DifficultyProfile;
}

export const createDomainState = (): DomainState => ({
  ...starterKit(),
  loot: EMPTY_LOOT,
  character: createCharacter(),
  wallet: createWallet(120),
  reputation: createReputation(),
  quests: startQuest({}, QUEST_FIRST_CONTRACT),
  flags: [],
  preferences: { cameraMode: "FPP" },
  contracts: EMPTY_CONTRACTS,
  ability: IDLE_ABILITY,
  story: EMPTY_STORY,
  clock: START_CLOCK,
  heat: NO_HEAT,
  netrun: INITIAL_NETRUN,
  buffs: NO_BUFFS,
  capacityShards: 0,
  disguise: NO_DISGUISE,
  metro: NO_METRO,
  encounters: NO_ENCOUNTERS,
  progression: INITIAL_PROGRESSION,
  difficulty: NORMAL_DIFFICULTY,
});
