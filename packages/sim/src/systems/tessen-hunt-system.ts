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
import { inPlayerView } from "./crime-system";

/**
 * Tessen's hunt in the city after W-3's loud way (ADR-0082 §3.7, stage 3b): for three game days, on
 * entering a district and every 6 game hours in it, a squad of 2-3 Tessen guards comes in at a
 * street entry at least 45 m from Seki and out of her view, never within 60 m of the clinic, on
 * her trail; one squad at a time. They are the security's reinforcements (ADR-0029) for the rest:
 * saved with them, and gone home once they lost her. The roll is a flag of the district and the
 * stretch of the day, so a load rolls the same; its draw comes from the seed and the flag. The roll
 * only puts the squad on its way, as a flag the HUD warns of; it comes in 20-40 s later (G-911).
 */

/** The squad stands this far apart at its entry. */
const SPREAD = 1.4;
/** An entry this far at most: the squad comes from round the corner, not from across the city. */
const MAX_DISTANCE = 140;

/** A squad of the hunt still on its feet in the world? */
const squadOut = (ctx: SimContext): boolean =>
  ctx.world.with("security").entities.some((e) => !!e.ai && !e.downed && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);

/** The nearest street entry in a loaded chunk, far enough from her and the clinic and out of her view. */
const huntEntry = (ctx: SimContext, player: Entity): Vec3 | null => {
  let best: Vec3 | null = null;
  let bestD = Infinity;
  for (const p of SECURITY_ENTRIES) {
    if (!ctx.streamer.isLoaded(ctx.streamer.chunkIdAt(p))) continue;
    const d = Math.hypot(p.x - player.position.x, p.z - player.position.z);
    if (d < TESSEN_HUNT.minDistance || d > MAX_DISTANCE || d >= bestD) continue;
    if (Math.hypot(p.x - CLINIC_WAKE_SPOT.x, p.z - CLINIC_WAKE_SPOT.z) < TESSEN_HUNT.clinicClear || inPlayerView(ctx, player, p)) continue;
    best = p;
    bestD = d;
  }
  return best;
};

/** The squad comes in at `at`, each on her trail. */
const sendSquad = (ctx: SimContext, player: Entity, at: Vec3, size: number): void => {
  const watch = ctx.session.watch;
  for (let i = 0; i < size; i++) {
    const a = (i * 2 * Math.PI) / size;
    const p = { x: at.x + Math.sin(a) * SPREAD, y: at.y, z: at.z + Math.cos(a) * SPREAD };
    watch.sent += 1;
    const g = reinforcementEntity(ctx.streamer.takeId(), watch.sent, ctx.tick, "tessen_guard", p, enemyScalingIn(ctx));
    if (g.ai) {
      g.ai.alerted = true;
      g.ai.lastKnown = { ...player.position };
    }
    ctx.world.add(g);
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
      for (const f of flags.filter((f) => isTessenHuntRollFlag(f) || isTessenSquadFlag(f))) lowerFlag(ctx, f);
      return;
    }
    // Once a second is often enough to look for an entry.
    const rate = Math.round(1 / ctx.dt);
    if (ctx.tick % rate !== 0 || ctx.session.gameOver) return;
    const player = ctx.world.with("player").first;
    const district = player ? ctx.streamer.districtAt(player.position) : null;
    if (!player || !district) return;
    // The squad on its way counts as the one out: it comes in where she is by then.
    const due = tessenSquadDue(flags);
    if (due) {
      const at = ctx.tick >= due.tick ? huntEntry(ctx, player) : null;
      if (!at) return;
      lowerFlag(ctx, due.flag);
      sendSquad(ctx, player, at, due.size);
      return;
    }
    const roll = tessenHuntRollFlag(district, clock);
    if (flags.includes(roll)) return;
    // One squad at a time: the roll goes by while one is out.
    const at = squadOut(ctx) ? null : huntEntry(ctx, player);
    if (!squadOut(ctx) && !at) return;
    for (const f of flags.filter(isTessenHuntRollFlag)) lowerFlag(ctx, f);
    raiseFlag(ctx, roll);
    if (!at) return;
    const draw = deriveRandom(ctx.seed, roll);
    const size = tessenSquadSize(draw.next());
    raiseFlag(ctx, tessenSquadFlag(size, ctx.tick + tessenSquadDelaySeconds(draw.next()) * rate));
  },
};
