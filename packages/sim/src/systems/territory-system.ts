import {
  type CityDistrictId,
  type EntityId,
  type FactionId,
  GAME_SECONDS_PER_REAL_SECOND,
  type GangStandings,
  TERRITORIES,
  TERRITORY_IDS,
  type TerritoryId,
  type TerritoryProvocation,
  clearWarning,
  dawnGrudge,
  dawnsBetween,
  gangProvoked,
  gangWarning,
  grudgeAfter,
  provokeGang,
  standingOf,
  warnGang,
} from "@seki/core";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { glimpses, tolerates } from "./ai/ganger-perception";
import type { Ganger } from "./ai/ganger-perception";

/*
 * The gangs' territories (ADR-0091 stage 3). A member of a territory watches a player its gang
 * tolerates in the district (`tolerates` in ganger-perception.ts); this system keeps the gang's
 * memory of her there:
 * - a drawn weapon within the warning's range of a member that sees her starts the warning; put
 *   away or out of range of all of them it ends, run out it provokes the gang;
 * - a member alerted (hit, shot near, the heat's hunt) provokes the gang;
 * - a member the player killed or knocked out adds to the grudge, and provokes the gang;
 * - each dawn lowers the grudge, and a provocation runs out after its hours.
 * The gang's state is the domain's (`gangStandings`, saved), so a load goes on the same.
 */

type Member = Ganger & { ai: { territory: TerritoryId } };

const isMember = (e: Entity): e is Member => !!e.ai?.territory && !!e.velocity;

const isDown = (e: Entity): boolean => !!e.unconscious || (e.health?.current ?? 1) <= 0;

/** A district of one gang: the key of its standing. */
interface Ground {
  readonly faction: FactionId;
  readonly district: CityDistrictId;
}

const groundOf = (t: TerritoryId): Ground => TERRITORIES[t];

const sameGround = (a: Ground, b: Ground): boolean => a.faction === b.faction && a.district === b.district;

/** The territories of a gang in a district: who hears of what happened there. */
const territoriesOf = (g: Ground): readonly TerritoryId[] => TERRITORY_IDS.filter((t) => sameGround(groundOf(t), g));

const setStandings = (ctx: SimContext, gangStandings: GangStandings): void => {
  if (gangStandings !== ctx.state.domain.gangStandings) ctx.state.domain = { ...ctx.state.domain, gangStandings };
};

const provoke = (ctx: SimContext, t: TerritoryId, cause: TerritoryProvocation): void => {
  const g = groundOf(t);
  setStandings(ctx, provokeGang(ctx.state.domain.gangStandings, g.faction, g.district, ctx.state.domain.clock));
  for (const other of territoriesOf(g)) ctx.bus.emit("TerritoryProvoked", { territory: other, cause });
};

/** The dawns and the provocations run out since the last step; the gangs calm again there. */
const passTime = (ctx: SimContext, from: number): void => {
  const d = ctx.state.domain;
  const before = d.gangStandings;
  const expired = Object.values(before).some((s) => s && s.provokedUntil !== null && d.clock.seconds >= s.provokedUntil);
  if (!expired && dawnsBetween({ seconds: from }, d.clock) === 0) return;
  const after = dawnGrudge(before, { seconds: from }, d.clock);
  setStandings(ctx, after);
  for (const t of TERRITORY_IDS) {
    const g = groundOf(t);
    const was = standingOf(before, g.faction, g.district);
    if (gangProvoked(was, { seconds: from }) && !gangProvoked(standingOf(after, g.faction, g.district), d.clock)) ctx.bus.emit("TerritoryCalmed", { territory: t });
  }
};

/** A member going down this step at the player's hand: the grudge, and the gang provoked. */
const wronged = (ctx: SimContext, m: Member, player: Entity | null): void => {
  const takedown = !!m.unconscious && (m.health?.current ?? 1) > 0;
  if (!player || (m.lastHitBy !== player.id && !takedown)) return;
  const g = groundOf(m.ai.territory);
  setStandings(ctx, grudgeAfter(ctx.state.domain.gangStandings, g.faction, g.district, takedown ? "knockout" : "kill"));
  provoke(ctx, m.ai.territory, takedown ? "takedown" : "kill");
};

/** Does the member see the player hold a drawn weapon within the warning's range? */
const warns = (ctx: SimContext, m: Member, player: Entity): boolean => {
  const c = player.combatant;
  if (!c || c.holstered || !c.stats) return false;
  const range = gangWarning(ctx.state.domain.reputation[groundOf(m.ai.territory).faction]).range;
  return Math.hypot(player.position.x - m.position.x, player.position.z - m.position.z) <= range && glimpses(ctx, m, player);
};

/** The warnings of the step: started, run out (the gang provoked) or over. */
const runWarnings = (ctx: SimContext, warning: ReadonlyMap<string, Member>): void => {
  const d = ctx.state.domain;
  for (const t of TERRITORY_IDS) {
    const g = groundOf(t);
    if (territoriesOf(g)[0] !== t) continue;
    const s = standingOf(d.gangStandings, g.faction, g.district);
    const m = warning.get(`${g.faction}:${g.district}`);
    if (!m) {
      if (s.warnedUntil !== undefined) setStandings(ctx, clearWarning(ctx.state.domain.gangStandings, g.faction, g.district));
    } else if (s.warnedUntil === undefined) {
      const { seconds } = gangWarning(d.reputation[g.faction]);
      setStandings(ctx, warnGang(ctx.state.domain.gangStandings, g.faction, g.district, d.clock, seconds, GAME_SECONDS_PER_REAL_SECOND));
      ctx.bus.emit("TerritoryWarned", { territory: m.ai.territory, entityId: m.id });
    } else if (d.clock.seconds >= s.warnedUntil) {
      provoke(ctx, m.ai.territory, "warning");
    }
  }
};

export const createTerritorySystem = (): System => {
  // Who of the members was down last step: the step one goes down counts. Seeded at first sight,
  // so a member down in a loaded save counts nobody twice.
  const down = new Map<EntityId, boolean>();
  let last: number | null = null;
  return {
    name: "territory",
    run(ctx) {
      if (last !== null && last !== ctx.state.domain.clock.seconds) passTime(ctx, last);
      last = ctx.state.domain.clock.seconds;
      const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
      const warning = new Map<string, Member>();
      const seen = new Set<EntityId>();
      for (const e of ctx.world.with("ai")) {
        if (!isMember(e)) continue;
        seen.add(e.id);
        const now = isDown(e);
        const was = down.get(e.id);
        down.set(e.id, now);
        if (was === false && now) wronged(ctx, e, player);
        if (now) continue;
        const g = groundOf(e.ai.territory);
        const hunted = ctx.state.domain.heat.level > 0 && ctx.state.domain.heat.faction === g.faction;
        if (!tolerates(ctx, e, hunted)) continue;
        if (e.ai.alerted) provoke(ctx, e.ai.territory, "alarm");
        else if (player && warns(ctx, e, player)) warning.set(`${g.faction}:${g.district}`, e);
      }
      for (const id of [...down.keys()]) if (!seen.has(id)) down.delete(id);
      runWarnings(ctx, warning);
    },
  };
};
