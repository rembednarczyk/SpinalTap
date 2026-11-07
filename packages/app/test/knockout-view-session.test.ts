import { describe, expect, it } from "vitest";
import { SIM_DT, TAKEDOWN_TIME, WAKE_TIME, clinicPoint, gangerEntity } from "@seki/sim";
import { frame, setup, steps, teleport } from "./story-helpers";

/**
 * G-449 in a headless session (ADR-0046): the view of a body knocked out in a takedown is sent
 * `unconscious` (the renderer lays it down) while it lies, while it is carried, after it is put
 * down, and no longer once it is woken.
 */

const CROUCH = frame({ crouch: true });
const USE = frame({ crouch: true, interact: true });
const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);

const knockedOut = () => {
  const { session, render } = setup();
  session.newGame();
  steps(session, 2);
  const world = session.sim.world;
  for (const g of [...world.with("ai")]) world.remove(g);
  for (const c of [...world.with("civilian")]) if (!c.passerby) world.remove(c);
  const street = clinicPoint(-4, 0, 4.4);
  teleport(session, street.x, street.z, 0, 0, street.y);
  steps(session, 30, CROUCH);
  const p = session.sim.player()!;
  const at = { x: p.position.x, y: p.position.y, z: p.position.z + 1.2 };
  const guard = world.add(gangerEntity(9000, { key: "test-guard", position: at, yaw: 0 }, null, 80, p.chunk ?? "", undefined, "tessen_guard"));
  steps(session, 1, CROUCH);
  expect(render.transforms.get(guard.id)?.unconscious).toBeUndefined();
  steps(session, 1, USE);
  steps(session, ticks(TAKEDOWN_TIME) + 1, CROUCH);
  expect(guard.unconscious).toBe(true);
  return { session, render, guard };
};

describe("the view of a knocked-out body (G-449)", () => {
  it("is sent unconscious lying, carried on the player's spot and put down", () => {
    const { session, render, guard } = knockedOut();
    const player = session.sim.player()!;
    expect(render.transforms.get(guard.id)?.unconscious).toBe(true);
    steps(session, 1, USE);
    expect(session.sim.session.carrying).toBe(guard.id);
    steps(session, 20, frame({ moveZ: 1 }));
    const carried = render.transforms.get(guard.id)!;
    const her = render.transforms.get(player.id)!;
    expect(carried.unconscious).toBe(true);
    // The renderer tells a carried body by its spot: the same as the player's.
    expect(Math.hypot(carried.position.x - her.position.x, carried.position.z - her.position.z)).toBeLessThan(1e-6);
    steps(session, 1, frame({ interact: true }));
    steps(session, 5);
    const down = render.transforms.get(guard.id)!;
    expect(down.unconscious).toBe(true);
    expect(Math.hypot(down.position.x - her.position.x, down.position.z - her.position.z)).toBeGreaterThan(0.5);
  });

  it("is sent conscious again once a patrol has woken it", () => {
    const { session, render, guard } = knockedOut();
    const stood = { ...session.sim.player()!.position };
    teleport(session, stood.x + 40, stood.z, -Math.PI / 2, 0, stood.y);
    steps(session, 5, CROUCH);
    const p = session.sim.player()!;
    const g = gangerEntity(9100, { key: "test-patrol", position: { x: guard.position.x - 1.2, y: guard.position.y, z: guard.position.z }, yaw: Math.PI / 2 }, null, 80, p.chunk ?? "");
    g.ai = { ...g.ai!, patrol: true };
    session.sim.world.add(g);
    steps(session, ticks(WAKE_TIME) - 1, CROUCH);
    expect(render.transforms.get(guard.id)?.unconscious).toBe(true);
    steps(session, 2, CROUCH);
    expect(guard.unconscious).toBeUndefined();
    expect(render.transforms.get(guard.id)?.unconscious).toBeUndefined();
  });
});
