import { CIVILIAN_SIGHT, type Vec3, angleTo } from "@seki/core";
import type { DownedBody, Entity } from "../../world/components";
import type { SimContext, System } from "../../world/context";
import { eyeOf, lineOfSight } from "../../world/hitscan";
import { inCreationOrder } from "../../world/ordering";
import { disturb } from "../../world/street";
import { incapacitated } from "../../world/takedown";
import { worldTimeScale } from "../ability-system";
import { cameraSeesPoint, dropBodyCalls, report, securityAt, sendSecurity } from "../crime-system";
import { BODY_NOISE } from "../death-system";
import { scare } from "./civilian-ai-system";
import { GUARD_CONE, GUARD_NEAR, TRACK_GRACE, giveLead } from "./ganger-perception";

/** Seconds an NPC spends at the side of someone knocked out before it comes round (ADR-0065). */
export const WAKE_TIME = 6;
/** How close, metres on the ground, the NPC has to stand for the waking to count. */
export const WAKE_REACH = 2;
/** The point of a body lying on the ground that eyes and cameras look for. */
const LYING_HEIGHT = 0.3;

type Body = Entity & { downed: DownedBody };

const lyingAt = (b: Entity): Vec3 => ({ x: b.position.x, y: b.position.y + LYING_HEIGHT, z: b.position.z });

/** A civilian's body: the street takes fright, the security is not called (ADR-0065). */
const civilianBody = (b: Entity): boolean => !!b.civilian || b.faction === "civilians";

/** Free to see a body and walk over to it: awake, not fighting, not on another errand. */
const freeToLook = (ctx: SimContext, g: Entity): boolean =>
  !!g.ai && !g.ai.alerted && !g.ai.victim && !g.downed && !incapacitated(ctx, g) && (g.health?.current ?? 1) > 0;

/** Does this AI see the body: its sight range, its cone for a guard (or right next to it), a clear line. */
const aiSeesBody = (ctx: SimContext, g: Entity, b: Entity): boolean => {
  if (!g.ai || (g.hackFx?.blind ?? 0) > 0) return false;
  const distance = Math.hypot(b.position.x - g.position.x, b.position.z - g.position.z);
  if (distance > g.ai.aggroRange) return false;
  if (g.ai.cone && distance > GUARD_NEAR && Math.abs(angleTo({ x: g.position.x, z: g.position.z, yaw: g.yaw }, b.position.x, b.position.z)) > GUARD_CONE) return false;
  return lineOfSight(ctx.world, eyeOf(g), lyingAt(b));
};

const civilianSeesBody = (ctx: SimContext, c: Entity, b: Entity): boolean =>
  !c.unconscious &&
  (c.health?.current ?? 1) > 0 &&
  Math.hypot(b.position.x - c.position.x, b.position.z - c.position.z) <= CIVILIAN_SIGHT &&
  lineOfSight(ctx.world, eyeOf(c), lyingAt(b));

/** Where the search starts: the heat's last known position while it is up, else where she stood. */
const searchFrom = (ctx: SimContext, b: Body): Vec3 => {
  const heat = ctx.state.domain.heat;
  return heat.level > 0 && heat.lastKnown ? heat.lastKnown : b.downed.playerAt;
};

/** `finder` noticed the body: BodyFound, the street's fright once, the security's call once. */
const found = (ctx: SimContext, b: Body, finder: Entity, channel: "patrol" | "camera" | null): void => {
  ctx.bus.emit("BodyFound", { body: b.id, finder: finder.id });
  if (!b.downed.found) {
    b.downed.found = true;
    disturb(ctx, "body", b.position, BODY_NOISE, b.id);
  }
  if (!channel || b.downed.reported || civilianBody(b)) return;
  b.downed.reported = true;
  const at = searchFrom(ctx, b);
  // Taken down in a fight it was no crime (ADR-0029): the security comes to look, no report, no heat.
  if (b.downed.fought) {
    sendSecurity(ctx, securityAt(ctx, b.position), at);
    return;
  }
  const player = ctx.world.with("player").first;
  report(ctx, "assault", channel, finder.id, player?.id ?? 0, at);
  dropBodyCalls(ctx, b.id);
};

/** A civilian of the street (a passer-by, one on its daily plan) calm enough to stop and help. */
const calmCivilian = (ctx: SimContext, c: Entity): boolean =>
  !!c.civilian && !c.downed && !incapacitated(ctx, c) && (c.health?.current ?? 1) > 0 && (c.civilian.crowd?.state ?? "calm") === "calm";

const near = (a: Entity, b: Entity): boolean => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) <= WAKE_REACH;

/**
 * The finder still on its way or at the side: awake, free and in the world; a civilian also still
 * calm by the body (the civilian AI holds it still while it is a body's finder).
 */
const finderOf = (ctx: SimContext, b: Body, ais: readonly Entity[], civilians: readonly Entity[]): Entity | null => {
  const id = b.downed.finder;
  if (id === null) return null;
  const g = ais.find((e) => e.id === id);
  if (g) return freeToLook(ctx, g) ? g : null;
  const c = civilians.find((e) => e.id === id);
  return c && calmCivilian(ctx, c) && near(c, b) ? c : null;
};

/**
 * The first free AI that sees the body walks over to it; the district's security calls it in.
 * With none, a calm civilian that comes by within `WAKE_REACH` stops to help.
 */
const lookForFinder = (ctx: SimContext, b: Body, ais: readonly Entity[], civilians: readonly Entity[]): Entity | null => {
  const g = ais.find((e) => e !== b && freeToLook(ctx, e) && aiSeesBody(ctx, e, b));
  const c = g ? undefined : civilians.find((e) => e !== b && calmCivilian(ctx, e) && near(e, b) && civilianSeesBody(ctx, e, b));
  const finder = g ?? c;
  if (!finder) return null;
  b.downed.finder = finder.id;
  b.downed.wake = 0;
  found(ctx, b, finder, g && g.faction === securityAt(ctx, b.position) ? "patrol" : null);
  // Its own lead is the body, whatever the call sent the others to.
  if (g) giveLead(g, b.position);
  return finder;
};

/** A camera seeing the body is a witness; a civilian seeing it first runs and makes the street look. */
const watchFromAfar = (ctx: SimContext, b: Body): void => {
  if (!b.downed.reported && !civilianBody(b)) {
    const at = lyingAt(b);
    const cam = inCreationOrder(ctx.world.with("device")).find((c) => cameraSeesPoint(ctx, c, at));
    if (cam) {
      found(ctx, b, cam, "camera");
      return;
    }
  }
  if (b.downed.found) return;
  const c = inCreationOrder(ctx.world.with("civilian")).find((e) => e !== b && civilianSeesBody(ctx, e, b));
  if (!c) return;
  found(ctx, b, c, null);
  scare(ctx, c, "fleeing", b.position);
};

/** Comes round alerted, knowing where the player stood when she took it down. */
const wake = (ctx: SimContext, b: Body, finder: Entity): void => {
  const { playerAt } = b.downed;
  const lead = searchFrom(ctx, b);
  ctx.world.removeComponent(b, "downed");
  ctx.world.removeComponent(b, "unconscious");
  if (b.ai) {
    b.ai.alerted = true;
    b.ai.lastKnown = { ...playerAt };
    // Past the grace of tracking her by ear: it goes for the place it remembers.
    b.ai.lost = TRACK_GRACE;
    b.ai.search = 0;
  }
  scare(ctx, b, "fleeing", playerAt);
  // The finder starts the search from the player's last known position; a civilian walks on.
  giveLead(finder, lead);
};

/** The finder walks to the body (back to it after any other lead) and wakes it after `WAKE_TIME`. */
const tend = (ctx: SimContext, b: Body, finder: Entity, dt: number): void => {
  if (finder.ai && !finder.ai.lastKnown) giveLead(finder, b.position);
  if (!near(finder, b)) return;
  b.downed.wake += dt;
  if (b.downed.wake >= WAKE_TIME - 1e-6) wake(ctx, b, finder);
};

/**
 * The knocked out (ADR-0065): an AI that sees one walks over (BodyFound), calls the security in
 * when it is the district's own, and wakes it after `WAKE_TIME` at its side; with no AI about, a
 * calm civilian that comes within `WAKE_REACH` stops and wakes it the same way. A camera that
 * sees one reports it; a civilian that sees one runs and the street around takes fright (next
 * step), as at a death. A civilian's body brings no heat, nor does one taken down in a fight
 * (the security only comes to look). After the crime system, so a witness's report of the
 * takedown comes first. No randomness: everything in creation order.
 */
export const bodyWatchSystem: System = {
  name: "body-watch",
  run(ctx) {
    const bodies = inCreationOrder(ctx.world.with("downed"));
    if (bodies.length === 0) return;
    const ais = inCreationOrder(ctx.world.with("ai"));
    const civilians = inCreationOrder(ctx.world.with("civilian"));
    const dt = ctx.dt * worldTimeScale(ctx);
    for (const b of bodies) {
      let finder = finderOf(ctx, b, ais, civilians);
      if (!finder) {
        b.downed.finder = null;
        b.downed.wake = 0;
        finder = lookForFinder(ctx, b, ais, civilians);
      }
      watchFromAfar(ctx, b);
      if (finder) tend(ctx, b, finder, dt);
    }
  },
};
