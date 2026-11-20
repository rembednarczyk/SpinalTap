import { MICRO_EVENT_REWARD, type MicroEventKind, type Vec3 } from "@seki/core";
import { deadFlag } from "../systems/death-system";
import type { Entity } from "./components";
import type { MicroEventRun, SimContext } from "./context";
import { lowerFlag } from "./domain-ops";
import { GANGER_MAX_HP, gangerEntity, toughen } from "./factory";
import { enemyScalingIn } from "./enemy-scaling";
import { passerBy, payReward, thankedByStreet } from "./street-scenes";
import { type BoardCrime, CRIME_LEAVE, closeCrime } from "./street-crimes";
import { POSTS, alarmed, crimeProps, getaway, hasVictim, leave } from "./crime-scenes";
import { assistStep, crewTurned, offerAssist } from "./crime-assist";

/**
 * The street's crimes in progress (ADR-0034, ADR-0091 stage 5): a crime of the board starts at its
 * spot once the player comes within reach (`street-crimes.ts`): two Hebi rob a passer-by (a fight),
 * a passer-by has collapsed (help with the interact key), or the kinds round a thing of the street
 * of `crime-scenes.ts`. Done, it pays eddies and standing with the civilians. The people of it are
 * transient: a save leaves them out, and walking away (or a metro ride) ends it with nothing; the
 * crime stays on the board until its slot is over. The rolls on entering a district of ADR-0034
 * went with stage 5b: the board holds every crime of the street.
 */

const VICTIM_HP = 60;

/** Keys of a micro-event's people start with this (`micro-key.ts`). */
export { isMicroKey } from "./micro-key";

const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Do the gang of the crime go for its victim (a mugging, an extortion), or stand by their thing? */
const goesForVictim = (kind: MicroEventKind): boolean => kind === "mugging" || kind === "extortion";

const spawn = (ctx: SimContext, crime: BoardCrime): MicroEventRun => {
  const { kind, at } = crime;
  const id = `micro:${kind}:${ctx.tick}`;
  const victimKey = `${id}:victim`;
  const props = crimeProps(ctx, id, kind, at);
  // Only the one robbed or taken needs a key (the muggers go for it by key, its death is a flag).
  const victim = hasVictim(kind) ? passerBy(ctx, at, 0, VICTIM_HP, kind === "aid" ? undefined : victimKey) : null;
  const chunk = victim?.chunk ?? ctx.streamer.chunkIdAt(at);
  const attackers = POSTS[kind].map((post, i) => {
    const px = at.x + post.dx;
    const pz = at.z + post.dz;
    const position = { x: px, y: ctx.streamer.ground.heightAt(px, pz), z: pz };
    const g = gangerEntity(ctx.streamer.takeId(), { key: `${id}:m${i}`, position, yaw: post.yaw }, null, GANGER_MAX_HP, chunk, goesForVictim(kind) ? victimKey : undefined);
    ctx.world.add(toughen(g, enemyScalingIn(ctx)));
    return g.id;
  });
  if (kind === "aid" && victim) ctx.world.addComponent(victim, "interactable", { kind: "help", dialogueId: id, prompt: "prompt.help", radius: 1.8 });
  const npcId = victim?.id ?? attackers[0]!;
  ctx.bus.emit("EncounterStarted", { encounterId: id, knot: "", npcId });
  const run: MicroEventRun = { id, kind, at, crime, victim: victim?.id ?? null, attackers, props, since: ctx.tick };
  // A gang's crime: its people let her walk up, and one offers her a part in it (stage 5c).
  offerAssist(ctx, run);
  return run;
};

const byId = (ctx: SimContext, id: number): Entity | undefined => [...ctx.world].find((e) => e.id === id);

/** Out of it: gone, or a body on the ground (knocked out, or killed in a takedown), which stays in the world (G-231). */
const out = (ctx: SimContext, id: number): boolean => {
  const e = byId(ctx, id);
  return !e || !!e.downed;
};

/** Ends the micro-event: its people go (the living ones), the dead leave no flag behind. */
const close = (ctx: SimContext, run: MicroEventRun, outcome: "won" | "helped" | "assisted" | "failed" | "left"): void => {
  // The crate, the drone or the van goes with the crime.
  for (const id of run.props ?? []) {
    const e = byId(ctx, id);
    if (e) ctx.world.remove(e);
  }
  for (const id of [...(run.victim === null ? [] : [run.victim]), ...run.attackers]) {
    const e = byId(ctx, id);
    if (e && outcome === "left") ctx.world.remove(e);
    // Whoever stays is an ordinary passer-by now, gone with its chunk; a mugger's body is saved
    // unkeyed (G-233, `strayBodiesSnapshot`).
    else if (e) {
      delete e.key;
      // The victim's key went with it, so a mugger is sent after nobody: none, as the save has it (G-242).
      if (e.ai?.victim !== undefined) {
        const { victim: _victim, ...ai } = e.ai;
        e.ai = ai;
      }
    }
  }
  for (const key of [`${run.id}:victim`, ...run.attackers.map((_, i) => `${run.id}:m${i}`)]) lowerFlag(ctx, deadFlag(key));
  const eddies = closeCrime(ctx, run, outcome);
  if (outcome === "won" || outcome === "helped") thankedByStreet(ctx, eddies, MICRO_EVENT_REWARD[run.kind].civilians);
  // The gang's pay; the street's opinion of it is in `closeCrime`.
  if (outcome === "assisted") payReward(ctx, { eddies });
  ctx.session.street2.micro = null;
  ctx.bus.emit("EncounterEnded", { encounterId: run.id, outcome });
};

/** The interact key on a passer-by in need (an aid). */
export const helpPasserBy = (ctx: SimContext, e: Entity): void => {
  const run = ctx.session.street2.micro;
  if (!run || run.victim !== e.id) return;
  ctx.world.removeComponent(e, "interactable");
  ctx.session.focusId = null;
  ctx.session.focusPrompt = null;
  ctx.bus.emit("InteractionFocusChanged", { targetId: null, prompt: null });
  close(ctx, run, "helped");
};

/** One step of the running micro-event: won, lost (the victim down, the drone or the van away) or left behind. */
export const runMicroEvent = (ctx: SimContext, player: Entity | null): void => {
  const run = ctx.session.street2.micro;
  if (!run) return;
  if (!player || flat(player.position, run.at) > CRIME_LEAVE) {
    close(ctx, run, "left");
    return;
  }
  if (run.side === "assist") {
    const step = assistStep(ctx, run, player);
    if (step === "done") {
      close(ctx, run, "assisted");
      return;
    }
    // She went for them after all: the job is off, the crime a fight as any other.
    if (step === "turned") {
      const { side: _side, watched: _watched, ...foil } = run;
      ctx.session.street2.micro = foil;
    }
  }
  const current = ctx.session.street2.micro ?? run;
  if (current.side !== "assist") crewTurned(ctx, current);
  const away = getaway(ctx, current);
  if (away === "gone") {
    // The thieves' drone or the kidnappers' van away: her job done, or the crime lost.
    close(ctx, current, current.side === "assist" ? "assisted" : "failed");
    return;
  }
  if (away === "leaving") {
    leave(ctx, current);
    return;
  }
  if (current.victim !== null && out(ctx, current.victim)) {
    close(ctx, current, "failed");
    return;
  }
  if (!current.alarmed && alarmed(ctx, current)) ctx.session.street2.micro = { ...current, alarmed: true };
  if (current.kind !== "aid" && current.attackers.every((id) => out(ctx, id))) close(ctx, ctx.session.street2.micro ?? current, "won");
};

/** A crime of the board within the player's reach starts (ADR-0091 stage 5). */
export const startCrime = (ctx: SimContext, crime: BoardCrime): void => {
  ctx.session.street2.micro = spawn(ctx, crime);
};
