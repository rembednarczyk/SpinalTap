import type { Entity, Interactable } from "../world/components";
import type { SimContext, System } from "../world/context";
import { overFootprint } from "../world/collision";
import { inCreationOrder } from "../world/ordering";

type Lift = Entity & { elevator: NonNullable<Entity["elevator"]>; solid: NonNullable<Entity["solid"]> };

/** Feet this close to the platform top ride along. */
const RIDE_EPS = 0.05;
/** Gates slide at this speed, metres per second. */
const GATE_SPEED = 3;

/** Level the platform rests at, or null while it travels. */
export const restingLevel = (lift: Lift): number | null => {
  const top = lift.solid.max.y;
  const at = lift.elevator.levels.findIndex((y) => Math.abs(y - top) < 1e-6);
  return at < 0 ? null : at;
};

/**
 * A call button was pressed (ADR-0020). Standing on the platform, it rides to the next level
 * (back down from the top). From the landing, it calls the platform there; if it is already
 * there, nothing happens.
 */
export const callElevator = (ctx: SimContext, button: Interactable, by: Entity): void => {
  const call = button.elevator;
  if (!call) return;
  const lift = ctx.world.with("elevator", "solid").entities.find((e) => e.elevator.key === call.key);
  if (!lift) return;
  const resting = restingLevel(lift);
  const riding = overFootprint(lift.solid, by.position.x, by.position.z) && Math.abs(by.position.y - lift.solid.max.y) < RIDE_EPS;
  if (riding && resting !== null) lift.elevator.target = (resting + 1) % lift.elevator.levels.length;
  else if (!riding) lift.elevator.target = call.level;
};

/** Moves the box and the entity's position by `dy`. */
const lift = (e: Entity & { solid: NonNullable<Entity["solid"]> }, dy: number): void => {
  const { min, max } = e.solid;
  e.solid = { min: { ...min, y: min.y + dy }, max: { ...max, y: max.y + dy } };
  e.position = { ...e.position, y: e.position.y + dy };
};

/**
 * Drives lift platforms and their gates (ADR-0020). Riders (feet on the platform top) move with
 * it in the same step and cannot walk off mid-ride; a body under a descending platform stops it. Runs before movement, so
 * the floor test sees where the platform is now.
 */
export const elevatorSystem: System = {
  name: "elevator",
  run(ctx) {
    const { world } = ctx;
    const lifts = inCreationOrder(world.with("elevator", "solid"));
    if (lifts.length === 0) return;
    // Passers-by (ADR-0040) neither ride nor hold a lift: they never change the saved state.
    const bodies = inCreationOrder(world.with("body")).filter((b) => !b.passerby);
    for (const e of lifts) {
      const el = e.elevator;
      if (!el.settled) {
        el.settled = true;
        const player = world.with("player").first;
        if (player && overFootprint(e.solid, player.position.x, player.position.z)) {
          // A game saved during a ride: the platform comes back under the player's feet.
          let best = 0;
          el.levels.forEach((y, i) => {
            if (Math.abs(y - player.position.y) < Math.abs((el.levels[best] ?? 0) - player.position.y)) best = i;
          });
          el.target = best;
          lift(e, (el.levels[best] ?? 0) - e.solid.max.y);
        }
      }
      const goal = el.levels[el.target] ?? el.levels[0];
      const top = e.solid.max.y;
      if (goal === top) continue;
      let dy = Math.sign(goal - top) * Math.min(el.speed * ctx.dt, Math.abs(goal - top));
      const riders = bodies.filter((b) => overFootprint(e.solid, b.position.x, b.position.z) && Math.abs(b.position.y - top) < RIDE_EPS);
      if (dy < 0) {
        const bottom = e.solid.min.y + dy;
        const under = bodies.some(
          (b) => !riders.includes(b) && overFootprint(e.solid, b.position.x, b.position.z, b.body.radius) && b.position.y < e.solid.min.y && b.position.y + b.body.height > bottom,
        );
        if (under) dy = 0;
      }
      if (dy === 0) continue;
      lift(e, dy);
      for (const r of riders) {
        r.position = { ...r.position, y: r.position.y + dy };
        delete r.fall;
        // The open cage is not a ledge to step off: riders hold still until it stops.
        if (r.velocity) r.velocity = { x: 0, y: 0, z: 0 };
      }
    }
    for (const g of inCreationOrder(world.with("gate", "solid"))) {
      const owner = lifts.find((l) => l.elevator.key === g.gate.elevator);
      const open = owner !== undefined && restingLevel(owner) === g.gate.level;
      const want = open ? g.gate.closed.max.y - g.gate.travel : g.gate.closed.max.y;
      const now = g.solid.max.y;
      if (now === want) continue;
      lift(g, Math.sign(want - now) * Math.min(GATE_SPEED * ctx.dt, Math.abs(want - now)));
    }
  },
};
