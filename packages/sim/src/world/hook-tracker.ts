import { type Contract, type LootLine, contractKind, hasFlag, updateContainer } from "@seki/core";
import { type SimHookDef, hooksOfKind } from "../content/contract-hooks";
import { deadFlag } from "../systems/death-system";
import type { Entity } from "./components";
import type { SimContext, System } from "./context";
import { raiseFlag } from "./domain-ops";

/**
 * Observation hooks (ADR-0034). The table (content/contract-hooks.ts) gives each kind of job one
 * or two; this module hands them to the player while the job runs: a bark when the player is
 * within earshot of the guard, a mail read on a terminal, a datachip put into the bag of the
 * guard who carried it. Found hooks go into the contract log (and the save) and are reported
 * once with `ContractHookFound`.
 */

/** A guard's bark is heard this close (horizontally), and on the same level. */
export const BARK_RADIUS = 5;
const BARK_REACH_Y = 2;

/** The datachip a shard hook puts into its carrier's bag. */
const SHARD_LINE: LootLine = { kind: "stack", item: "datachip", qty: 1 };

const shardFlag = (contractId: string, hookId: string): string => `plan:shard:${contractId}:${hookId}`;

const carrierKey = (c: Contract, h: SimHookDef): string | null => {
  const carrier = h.carrier;
  if ("post" in carrier) return carrier.post < c.targets ? `${c.id}-g${carrier.post}` : null;
  return "key" in carrier ? carrier.key : null;
};

const running = (ctx: SimContext): Contract | null => {
  const c = ctx.state.domain.contracts.active;
  return c?.status === "active" ? c : null;
};

export const isHookFound = (ctx: SimContext, hookId: string): boolean => ctx.state.domain.contracts.hooks?.includes(hookId) ?? false;

/** Notes the hook as found and reports it, once per contract. */
export const findHook = (ctx: SimContext, c: Contract, h: SimHookDef): void => {
  if (isHookFound(ctx, h.id)) return;
  const log = ctx.state.domain.contracts;
  ctx.state.domain = { ...ctx.state.domain, contracts: { ...log, hooks: [...(log.hooks ?? []), h.id] } };
  ctx.bus.emit("ContractHookFound", { contractId: c.id, hookId: h.id, text: h.text });
};

/** Has a door code of the running job been found (the office camera then lets the player be)? */
export const codeKnown = (ctx: SimContext): boolean => {
  const c = running(ctx);
  return !!c && hooksOfKind(contractKind(c)).some((h) => h.reveal.kind === "code" && isHookFound(ctx, h.id));
};

/** The interact key on a hook terminal: the mail opens as a conversation of its knot. */
export const readHookTerminal = (ctx: SimContext, terminal: Entity): void => {
  const c = running(ctx);
  const knot = terminal.interactable?.dialogueId;
  const h = c ? hooksOfKind(contractKind(c)).find((x) => x.knot === knot) : undefined;
  if (!c || !h || !knot) return;
  findHook(ctx, c, h);
  ctx.session.dialogueActive = true;
  ctx.session.focusId = null;
  ctx.session.focusPrompt = null;
  ctx.bus.emit("InteractionFocusChanged", { targetId: null, prompt: null });
  ctx.bus.emit("InteractionStarted", { targetId: terminal.id, dialogueId: knot, kind: "dialogue" });
};

/** Something was taken from a bag: a shard hook's datachip from its carrier's bag is found. */
export const noteHookLoot = (ctx: SimContext, containerKey: string, taken: readonly LootLine[]): void => {
  const c = running(ctx);
  if (!c || !taken.some((l) => l.kind === "stack" && l.item === "datachip")) return;
  for (const h of hooksOfKind(contractKind(c))) {
    const key = h.source === "shard" ? carrierKey(c, h) : null;
    if (key && containerKey === `loot:${key}` && hasFlag(ctx.state.domain.flags, shardFlag(c.id, h.id))) findHook(ctx, c, h);
  }
};

const bark = (ctx: SimContext, c: Contract, h: SimHookDef, player: Entity): void => {
  const key = carrierKey(c, h);
  const speaker = key ? ctx.world.with("health").entities.find((e) => e.key === key) : undefined;
  if (!speaker) return;
  const near = Math.hypot(speaker.position.x - player.position.x, speaker.position.z - player.position.z) <= BARK_RADIUS;
  if (!near || Math.abs(speaker.position.y - player.position.y) > BARK_REACH_Y) return;
  ctx.bus.emit("GuardBark", { entityId: speaker.id, knot: h.knot });
  findHook(ctx, c, h);
};

/** The carrier of a shard is down: its bag gets the datachip (once). */
const dropShard = (ctx: SimContext, c: Contract, h: SimHookDef): void => {
  const key = carrierKey(c, h);
  const flag = shardFlag(c.id, h.id);
  if (!key || hasFlag(ctx.state.domain.flags, flag) || !hasFlag(ctx.state.domain.flags, deadFlag(key))) return;
  const bag = ctx.state.domain.loot.containers.find((b) => b.key === `loot:${key}`);
  if (!bag) return;
  ctx.state.domain = { ...ctx.state.domain, loot: updateContainer(ctx.state.domain.loot, bag.key, [...bag.lines, SHARD_LINE]) };
  raiseFlag(ctx, flag);
};

/** After the deaths (a shard's bag exists in the step its carrier fell). */
export const hookSystem: System = {
  name: "contract-hooks",
  run(ctx) {
    const c = running(ctx);
    const player = ctx.world.with("player").first;
    if (!c || !player || ctx.session.gameOver) return;
    for (const h of hooksOfKind(contractKind(c))) {
      if (isHookFound(ctx, h.id)) continue;
      if (h.source === "bark" && !ctx.session.dialogueActive) bark(ctx, c, h, player);
      else if (h.source === "shard") dropShard(ctx, c, h);
    }
  },
};
