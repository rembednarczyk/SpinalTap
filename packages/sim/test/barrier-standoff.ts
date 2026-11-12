import type { StreetPropItem } from "@seki/core";
import { Simulation, WORLD_BARRIERS, gangerEntity, ground } from "../src";
import { distanceToBarrier } from "../src/content/lublin/barriers";
import { teleportPlayer } from "./helpers";

/** An alerted ganger and the player on two sides of a barrier of the map (G-625). */

export const all = Object.entries(WORLD_BARRIERS).flatMap(([chunk, items]) => items.map((item) => ({ chunk, item })));
/** The piece of a barrier nearest to a point of the map. */
export const pieceAt = (x: number, z: number) => all.reduce((a, b) => (Math.hypot(b.item.x - x, b.item.z - z) < Math.hypot(a.item.x - x, a.item.z - z) ? b : a));
/** A point `a` metres off a piece's middle, square to it. */
export const off = (i: StreetPropItem, a: number) => ({ x: i.x + Math.cos(i.yaw) * a, z: i.z - Math.sin(i.yaw) * a });
export const nearestBarrier = (x: number, z: number) => Math.min(...all.map((o) => distanceToBarrier(o.item, x, z)));

/** The player 1.5 m off a piece on one side, an alerted ganger 4 m off it on the other. */
export const standOff = (x: number, z: number, side: 1 | -1) => {
  const { chunk, item } = pieceAt(x, z);
  const sim = Simulation.create({ seed: 2 });
  const to = off(item, 1.5 * side);
  const from = off(item, -4 * side);
  teleportPlayer(sim, ground(to.x, to.z));
  sim.step();
  const player = sim.player()!;
  const ganger = gangerEntity(9001, { key: "g625", position: ground(from.x, from.z), yaw: 0 }, null, 200, chunk);
  ganger.ai!.alerted = true;
  sim.world.add(ganger);
  return { sim, player, ganger, hp: player.health!.current };
};
