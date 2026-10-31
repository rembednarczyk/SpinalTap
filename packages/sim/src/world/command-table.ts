import type { GameCommand } from "@seki/core";
import type { SimContext } from "./context";
import { acceptContract, applyBreach, completeContract, deliverContract } from "./contract-commands";
import { applyItemCommand } from "./item-commands";
import { applyAlias, applyResolveEnding, changeReputation, endDialogue, setFlag, storyChoice, unlockMemory, trackQuest, waitMinutes } from "./story-commands";
import { applyTradeCommand } from "./trade-commands";
import { travelMetro } from "./metro-ride";
import { spendAttribute } from "./progression-ops";

type CommandType = GameCommand["type"];

/**
 * Applies one command. It gets the step's context (domain holder, world, bus, streamer, session,
 * random stream), never the Simulation itself.
 */
export type CommandHandler<K extends CommandType> = (ctx: SimContext, cmd: Extract<GameCommand, { type: K }>) => void;

/** One handler per command type: a command without one does not compile (ADR-0031). */
export type CommandHandlers = { readonly [K in CommandType]: CommandHandler<K> };

/** Grouped by area; the item and trade groups each share one handler. */
export const COMMAND_HANDLERS: CommandHandlers = {
  // Dialogue and story.
  "set-flag": setFlag,
  "change-reputation": changeReputation,
  "unlock-memory": unlockMemory,
  "set-alias": applyAlias,
  "end-dialogue": endDialogue,
  "story-choice": storyChoice,
  "resolve-ending": applyResolveEnding,
  wait: waitMinutes,
  "track-quest": trackQuest,
  // Character progression (ADR-0059).
  "spend-attribute-point": spendAttribute,
  // Contracts and hacking.
  "accept-contract": acceptContract,
  "deliver-contract": deliverContract,
  "complete-contract": completeContract,
  "breach-result": applyBreach,
  // Trading (plan §6, ADR-0015).
  "buy-cyberware": applyTradeCommand,
  "buy-item": applyTradeCommand,
  "sell-item": applyTradeCommand,
  "repair-item": applyTradeCommand,
  "upgrade-capacity": applyTradeCommand,
  "install-cyberware-item": applyTradeCommand,
  "remove-cyberware": applyTradeCommand,
  // Inventory and loot (ADR-0015).
  "equip-item": applyItemCommand,
  "unequip-item": applyItemCommand,
  "use-item": applyItemCommand,
  "drop-item": applyItemCommand,
  "install-mod": applyItemCommand,
  "remove-mod": applyItemCommand,
  "take-loot": applyItemCommand,
  // Wave 2 (ADR-0032, ADR-0034).
  "travel-metro": travelMetro,
};

/** Dispatches a command to its handler; an unknown type (a corrupt replay) changes nothing. */
export const applyCommand = (ctx: SimContext, cmd: GameCommand): void => {
  if (!Object.hasOwn(COMMAND_HANDLERS, cmd.type)) return;
  // The table pairs every key with the handler for that very command, so the lookup fits `cmd`.
  const handler = COMMAND_HANDLERS[cmd.type] as CommandHandler<CommandType>;
  handler(ctx, cmd);
};
