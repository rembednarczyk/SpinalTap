import { type Contract, type EntityId, contractAlarmFlag, contractItemKey, contractKind, contractTerminalKey, takenFlag } from "@seki/core";
import { BREACH_DAEMONS } from "../world/street";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { clearContract, raiseFlag } from "../world/domain-ops";
import { raiseAlarm } from "./contract-system";
import { sabotageGoal, useSabotage } from "./sabotage-system";
import { plantableStation } from "./sabotage-loud";

import { callElevator } from "./elevator-system";
import { forceDoor } from "./door-system";
import { grabLadder } from "./ladder-system";
import { readHookTerminal } from "../world/hook-tracker";
import { helpPasserBy } from "../world/micro-events";
import { GRAB_PROMPT, TAKEDOWN_PROMPT } from "../world/takedown";
import { CARRY_PROMPT, DROP_PROMPT, HIDE_PROMPT, NO_ROOM_PROMPT } from "../world/bodies";

/** Is this the crate of the running retrieval job, or the data of an infiltration? */
const contractCrate = (ctx: SimContext, crate: Entity): boolean => {
  const contract = ctx.state.domain.contracts.active;
  const kind = contract ? contractKind(contract) : null;
  return contract?.status === "active" && (kind === "retrieve" || kind === "infiltrate") && crate.key === contractItemKey(contract.id);
};

/** The running hack job when this is its terminal. */
const hackTerminal = (ctx: SimContext, terminal: Entity): Contract | null => {
  const contract = ctx.state.domain.contracts.active;
  return contract?.status === "active" && contractKind(contract) === "hack" && terminal.key === contractTerminalKey(contract.id) ? contract : null;
};

/**
 * Would the key do the running job's work with this now (G-910): take its crate, start its hack or
 * open the breach, the sabotage's steps? Such a goal, the nearest thing in reach besides bags, goes
 * before the bags, so the dead of a fight by it do not take the key from the job.
 */
const jobGoal = (ctx: SimContext, e: Entity): boolean => {
  const hack = hackTerminal(ctx, e);
  if (hack) return hack.progress === undefined || !hack.breach;
  return contractCrate(ctx, e) || sabotageGoal(ctx, e);
};

/**
 * Picking up the crate of the running retrieval job, or the data of an infiltration (ADR-0024):
 * it leaves the world and the job is cleared.
 */
const takeContractCrate = (ctx: SimContext, crate: Entity): void => {
  if (!crate.key || !contractCrate(ctx, crate)) return;
  raiseFlag(ctx, takenFlag(crate.key));
  ctx.world.remove(crate);
  ctx.session.focusId = null;
  ctx.bus.emit("InteractionFocusChanged", { targetId: null, prompt: null });
  clearContract(ctx);
};

/** The terminal of the running hack job: the key starts the hack and the alarm (ADR-0024). */
const startHack = (ctx: SimContext, terminal: Entity): void => {
  const contract = hackTerminal(ctx, terminal);
  if (!contract || !terminal.key) return;
  // The terminal's network opens (ADR-0029): the HUD plays Breach Protocol and answers with
  // `breach-result`. A breach cut short sends nothing, so the key opens it again until one lands.
  if (!contract.breach) ctx.bus.emit("BreachStarted", { terminalKey: terminal.key, daemons: BREACH_DAEMONS });
  if (contract.progress !== undefined) return;
  const started = { ...contract, progress: 0, away: 0 };
  ctx.state.domain = { ...ctx.state.domain, contracts: { ...ctx.state.domain.contracts, active: started } };
  raiseAlarm(ctx, started);
};

/**
 * What the interact key does with a body (ADR-0065), if that holds the prompt: with a body on
 * her shoulder always (hide it in reach of a hiding place, else drop it, or say there is no room
 * to: hands full, nothing else), else a takedown or a body to pick up nearer than anything else, the nearer of the two
 * (a tie goes to the takedown). The key takes down and picks up only what the prompt names, so
 * the loser's target is cleared. A takedown under way keeps the key (ADR-0075): the grab offers
 * its choice, and the end chosen offers nothing.
 */
const bodyAction = (session: SimContext["session"], bestDist: number): { id: EntityId; prompt: string | null } | null => {
  if (session.carrying !== null) {
    session.takedownTarget = null;
    session.bodyTarget = null;
    if (session.hideSpot !== null) return { id: session.hideSpot, prompt: HIDE_PROMPT };
    return { id: session.carrying, prompt: session.dropRoom ? DROP_PROMPT : NO_ROOM_PROMPT };
  }
  const run = session.takedown;
  if (run) {
    session.takedownTarget = null;
    session.bodyTarget = null;
    return { id: run.target, prompt: run.phase === "grab" ? GRAB_PROMPT : null };
  }
  const takedown = session.takedownTarget;
  const body = session.bodyTarget;
  const takingDown = takedown !== null && takedown.distance < bestDist && (body === null || takedown.distance <= body.distance);
  // A tie with the bag a dead body dropped goes to the body: the bag is still there under it.
  const pickingUp = !takingDown && body !== null && body.distance <= bestDist;
  if (!takingDown) session.takedownTarget = null;
  if (!pickingUp) session.bodyTarget = null;
  if (takingDown) return { id: takedown.id, prompt: TAKEDOWN_PROMPT };
  return pickingUp ? { id: body.id, prompt: CARRY_PROMPT } : null;
};

/**
 * Does the job's goal go before a takedown or a body nearer too (G-910)? Only where the fight is on:
 * a station of the loud way, or any goal once the job's alarm is up. Elsewhere, at the core's
 * terminal of the silent way (3 m of reach to their 1.6 m), Seki must still grab a guard from
 * behind or pick up a body by it, so the nearer of the two takes the key as before.
 */
const goalFirst = (ctx: SimContext, goal: Entity): boolean => {
  const contract = ctx.state.domain.contracts.active;
  return plantableStation(ctx, goal) !== null || (!!contract && ctx.state.domain.flags.includes(contractAlarmFlag(contract.id)));
};

/** Vertical reach of the interact key, metres between feet (or the button's base). */
const INTERACT_REACH_Y = 1.6;

type Interactable = Entity & { interactable: NonNullable<Entity["interactable"]> };

/**
 * The interactable chosen in reach and the distance a takedown or a body must beat. When the
 * nearest of all but the bags is the job's goal, it is chosen and the bags step aside (G-910); a
 * door or a man nearer than the goal leaves the nearest of all chosen, bags with it.
 */
const nearest = (ctx: SimContext, player: Entity): { best: Interactable | null; bestDist: number } => {
  let best: Interactable | null = null;
  let bestDist = Infinity;
  let near: Interactable | null = null;
  let nearDist = Infinity;
  for (const e of ctx.world.with("interactable")) {
    // On a ladder the only way off is up, down or a jump. Nobody talks to someone knocked out.
    if ((e.interactable.kind === "ladder" && player.climb) || e.unconscious) continue;
    const d = Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);
    // Not through a floor: from the overpass nobody below is in reach (ADR-0020).
    if (Math.abs(e.position.y - player.position.y) > INTERACT_REACH_Y || d > e.interactable.radius) continue;
    if (d < bestDist) {
      best = e;
      bestDist = d;
    }
    if (e.interactable.kind !== "loot" && d < nearDist) {
      near = e;
      nearDist = d;
    }
  }
  if (!near || !jobGoal(ctx, near)) return { best, bestDist };
  return { best: near, bestDist: goalFirst(ctx, near) ? -Infinity : nearDist };
};

/**
 * Tracks the nearest interactable in reach and starts a dialogue on the interact edge; a
 * pickup is taken on the spot instead. A shop opens on any standing: a hostile owner charges
 * more and sells only the basics (ADR-0070). What an NPC on a daily plan offers can change with the hour
 * (see the schedule system). A takedown or a body (ADR-0065) nearer than anything else takes the
 * prompt, unless the job's goal goes first (G-910), and a carried body always does; the app answers its interact key with the `takedown`,
 * `carry-body` or `drop-body` command, so the key does nothing here.
 */
export const interactionSystem: System = {
  name: "interaction",
  run(ctx) {
    const { session, world } = ctx;
    if (session.dialogueActive || session.gameOver) return;
    const player = world.with("player").first;
    if (!player) return;
    const { best, bestDist } = nearest(ctx, player);
    const action = bodyAction(session, bestDist);
    const focusId = action ? action.id : (best?.id ?? null);
    const prompt = action ? action.prompt : (best?.interactable.prompt ?? null);
    if (focusId !== session.focusId || prompt !== session.focusPrompt) {
      session.focusId = focusId;
      session.focusPrompt = prompt;
      ctx.bus.emit("InteractionFocusChanged", { targetId: focusId, prompt });
    }
    if (best && !action && ctx.input.interact) {
      const { interactable } = best;
      if (interactable.kind === "elevator") {
        callElevator(ctx, interactable, player);
        return;
      }
      if (interactable.kind === "door") {
        forceDoor(ctx, best);
        return;
      }
      if (interactable.kind === "ladder") {
        if (interactable.ladder) grabLadder(ctx, player, interactable.ladder.key, interactable.ladder.end);
        return;
      }
      if (interactable.kind === "pickup") {
        takeContractCrate(ctx, best);
        return;
      }
      if (interactable.kind === "terminal") {
        startHack(ctx, best);
        useSabotage(ctx, best);
        return;
      }
      // Wave 2 (ADR-0034): a hook's mail, a passer-by in need.
      if (interactable.kind === "read") {
        readHookTerminal(ctx, best);
        return;
      }
      if (interactable.kind === "help") {
        helpPasserBy(ctx, best);
        return;
      }
      session.dialogueActive = true;
      session.focusId = null;
      session.focusPrompt = null;
      ctx.bus.emit("InteractionFocusChanged", { targetId: null, prompt: null });
      ctx.bus.emit("InteractionStarted", {
        targetId: best.id,
        dialogueId: interactable.dialogueId,
        kind: interactable.kind,
        ...(interactable.kind === "shop" ? { shopId: interactable.shopId ?? "clinic" } : {}),
        // A ticket kiosk (ADR-0034): the app opens the line map and answers with travel-metro.
        ...(interactable.station ? { station: interactable.station } : {}),
      });
    }
  },
};
