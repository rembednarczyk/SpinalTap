import { type CharacterState, createCharacter } from "../character/character";
import { type Wallet, createWallet } from "../economy/wallet";
import type { CameraMode } from "../ports/types";
import { type QuestLog, startQuest } from "../quest/quest-graph";
import { QUEST_FIRST_CONTRACT } from "../quest/definitions";
import { type ReputationState, createReputation } from "../reputation/reputation";
import { type AbilityState, IDLE_ABILITY } from "../abilities/abilities";
import { type ContractLog, EMPTY_CONTRACTS } from "../contracts/contracts";
import type { Inventory } from "../inventory/inventory";
import { EMPTY_STORY, type StoryState } from "../story/story";
import { type GameClock, START_CLOCK } from "../time/game-clock";
import type { Flags } from "./flags";

export interface Preferences {
  readonly cameraMode: CameraMode;
}

/** Everything about the playthrough that is not an ECS component. */
export interface DomainState {
  readonly character: CharacterState;
  readonly wallet: Wallet;
  readonly reputation: ReputationState;
  readonly quests: QuestLog;
  readonly flags: Flags;
  readonly preferences: Preferences;
  readonly inventory: Inventory;
  readonly contracts: ContractLog;
  readonly ability: AbilityState;
  /** Main-thread choices and the resolved ending. Ink variables are synced from it. */
  readonly story: StoryState;
  /** Time of day; the simulation advances it every step. Schedules and lighting follow it. */
  readonly clock: GameClock;
}

export const createDomainState = (): DomainState => ({
  character: createCharacter(),
  wallet: createWallet(120),
  reputation: createReputation(),
  quests: startQuest({}, QUEST_FIRST_CONTRACT),
  flags: [],
  preferences: { cameraMode: "FPP" },
  inventory: { medkit: 1 },
  contracts: EMPTY_CONTRACTS,
  ability: IDLE_ABILITY,
  story: EMPTY_STORY,
  clock: START_CLOCK,
});
