import {
  ACT_ONE_ENDING_FLAG,
  ACT_TWO_ENDINGS,
  ACT_TWO_ENDING_FLAG,
  ENDINGS,
  type GameCommand,
  SECONDS_PER_MINUTE,
  advanceClock,
  endingFlag,
  recordChoice,
  resolveActTwoEnding,
  resolveEnding,
  setActTwoEnding,
  setAlias,
  setEnding,
} from "@seki/core";
import type { SimContext } from "./context";
import { adjustReputation, grantMemory, raiseFlag } from "./domain-ops";
import { inCreationOrder } from "./ordering";
import { placeOnSchedule } from "./schedule";
import { endEncounter } from "./street-scenes";

type Command<K extends GameCommand["type"]> = Extract<GameCommand, { type: K }>;

/** Dialogue and narrative effects: flags, reputation, memories, the alias, closing a dialogue. */
export const setFlag = (ctx: SimContext, cmd: Command<"set-flag">): void => raiseFlag(ctx, cmd.flag);

export const changeReputation = (ctx: SimContext, cmd: Command<"change-reputation">): void => adjustReputation(ctx, cmd.faction, cmd.delta);

export const unlockMemory = (ctx: SimContext, cmd: Command<"unlock-memory">): void => grantMemory(ctx, cmd.memoryId);

export const applyAlias = (ctx: SimContext, cmd: Command<"set-alias">): void => {
  ctx.state.domain = { ...ctx.state.domain, character: setAlias(ctx.state.domain.character, cmd.alias) };
};

export const endDialogue = (ctx: SimContext): void => {
  ctx.session.dialogueActive = false;
  // A street encounter's scene is over (ADR-0034).
  endEncounter(ctx);
};

/** A main-thread choice; the first answer sticks, a repeat changes nothing. */
export const storyChoice = (ctx: SimContext, cmd: Command<"story-choice">): void => {
  const story = recordChoice(ctx.state.domain.story, cmd.choice, cmd.option);
  if (story === ctx.state.domain.story) return;
  ctx.state.domain = { ...ctx.state.domain, story };
  ctx.bus.emit("StoryChoiceMade", { choice: cmd.choice, option: cmd.option });
};

/** Lets game time pass in one jump (ADR-0017). */
export const waitMinutes = (ctx: SimContext, cmd: Command<"wait">): void => {
  const minutes = Math.floor(cmd.minutes);
  if (!(minutes >= 1)) return;
  const clock = advanceClock(ctx.state.domain.clock, minutes * SECONDS_PER_MINUTE);
  ctx.state.domain = { ...ctx.state.domain, clock };
  // A cut, not a fast-forward: everyone on a daily plan is where it says at the new time.
  for (const e of inCreationOrder(ctx.world.with("schedule"))) {
    if (!e.ai?.alerted) placeOnSchedule(e, e.schedule.def, clock);
  }
  ctx.bus.emit("TimeSkipped", { minutes, clock });
};

/**
 * Closes act II (ADR-0023): only after act I and the archive choice, once. The ending moves the
 * factions it names and may bring a memory, whose flashback then plays like any other.
 */
const resolveActTwo = (ctx: SimContext): void => {
  const domain = ctx.state.domain;
  const ending = resolveActTwoEnding(domain.story.choices);
  if (!domain.story.ending || domain.story.act2Ending || !ending) return;
  ctx.state.domain = { ...domain, story: setActTwoEnding(domain.story, ending) };
  const def = ACT_TWO_ENDINGS[ending];
  for (const { faction, delta } of def.reputation) adjustReputation(ctx, faction, delta);
  if ("memory" in def) grantMemory(ctx, def.memory);
  raiseFlag(ctx, ACT_TWO_ENDING_FLAG);
  raiseFlag(ctx, endingFlag(ending));
  ctx.bus.emit("EndingReached", { act: 2, endingId: ending, title: def.title });
};

/** Closes act I once, or act II with `act: 2`. */
export const applyResolveEnding = (ctx: SimContext, cmd: Command<"resolve-ending">): void => {
  if (cmd.act === 2) {
    resolveActTwo(ctx);
    return;
  }
  const domain = ctx.state.domain;
  if (domain.story.ending) return;
  const ending = resolveEnding(domain.story.choices);
  ctx.state.domain = { ...domain, story: setEnding(domain.story, ending) };
  raiseFlag(ctx, ACT_ONE_ENDING_FLAG);
  raiseFlag(ctx, endingFlag(ending));
  ctx.bus.emit("EndingReached", { act: 1, endingId: ending, title: ENDINGS[ending].title });
};
