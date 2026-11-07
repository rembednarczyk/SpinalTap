import { describe, expect, it } from "vitest";
import type { DomainEvents } from "@seki/core";
import { GRAB_PROMPT, GRAB_TIME, SIM_DT, type Simulation, TAKEDOWN_TIME, gangerEntity, type Entity } from "../src";
import { collect, input, run, streetSim } from "./helpers";
import { withPerks } from "./perk-scenes";

/**
 * The grab with a choice (ADR-0075, stage 1): the `takedown` command without `lethal` grabs the
 * target and waits for `takedown-choose`; with nothing chosen in `GRAB_TIME` it knocks out.
 */

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);
const CROUCH = input({ crouch: true });

/** The player crouched on an empty street, a Tessen guard 1.2 m north with its back to her. */
const grabScene = (seed = 7): { sim: Simulation; guard: Entity } => {
  const sim = streetSim({ seed });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  const p = sim.player()!;
  p.posture!.crouched = true;
  p.posture!.amount = 1;
  p.posture!.prevAmount = 1;
  const at = { x: p.position.x, y: p.position.y, z: p.position.z + 1.2 };
  const guard = sim.world.add(gangerEntity(4012, { key: "guard", position: at, yaw: 0 }, null, 80, p.chunk ?? "", undefined, "tessen_guard"));
  sim.step(CROUCH);
  return { sim, guard };
};

const grab = (sim: Simulation): void => {
  sim.enqueue({ type: "takedown" });
  sim.step(CROUCH);
};

describe("the grab with a choice (ADR-0075)", () => {
  it("grabs and holds both while she chooses, the prompt offering the knock-out and the kill", () => {
    const { sim, guard } = grabScene();
    const started = collect<DomainEvents["TakedownStarted"]>(sim, "TakedownStarted");
    const focus = collect<DomainEvents["InteractionFocusChanged"]>(sim, "InteractionFocusChanged");
    const done = collect(sim, "TakedownDone");
    grab(sim);
    expect(started).toEqual([{ target: guard.id, duration: TAKEDOWN_TIME, window: GRAB_TIME }]);
    expect(focus.at(-1)).toEqual({ targetId: guard.id, prompt: GRAB_PROMPT });
    const p = sim.player()!;
    const from = { ...p.position };
    run(sim, ticks(GRAB_TIME) - 2, input({ crouch: true, moveZ: 1 }));
    expect(sim.session.takedown?.phase).toBe("grab");
    expect(done).toHaveLength(0);
    expect(p.position.z).toBeCloseTo(from.z, 6);
    expect(guard.unconscious).toBeUndefined();
  });

  it("knocks out on the choice, after the end's 1.2 s, the prompt empty meanwhile", () => {
    const { sim, guard } = grabScene();
    const chosen = collect<DomainEvents["TakedownChosen"]>(sim, "TakedownChosen");
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    const focus = collect<DomainEvents["InteractionFocusChanged"]>(sim, "InteractionFocusChanged");
    grab(sim);
    run(sim, 20, CROUCH);
    sim.enqueue({ type: "takedown-choose", lethal: false });
    sim.step(CROUCH);
    expect(chosen).toEqual([{ target: guard.id, lethal: false, timedOut: false }]);
    expect(focus.at(-1)).toEqual({ targetId: guard.id, prompt: null });
    // A second choice is refused: the end is under way.
    sim.enqueue({ type: "takedown-choose", lethal: true });
    run(sim, ticks(TAKEDOWN_TIME) - 2, CROUCH);
    expect(done).toHaveLength(0);
    run(sim, 2, CROUCH);
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: false }]);
    expect(guard.unconscious).toBe(true);
    expect(chosen).toHaveLength(1);
  });

  it("kills on the choice, and the attack button that chose it fires nothing until let go", () => {
    const { sim, guard } = grabScene();
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    const shots = collect(sim, "ShotFired");
    grab(sim);
    const fire = input({ crouch: true, fire: true });
    sim.enqueue({ type: "takedown-choose", lethal: true });
    run(sim, ticks(TAKEDOWN_TIME) + 1, fire);
    expect(done).toEqual([{ target: guard.id, lethal: true, witnessed: false }]);
    expect(sim.domain.flags).toContain("dead:guard");
    run(sim, 30, fire);
    expect(shots).toHaveLength(0);
    sim.step(CROUCH);
    run(sim, 5, fire);
    expect(shots.length).toBeGreaterThan(0);
  });

  it("knocks out when nothing is chosen in time; holding the attack button chooses nothing", () => {
    const { sim, guard } = grabScene();
    const chosen = collect<DomainEvents["TakedownChosen"]>(sim, "TakedownChosen");
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    grab(sim);
    const fire = input({ crouch: true, fire: true });
    // The step of the grab counts too: one step before the window ends, nothing yet.
    run(sim, ticks(GRAB_TIME) - 2, fire);
    expect(chosen).toHaveLength(0);
    sim.step(fire);
    expect(chosen).toEqual([{ target: guard.id, lethal: false, timedOut: true }]);
    run(sim, ticks(TAKEDOWN_TIME), fire);
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: false }]);
    expect(guard.unconscious).toBe(true);
  });

  it("refuses a choice without a grab, and the grab breaks when she is hurt", () => {
    const { sim, guard } = grabScene();
    const chosen = collect(sim, "TakedownChosen");
    const broken = collect<DomainEvents["TakedownBroken"]>(sim, "TakedownBroken");
    sim.enqueue({ type: "takedown-choose", lethal: true });
    sim.step(CROUCH);
    expect(chosen).toHaveLength(0);
    expect(sim.session.takedown).toBeNull();
    grab(sim);
    run(sim, ticks(1), CROUCH);
    const p = sim.player()!;
    p.health = { ...p.health!, current: p.health!.current - 5 };
    sim.step(CROUCH);
    expect(broken).toEqual([{ target: guard.id, reason: "damage" }]);
    expect(guard.ai!.alerted).toBe(true);
    expect(sim.session.takedown).toBeNull();
  });

  it("Quick Takedown shortens the end, not the time to choose", () => {
    const { sim } = grabScene(11);
    withPerks(sim, { shadow_quick_takedown: 2 });
    const started = collect<DomainEvents["TakedownStarted"]>(sim, "TakedownStarted");
    grab(sim);
    expect(started[0]!.window).toBe(GRAB_TIME);
    expect(started[0]!.duration).toBeCloseTo(TAKEDOWN_TIME * 0.6, 9);
  });
});
