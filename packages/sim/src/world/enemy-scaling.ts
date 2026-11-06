import { type Vec3, enemyLevel } from "@seki/core";
import { bandOf } from "../content/district-bands";
import type { SimContext } from "./context";
import { type EnemyScaling, enemyScalingOf } from "./enemy-grade";

/*
 * The district bands of ADR-0059 in the running game: what the systems ask of them. Kept apart from
 * `enemy-grade`, which the factory and the streamer use, so it needs no simulation context.
 */

/** The scaling of an enemy appearing now in the running game, by the streamer's districts. */
export const enemyScalingIn = (ctx: SimContext): EnemyScaling => enemyScalingOf(ctx.state.domain, (p) => ctx.streamer.districtAt(p));

/** The level of the district at `p`: that of a regular enemy there, the player's outside every district. */
export const districtLevelAt = (ctx: SimContext, p: Vec3): number => enemyLevel(ctx.state.domain.progression.level, bandOf(ctx.streamer.districtAt(p)));
