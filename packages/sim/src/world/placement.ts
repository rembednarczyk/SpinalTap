import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "./components";
import type { GroundField } from "./ground";
import { circleTouchesPrism, resolveCirclePrism } from "./prism";

const ROUNDS = 3;

/**
 * Where a body of `radius` placed at `p` really stands (ADR-0043): pushed out of the walls of
 * prisms it was put into, and lifted onto the terrain when it was put under it. Boxes are left
 * alone (the content of before places people against them on purpose), so does a world without
 * prisms and terrain: the same object comes back.
 */
export const clearSpot = (world: World<Entity>, ground: GroundField, p: Vec3, radius: number): Vec3 => {
  let { x, z } = p;
  const lift = (px: number, pz: number) => (ground.hasTerrain ? Math.max(p.y, ground.heightAt(px, pz)) : p.y);
  const feet = lift(x, z);
  for (let round = 0; round < ROUNDS; round++) {
    let moved = false;
    for (const s of world.with("solid", "prisms")) {
      for (const prism of s.prisms) {
        if (prism.bottom >= feet + 1.8 || prism.top <= feet + 0.45 || !circleTouchesPrism(prism, x, z, radius)) continue;
        ({ x, z } = resolveCirclePrism(x, z, radius, prism));
        moved = true;
      }
    }
    if (!moved) break;
  }
  const y = lift(x, z);
  return x === p.x && y === p.y && z === p.z ? p : { x, y, z };
};

/** Puts a freshly spawned character where it can stand (see `clearSpot`). */
export const settle = (world: World<Entity>, ground: GroundField, e: Entity): void => {
  if (!e.body) return;
  const at = clearSpot(world, ground, e.position, e.body.radius);
  if (at === e.position) return;
  e.position = at;
  e.prevPosition = at;
};
