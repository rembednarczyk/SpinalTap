import { describe, expect, it } from "vitest";
import { GRAB_TIME, SIM_DT, TAKEDOWN_TIME, clinicPoint, gangerEntity } from "@seki/sim";
import { frame, setup, steps, teleport } from "./story-helpers";

/**
 * The grab's phase in the views (ADR-0075 stage 2): the player and the target get `grab` through
 * the hold, the choke and the kill, and lose it once the takedown is over. The renderer plays its
 * clips from it, so a headless session with a fake `RenderPort` sees what the picture would.
 */

const CROUCH = frame({ crouch: true });
const USE = frame({ crouch: true, interact: true });
const FIRE = frame({ crouch: true, fire: true });
const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);

/** A new game on the deptak, nobody else about, the player crouched behind a Tessen guard. */
const behindGuard = () => {
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
  const grabOf = (id: number) => render.transforms.get(id)?.grab;
  return { session, render, guard, player: p, grabOf };
};

describe("the grab in the views (ADR-0075 stage 2)", () => {
  it("holds, chokes out and lets go: both views get the phase and lose it at the end", () => {
    const { session, guard, player, grabOf } = behindGuard();
    expect(grabOf(player.id)).toBeUndefined();
    expect(grabOf(guard.id)).toBeUndefined();
    steps(session, 1, USE);
    expect(grabOf(player.id)).toBe("hold");
    expect(grabOf(guard.id)).toBe("hold");
    steps(session, ticks(1), CROUCH);
    expect(grabOf(guard.id)).toBe("hold");
    steps(session, 1, USE);
    expect(grabOf(player.id)).toBe("choke");
    expect(grabOf(guard.id)).toBe("choke");
    steps(session, ticks(TAKEDOWN_TIME), CROUCH);
    expect(session.sim.session.takedown).toBeNull();
    expect(grabOf(player.id)).toBeUndefined();
    expect(grabOf(guard.id)).toBeUndefined();
    expect(guard.unconscious).toBe(true);
  });

  it("kills with the attack button: `kill` on both, then the body lies without it", () => {
    const { session, render, guard, player, grabOf } = behindGuard();
    steps(session, 1, USE);
    steps(session, ticks(0.5), CROUCH);
    steps(session, 1, FIRE);
    expect(grabOf(player.id)).toBe("kill");
    expect(grabOf(guard.id)).toBe("kill");
    steps(session, ticks(TAKEDOWN_TIME), CROUCH);
    expect(session.sim.domain.flags).toContain("dead:test-guard");
    expect(grabOf(player.id)).toBeUndefined();
    // The corpse keeps the target's view (ADR-0065): it lies, out of the grab.
    expect(grabOf(guard.id)).toBeUndefined();
    expect(render.transforms.get(guard.id)?.unconscious).toBe(true);
  });

  it("a grab run out chokes out on its own, and a broken grab drops the phase at once", () => {
    const { session, guard, grabOf } = behindGuard();
    steps(session, 1, USE);
    steps(session, ticks(GRAB_TIME), CROUCH);
    expect(grabOf(guard.id)).toBe("choke");
    steps(session, ticks(TAKEDOWN_TIME), CROUCH);
    expect(grabOf(guard.id)).toBeUndefined();

    const next = behindGuard();
    steps(next.session, 1, USE);
    expect(next.grabOf(next.guard.id)).toBe("hold");
    next.session.sim.world.remove(next.guard);
    steps(next.session, 1, CROUCH);
    expect(next.session.sim.session.takedown).toBeNull();
    expect(next.grabOf(next.player.id)).toBeUndefined();
  });
});
