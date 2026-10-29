import { MICRO_EVENT_CHANCE, MICRO_EVENT_REWARD, type MicroEventKind, type Vec3 } from "@seki/core";
import { MICRO_SPOTS } from "../content/encounter-rewards";
import type { DistrictId } from "../content/world-map";
import { deriveRandom } from "../rng/derive-random";
import { deadFlag } from "../systems/death-system";
import type { Entity } from "./components";
import type { MicroEventRun, SimContext } from "./context";
import { lowerFlag } from "./domain-ops";
import { GANGER_MAX_HP, gangerEntity } from "./factory";
import { passerBy, streetOpen, thankedByStreet } from "./street-scenes";

/**
 * Micro-events in the style of Scanner Hustles (ADR-0034): rarely, on entering a district, a
 * single beat happens at one of its street points: two Hebi rob a passer-by (a fight), or a
 * passer-by has collapsed (help with the interact key). Done, it pays eddies and standing with
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
const MUGGERS = 2;

/** Keys of a micro-event's people start with this. */
export const isMicroKey = (key: string): boolean => key.startsWith("micro:");

const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

const spotFor = (district: DistrictId, player: Vec3): Vec3 | null => {
  let best: Vec3 | null = null;
  for (const p of MICRO_SPOTS[district]) {
    const d = flat(p, player);
    if (d >= MICRO_MIN_DISTANCE && d <= MICRO_MAX_DISTANCE && (!best || d > flat(best, player))) best = p;
  }
  return best;
};

const spawn = (ctx: SimContext, kind: MicroEventKind, at: Vec3): MicroEventRun => {
  const id = `micro:${kind}:${ctx.tick}`;
  const victimKey = `${id}:victim`;
  // Only the robbed one needs a key (the muggers go for it by key).
  const victim = passerBy(ctx, at, 0, VICTIM_HP, kind === "mugging" ? victimKey : undefined);
  const attackers: number[] = [];
  if (kind === "mugging") {
    for (let i = 0; i < MUGGERS; i++) {
      const px = at.x + (i === 0 ? 1.4 : -1.4);
      const position = { x: px, y: ctx.streamer.ground.heightAt(px, at.z + 1.2), z: at.z + 1.2 };
      const g = gangerEntity(ctx.streamer.takeId(), { key: `${id}:m${i}`, position, yaw: Math.PI }, null, GANGER_MAX_HP, victim.chunk ?? "", victimKey);
      ctx.world.add(g);
      attackers.push(g.id);
    }
  } else {
    ctx.world.addComponent(victim, "interactable", { kind: "help", dialogueId: id, prompt: "Pomóż", radius: 1.8 });
  }
  ctx.bus.emit("EncounterStarted", { encounterId: id, knot: "", npcId: victim.id });
  return { id, kind, at, victim: victim.id, attackers };
};

/** The player came into `district`: maybe a micro-event starts there. */
export const rollMicroEvent = (ctx: SimContext, district: DistrictId, player: Entity): void => {
  const s = ctx.session.street2;
  if (s.micro || !streetOpen(ctx) || s.encounter !== null) return;
  const rng = deriveRandom(ctx.seed, `micro:${ctx.tick}`);
  const roll = rng.next();
  const kind: MicroEventKind = rng.next() < 0.6 ? "mugging" : "aid";
  if (roll >= MICRO_EVENT_CHANCE) return;
  const at = spotFor(district, player.position);
  if (at) s.micro = spawn(ctx, kind, at);
};

const byId = (ctx: SimContext, id: number): Entity | undefined => [...ctx.world].find((e) => e.id === id);

/** Ends the micro-event: its people go (the living ones), the dead leave no flag behind. */
const close = (ctx: SimContext, run: MicroEventRun, outcome: "won" | "helped" | "failed" | "left"): void => {
  for (const id of [run.victim, ...run.attackers]) {
    const e = byId(ctx, id);
    if (e && outcome === "left") ctx.world.remove(e);
    // Whoever stays is an ordinary passer-by now, gone with its chunk and never saved.
    else if (e) delete e.key;
  }
  for (const key of [`${run.id}:victim`, `${run.id}:m0`, `${run.id}:m1`]) lowerFlag(ctx, deadFlag(key));
  if (outcome === "won" || outcome === "helped") {
    const r = MICRO_EVENT_REWARD[run.kind];
    thankedByStreet(ctx, r.eddies, r.civilians);
  }
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

/** One step of the running micro-event: won, lost or left behind. */
export const runMicroEvent = (ctx: SimContext, player: Entity | null): void => {
  const run = ctx.session.street2.micro;
  if (!run) return;
  if (!player || flat(player.position, run.at) > MICRO_LEAVE_DISTANCE) {
    close(ctx, run, "left");
    return;
  }
  if (!byId(ctx, run.victim)) {
    close(ctx, run, "failed");
    return;
  }
  if (run.kind === "mugging" && run.attackers.every((id) => !byId(ctx, id))) close(ctx, run, "won");
};
