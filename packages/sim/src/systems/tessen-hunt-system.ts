import {
  TESSEN_HUNT,
  type Vec3,
  isTessenHuntRollFlag,
  isTessenSquadFlag,
  tessenHuntActive,
  tessenHuntFlag,
  tessenHuntRollFlag,
  tessenHuntUntil,
  tessenSquadDelaySeconds,
  tessenSquadDue,
  tessenSquadFlag,
  tessenSquadSize,
} from "@seki/core";
import { SECURITY_ENTRIES } from "../content/devices";
import { CLINIC_WAKE_SPOT } from "../content/interiors";
import { deriveRandom } from "../rng/derive-random";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { lowerFlag, raiseFlag } from "../world/domain-ops";
import { enemyScalingIn } from "../world/enemy-scaling";
import { reinforcementEntity } from "../world/reinforcements";
import { worldTimeScale } from "./ability-system";
import { inPlayerView } from "./crime-system";
import { TRACK_GRACE } from "./ai/ganger-perception";
import { GANGER_SPEED } from "./ai/ganger-walk";
import { WIDE_WINDOW, outsideWindow } from "./ai/nav-field";
import { SAME_FLOOR, chaseDetour, followDetour, sameChaseKey, sameWideWindow, straightWalk } from "./ai/steering";
import { heightApart } from "../world/ground";

/**
 * Tessen's hunt in the city after W-3's loud way (ADR-0082 §3.7, stage 3b): for three game days, on
 * entering a district and every 6 game hours in it, a squad of 2-3 Tessen guards comes in at a
 * street entry at least 45 m from Seki and out of her view, never within 60 m of the clinic, on
 * her trail; one squad at a time. They are the security's reinforcements (ADR-0029) for the rest:
 * saved with them, and gone home once they lost her. The roll is a flag of the district and the
 * stretch of the day, so a load rolls the same; its draw comes from the seed and the flag. The roll
 * only puts the squad on its way, as a flag the HUD warns of; it comes in 20-40 s later (G-911).
 * One that finds no way to her from its entry goes back and waits for her where one leads (G-922).
 */

/** The squad stands this far apart at its entry. */
const SPREAD = 1.4;
/** An entry this far at most: the squad comes from round the corner, not from across the city. */
const MAX_DISTANCE = 140;
/**
 * The window a chase plans its way round the blocks in, round her (G-922): its spread in from the
 * edge, so each of them is in it.
 */
const PLANNED = { ...WIDE_WINDOW, half: WIDE_WINDOW.half - SPREAD };
/**
 * A chase gives up a lead it has not reached in `GIVE_UP` s, some 60 m on (G-922): the squad lost
 * her before it got half way from a far entry. While one gets nearer its trail, for twice the walk
 * from its entry to the lead by the crow (that of the furthest entry at most), its time without her
 * stays a second past the tracking's grace (checked once a second, so it never follows her through
 * walls); standing, pressed against a wall or that time over, it gives up as any chase does.
 */
const TRAIL_DETOUR = 2;
const TRAIL_FRESH = TRACK_GRACE + 1;

/** Within this of its entry a squad member has not set off yet (it walks meanwhile, G-694). */
const SET_OFF = 8;

/**
 * May a chase from `from` get to her at `to` (G-922)? On her floor, by a straight walk or in the
 * window its way round the blocks is planned in; whether that way leads there is known once it is
 * made, a slice a step (`reroute`). Off the window and floor the squad stood at its entry.
 */
const mayWalk = (ctx: SimContext, from: Vec3, to: Vec3): boolean =>
  heightApart(ctx.world, to, from) <= SAME_FLOOR && (!outsideWindow(PLANNED, from, to) || straightWalk(ctx.world, from, to));

/**
 * A squad gone back from where no way led to her (G-922): it comes in where one does, with no new
 * warning, as the one on its way (it was, and she was told). A flag, so a load keeps it waiting.
 */
const BACK_PREFIX = "tessen-hunt-back:";
/** An entry no way led from to her at a lead (G-922): `<entry>@<x>,<y>,<z>`, the entry's index in `SECURITY_ENTRIES`. */
const WAYLESS_PREFIX = "tessen-hunt-wayless:";

/** The squad gone back, from the flags; null without one. */
const tessenSquadBack = (flags: readonly string[]): { flag: string; size: number } | null => {
  const flag = flags.find((f) => f.startsWith(BACK_PREFIX));
  return flag ? { flag, size: Number(flag.slice(BACK_PREFIX.length)) } : null;
};

const waylessFlag = (entry: number, lead: Vec3): string => `${WAYLESS_PREFIX}${entry}@${[lead.x, lead.y, lead.z].map((v) => Math.round(v * 10) / 10).join(",")}`;

/** The flags of the entries no way led from, with the entry and the lead. */
const waylessOf = (flags: readonly string[]) =>
  flags.flatMap((flag) => {
    if (!flag.startsWith(WAYLESS_PREFIX)) return [];
    const [entry = "", at = ""] = flag.slice(WAYLESS_PREFIX.length).split("@");
    const [x = 0, y = 0, z = 0] = at.split(",").map(Number);
    return [{ flag, entry: Number(entry), lead: { x, y, z } }];
  });

/**
 * Does the made way to `lead`, which led nowhere from an entry, answer for her at `me` too? In the
 * window of the same raster and on her floor: wherever she walked to from there, none leads from it
 * either. Off it she is asked about afresh.
 */
const waylessHolds = (ctx: SimContext, lead: Vec3, me: Vec3): boolean => sameWideWindow(lead, me) && heightApart(ctx.world, me, lead) <= SAME_FLOOR;

/** Entries in a loaded chunk 45-140 m from her, out of her view and off the clinic, nearest first (ties: table order). */
const entriesFor = (ctx: SimContext, player: Entity): Vec3[] => {
  const me = player.position;
  const apart = (p: Vec3) => Math.hypot(p.x - me.x, p.z - me.z);
  const near = SECURITY_ENTRIES.filter((p) => {
    const d = apart(p);
    return d >= TESSEN_HUNT.minDistance && d <= MAX_DISTANCE && ctx.streamer.isLoaded(ctx.streamer.chunkIdAt(p));
  });
  near.sort((a, b) => apart(a) - apart(b));
  // None a way led nowhere from to where she is (G-922): the squad came in there, went back and came again.
  const wayless = new Set(waylessOf(ctx.state.domain.flags).flatMap((w) => (waylessHolds(ctx, w.lead, me) ? [w.entry] : [])));
  return near.filter(
    (p) => !wayless.has(SECURITY_ENTRIES.indexOf(p)) && Math.hypot(p.x - CLINIC_WAKE_SPOT.x, p.z - CLINIC_WAKE_SPOT.z) >= TESSEN_HUNT.clinicClear && !inPlayerView(ctx, player, p),
  );
};

/** A squad of the hunt still on its feet in the world? */
const squadOut = (ctx: SimContext): boolean =>
  ctx.world.with("security").entities.some((e) => !!e.ai && !e.downed && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);

/** The nearest street entry far enough from her and the clinic, out of her view, that a chase may walk to her from. */
const huntEntry = (ctx: SimContext, player: Entity): Vec3 | null => entriesFor(ctx, player).find((p) => mayWalk(ctx, p, player.position)) ?? null;

/** The `i`-th of a squad of `size` stands here at entry `at`. */
const spotAt = (at: Vec3, i: number, size: number): Vec3 => {
  const a = (i * 2 * Math.PI) / size;
  return { x: at.x + Math.sin(a) * SPREAD, y: at.y, z: at.z + Math.cos(a) * SPREAD };
};

/** The squad comes in at `at`, each on her trail. */
const sendSquad = (ctx: SimContext, player: Entity, at: Vec3, size: number): void => {
  const watch = ctx.session.watch;
  for (let i = 0; i < size; i++) {
    const p = spotAt(at, i, size);
    watch.sent += 1;
    const g = reinforcementEntity(ctx.streamer.takeId(), watch.sent, ctx.tick, "tessen_guard", p, enemyScalingIn(ctx));
    if (g.ai) {
      g.ai.alerted = true;
      g.ai.lastKnown = { ...player.position };
      // On her trail, not on her heels: past the tracking's grace, it does not hear where she goes on.
      g.ai.lost = TRACK_GRACE;
    }
    ctx.world.add(g);
  }
};

/**
 * The squad's members on its trail (alerted, on their feet), in the order they came in. None while
 * Tessen's heat is up: its reinforcements are the heat's then, led by the crime system (ADR-0029),
 * and the squad's among them as well.
 */
const onTrail = (ctx: SimContext) => {
  const heat = ctx.state.domain.heat;
  if (heat.level > 0 && heat.faction === "tessen") return [];
  const squad = [...ctx.world.with("security", "ai")].filter((g) => g.enemy?.type === "tessen_guard" && g.ai.alerted && !g.downed && (g.health?.current ?? 0) > 0);
  return squad.sort((a, b) => a.security.n - b.security.n);
};

/**
 * A squad whose way round the blocks is made and leads nowhere from its entry (G-922: in a closed
 * cell, cut off, or she is where none leads) comes in at the nearest entry the same way leads from
 * instead, or goes back on its way: it comes again once she is where one leads, never at an entry
 * the way led nowhere from while that holds, nor with a new warning. Out of her view only, as the
 * heat's reinforcements come and go (ADR-0029). Once a second, after the ways are made: what they
 * show is read off the made field, nothing is planned here.
 */
const reroute = (ctx: SimContext, player: Entity): void => {
  const squad = onTrail(ctx);
  const first = squad[0];
  const lead = first?.walk?.chase;
  if (!first || !lead) return;
  if (squad.some((g) => !g.walk?.chase || g.walk.chaseNext || Math.hypot(g.position.x - g.ai.home.x, g.position.z - g.ai.home.z) > SET_OFF)) return;
  const way = chaseDetour(ctx.world, first.position, lead);
  // One of them on its way is the squad on its way; one in a closed cell gives up as any chase.
  if (way && squad.some((g) => followDetour(way, g.position) !== null)) return;
  if (squad.some((g) => inPlayerView(ctx, player, g.position))) return;
  // The made way answers for the entries in its window that a walker there keeps it by.
  const judged = (p: Vec3) => !!way && !outsideWindow(PLANNED, p, lead) && sameChaseKey(ctx.world, first.position, p, lead);
  const leads = (p: Vec3) => !!way && judged(p) && followDetour(way, p) !== null;
  const entries = entriesFor(ctx, player).filter((p) => Math.hypot(p.x - lead.x, p.z - lead.z) <= MAX_DISTANCE);
  const at = entries.find((p) => leads(spotAt(p, 0, squad.length)));
  if (at) {
    squad.forEach((g, i) => {
      const p = spotAt(at, i, squad.length);
      [g.position, g.prevPosition, g.ai] = [p, { ...p }, { ...g.ai, home: { ...p } }];
    });
    return;
  }
  // Its own entry (the first stands `SPREAD` off it) and the others the way leads nowhere from.
  const own = SECURITY_ENTRIES.findIndex((p) => Math.hypot(p.x - first.ai.home.x, p.z - first.ai.home.z) <= SPREAD + 0.01);
  const none = entries.flatMap((p) => (judged(spotAt(p, 0, squad.length)) ? [SECURITY_ENTRIES.indexOf(p)] : []));
  for (const i of new Set([own, ...none])) if (i >= 0) raiseFlag(ctx, waylessFlag(i, lead));
  for (const g of squad) ctx.world.remove(g);
  raiseFlag(ctx, `${BACK_PREFIX}${squad.length}`);
};

/**
 * Did this step's walk (from the step's start, `prevPosition`) take `g` on along its way to `lead`
 * at half its pace at least? Its way round the blocks when it keeps one, which leads away from the
 * lead round a hall's corner too, else straight there. Pressed against a wall it walks, but does
 * not get on.
 */
const getsOn = (ctx: SimContext, g: Entity, lead: Vec3): boolean => {
  const was = g.prevPosition;
  const chase = g.walk?.chase;
  const way = chase ? chaseDetour(ctx.world, g.position, chase) : null;
  const next = chase ? way && followDetour(way, g.position) : lead;
  if (!was || !next) return false;
  const [x, z] = [next.x - g.position.x, next.z - g.position.z];
  const d = Math.hypot(x, z);
  const on = ((g.position.x - was.x) * x + (g.position.z - was.z) * z) / Math.max(d, 1e-6);
  return d > 1e-6 && on >= 0.5 * GANGER_SPEED * ctx.dt * worldTimeScale(ctx);
};

/** The squad getting on along its way to where she was keeps her trail (G-922). */
const keepTrail = (ctx: SimContext): void => {
  for (const g of onTrail(ctx)) {
    const { ai } = g;
    const lead = ai.lastKnown;
    if (!lead) continue;
    const walk = Math.min(Math.hypot(lead.x - ai.home.x, lead.z - ai.home.z), MAX_DISTANCE) / GANGER_SPEED;
    if ((ctx.tick - g.security.since) * ctx.dt <= TRAIL_DETOUR * walk && getsOn(ctx, g, lead)) ai.lost = Math.min(ai.lost ?? 0, TRAIL_FRESH);
  }
};

/** One step of the hunt: its end, the squad on its way coming in, and the roll of the district and the stretch of the day. */
export const tessenHuntSystem: System = {
  name: "tessen-hunt",
  run(ctx) {
    const { flags, clock } = ctx.state.domain;
    const until = tessenHuntUntil(flags);
    if (until === null) return;
    if (!tessenHuntActive(flags, clock)) {
      lowerFlag(ctx, tessenHuntFlag(until));
      const hunt = (f: string) => isTessenHuntRollFlag(f) || isTessenSquadFlag(f) || f.startsWith(BACK_PREFIX) || f.startsWith(WAYLESS_PREFIX);
      for (const f of flags.filter(hunt)) lowerFlag(ctx, f);
      return;
    }
    // Once a second is often enough to look for an entry.
    const rate = Math.round(1 / ctx.dt);
    if (ctx.tick % rate !== 0 || ctx.session.gameOver) return;
    keepTrail(ctx);
    const player = ctx.world.with("player").first;
    const district = player ? ctx.streamer.districtAt(player.position) : null;
    if (!player || !district) return;
    for (const w of waylessOf(flags)) if (!waylessHolds(ctx, w.lead, player.position)) lowerFlag(ctx, w.flag);
    reroute(ctx, player);
    // As the squad going back left them (G-922): those of the step's start let a roll put a second one on its way.
    const now = ctx.state.domain.flags;
    // The squad on its way, or gone back, counts as the one out: it comes in where she is by then, once none is out.
    const due = tessenSquadDue(now);
    const back = tessenSquadBack(now);
    if (due || back) {
      const at = !squadOut(ctx) && (back || (due && ctx.tick >= due.tick)) ? huntEntry(ctx, player) : null;
      if (!at) return;
      for (const f of [due?.flag, back?.flag]) if (f) lowerFlag(ctx, f);
      sendSquad(ctx, player, at, back?.size ?? due?.size ?? TESSEN_HUNT.squadMin);
      return;
    }
    const roll = tessenHuntRollFlag(district, clock);
    if (now.includes(roll)) return;
    // One squad at a time: the roll goes by while one is out.
    const at = squadOut(ctx) ? null : huntEntry(ctx, player);
    if (!squadOut(ctx) && !at) return;
    for (const f of now.filter(isTessenHuntRollFlag)) lowerFlag(ctx, f);
    raiseFlag(ctx, roll);
    if (!at) return;
    const draw = deriveRandom(ctx.seed, roll);
    const size = tessenSquadSize(draw.next());
    raiseFlag(ctx, tessenSquadFlag(size, ctx.tick + tessenSquadDelaySeconds(draw.next()) * rate));
  },
};
