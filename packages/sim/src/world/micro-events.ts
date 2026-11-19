import { MICRO_EVENT_REWARD, type MicroEventKind, type Vec3, microEventChance } from "@seki/core";
import { MICRO_SPOTS } from "../content/encounter-rewards";
import type { DistrictId } from "../content/world-map";
import { deriveRandom } from "../rng/derive-random";
import { deadFlag } from "../systems/death-system";
import type { Entity } from "./components";
import type { MicroEventRun, SimContext } from "./context";
import { lowerFlag } from "./domain-ops";
import { GANGER_MAX_HP, gangerEntity, toughen } from "./factory";
import { enemyScalingIn } from "./enemy-scaling";
import { passerBy, streetOpen, thankedByStreet } from "./street-scenes";
import { type BoardCrime, CRIME_LEAVE, closeCrime } from "./street-crimes";
import { POSTS, alarmed, crimeProps, getaway, hasVictim, leave } from "./crime-scenes";

/**
 * Micro-events in the style of Scanner Hustles (ADR-0034): rarely, on entering a district, a
 * single beat happens at one of its street points: two Hebi rob a passer-by (a fight), or a
 * passer-by has collapsed (help with the interact key). The crimes of the board (ADR-0091 stage
 * 5) run the same way, with the kinds round a thing of the street of `crime-scenes.ts`. Done, it pays eddies and standing with
 * the civilians. The roll comes from a stream of its own (seed and tick), so the main stream and
 * every fight stay as they were. The people of it are transient: a save leaves them out, and
 * walking away (or a metro ride) ends it with nothing.
 */

/** A spot is used between these distances from the player (seen coming, inside the loaded world). */
export const MICRO_MIN_DISTANCE = 12;
export const MICRO_MAX_DISTANCE = 40;
/** Farther than this from the spot the player has walked away. */
export const MICRO_LEAVE_DISTANCE = 45;
const VICTIM_HP = 60;

/** Keys of a micro-event's people start with this (`micro-key.ts`). */
export { isMicroKey } from "./micro-key";

const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

const spotFor = (district: DistrictId, player: Vec3): Vec3 | null => {
  let best: Vec3 | null = null;
  for (const p of MICRO_SPOTS[district]) {
    const d = flat(p, player);
    if (d >= MICRO_MIN_DISTANCE && d <= MICRO_MAX_DISTANCE && (!best || d > flat(best, player))) best = p;
  }
  return best;
};

/** Do the gang of the crime go for its victim (a mugging, an extortion), or stand by their thing? */
const goesForVictim = (kind: MicroEventKind): boolean => kind === "mugging" || kind === "extortion";

const spawn = (ctx: SimContext, kind: MicroEventKind, at: Vec3): MicroEventRun => {
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
  return { id, kind, at, victim: victim?.id ?? null, attackers, props, since: ctx.tick };
};

/** The player came into `district`: maybe a micro-event starts there. */
export const rollMicroEvent = (ctx: SimContext, district: DistrictId, player: Entity): void => {
  const s = ctx.session.street2;
  if (s.micro || !streetOpen(ctx) || s.encounter !== null) return;
  const rng = deriveRandom(ctx.seed, `micro:${ctx.tick}`);
  const roll = rng.next();
  const kind: MicroEventKind = rng.next() < 0.6 ? "mugging" : "aid";
  // More often while the street thinks badly of the player (ADR-0070); the roll itself is the same.
  if (roll >= microEventChance(ctx.state.domain.reputation.civilians)) return;
  const at = spotFor(district, player.position);
  if (at) s.micro = spawn(ctx, kind, at);
};

const byId = (ctx: SimContext, id: number): Entity | undefined => [...ctx.world].find((e) => e.id === id);

/** Out of it: gone, or a body on the ground (knocked out, or killed in a takedown), which stays in the world (G-231). */
const out = (ctx: SimContext, id: number): boolean => {
  const e = byId(ctx, id);
  return !e || !!e.downed;
};

/** Ends the micro-event: its people go (the living ones), the dead leave no flag behind. */
const close = (ctx: SimContext, run: MicroEventRun, outcome: "won" | "helped" | "failed" | "left"): void => {
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
  const crime = run.crime;
  const eddies = crime ? closeCrime(ctx, { ...run, crime }, outcome) : MICRO_EVENT_REWARD[run.kind].eddies;
  if (outcome === "won" || outcome === "helped") thankedByStreet(ctx, eddies, MICRO_EVENT_REWARD[run.kind].civilians);
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
  if (!player || flat(player.position, run.at) > (run.crime ? CRIME_LEAVE : MICRO_LEAVE_DISTANCE)) {
    close(ctx, run, "left");
    return;
  }
  const away = getaway(ctx, run);
  if (away === "gone") {
    close(ctx, run, "failed");
    return;
  }
  if (away === "leaving") {
    leave(ctx, run);
    return;
  }
  if (run.victim !== null && out(ctx, run.victim)) {
    close(ctx, run, "failed");
    return;
  }
  if (!run.alarmed && alarmed(ctx, run)) ctx.session.street2.micro = { ...run, alarmed: true };
  if (run.kind !== "aid" && run.attackers.every((id) => out(ctx, id))) close(ctx, ctx.session.street2.micro ?? run, "won");
};

/** A crime of the board within the player's reach starts (ADR-0091 stage 5). */
export const startCrime = (ctx: SimContext, crime: BoardCrime): void => {
  ctx.session.street2.micro = { ...spawn(ctx, crime.kind, crime.at), crime };
};
