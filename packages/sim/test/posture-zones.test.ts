import { describe, expect, it } from "vitest";
import { BASE_STATS, WEAPONS } from "@seki/core";
import {
  CROUCH_BODY_SCALE,
  CROUCH_EYE_HEIGHT,
  CROUCH_SPEED_MULTIPLIER,
  CROUCH_TIME,
  EYE_HEIGHT,
  GUNFIRE_INTERRUPT_RADIUS,
  RenderSync,
  SIM_DT,
  Simulation,
  aimSpreadOf,
  bodyAabb,
  eyeOf,
  hitscan,
  rayHitboxes,
  type Entity,
} from "../src";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

const crouchTicks = Math.ceil(CROUCH_TIME / SIM_DT);

/** A bare character standing at the origin facing +Z. */
const dummy = (patch: Partial<Entity> = {}): Entity => ({
  id: 99,
  position: { x: 0, y: 0, z: 0 },
  prevPosition: { x: 0, y: 0, z: 0 },
  yaw: 0,
  prevYaw: 0,
  pitch: 0,
  body: { radius: 0.38, height: 1.8 },
  ...patch,
});

/** A ray from 5 m in front of the dummy, aimed horizontally at height y and lateral offset x. */
const shootAt = (e: Entity, y: number, x = 0) => rayHitboxes(e, { x, y, z: 5 }, { x: 0, y: 0, z: -1 }, 20);

describe("crouching", () => {
  it("eases down over CROUCH_TIME while held and back up on release", () => {
    const sim = Simulation.create({ seed: 1 });
    const p = sim.player()!;
    sim.step(input({ crouch: true }));
    expect(p.posture!.amount).toBeGreaterThan(0);
    expect(p.posture!.amount).toBeLessThan(1);
    run(sim, crouchTicks, input({ crouch: true }));
    expect(p.posture!.amount).toBe(1);
    expect(eyeOf(p).y).toBeCloseTo(CROUCH_EYE_HEIGHT);
    run(sim, crouchTicks + 1);
    expect(p.posture!.amount).toBe(0);
    expect(eyeOf(p).y).toBeCloseTo(EYE_HEIGHT);
  });

  it("moves slower and cannot sprint", () => {
    const speed = (frame: Parameters<typeof input>[0]) => {
      const sim = Simulation.create({ seed: 1 });
      run(sim, crouchTicks + 1, input(frame));
      const v = sim.player()!.velocity!;
      return Math.hypot(v.x, v.z);
    };
    expect(speed({ moveZ: 1 })).toBeCloseTo(BASE_STATS.moveSpeed);
    expect(speed({ moveZ: 1, crouch: true })).toBeCloseTo(BASE_STATS.moveSpeed * CROUCH_SPEED_MULTIPLIER);
    expect(speed({ moveZ: 1, crouch: true, sprint: true })).toBeCloseTo(BASE_STATS.moveSpeed * CROUCH_SPEED_MULTIPLIER);
  });

  it("lowers the hitbox: a chest-high shot over a crouched body misses", () => {
    const standing = dummy();
    const crouched = dummy({ posture: { crouched: true, amount: 1, prevAmount: 1, sprinting: false } });
    expect(shootAt(standing, 1.4)?.zone).toBe("torso");
    expect(shootAt(crouched, 1.4)).toBeNull();
    expect(bodyAabb(crouched)!.max.y).toBeCloseTo(1.8 * CROUCH_BODY_SCALE);
    expect(shootAt(crouched, 1.18)?.zone).toBe("head");
  });

  it("keeps the stance frozen during dialogue", () => {
    const sim = Simulation.create({ seed: 1 });
    run(sim, crouchTicks + 1, input({ crouch: true }));
    sim.session.dialogueActive = true;
    run(sim, 10);
    expect(sim.player()!.posture!.amount).toBe(1);
  });

  it("sends the interpolated crouch to the renderer", () => {
    const sim = Simulation.create({ seed: 1 });
    sim.step(input({ crouch: true }));
    const updates: { crouch?: number }[] = [];
    const port = {
      spawn: () => {},
      updateTransform: (id: number, t: { crouch?: number }) => id === sim.player()!.id && updates.push(t),
      despawn: () => {},
      clear: () => {},
      setCameraMode: () => {},
      attachCamera: () => {},
      playEffect: () => {},
      setAppearance: () => {},
    };
    const sync = new RenderSync(port);
    sync.sync(sim.world, 0);
    sync.sync(sim.world, 0.5);
    const amount = sim.player()!.posture!.amount;
    expect(updates.at(-1)?.crouch).toBeCloseTo(amount / 2);
  });
});

describe("hit zones", () => {
  it("maps heights and sides to body parts", () => {
    const e = dummy();
    expect(shootAt(e, 1.7)?.zone).toBe("head");
    expect(shootAt(e, 1.2)?.zone).toBe("torso");
    expect(shootAt(e, 1.2, 0.26)?.zone).toBe("arm");
    expect(shootAt(e, 1.2, -0.26)?.zone).toBe("arm");
    expect(shootAt(e, 0.5, 0.1)?.zone).toBe("leg");
    // Between the knees and past the shoulder there is nothing to hit.
    expect(shootAt(e, 0.4, 0)).toBeNull();
    expect(shootAt(e, 1.2, 0.36)).toBeNull();
  });

  it("turns the boxes with the yaw", () => {
    // Facing +X, the right arm is towards -Z.
    const e = dummy({ yaw: Math.PI / 2 });
    const fromFront = (z: number) => rayHitboxes(e, { x: 5, y: 1.2, z }, { x: -1, y: 0, z: 0 }, 20)?.zone;
    expect(fromFront(0)).toBe("torso");
    expect(fromFront(-0.26)).toBe("arm");
    expect(fromFront(0.36)).toBeUndefined();
  });

  it("hitscan reports the zone and stops at walls", () => {
    const sim = Simulation.create({ seed: 1 });
    const guard = byKey(sim, "guard")!;
    const from = { x: guard.position.x, y: 1.7, z: guard.position.z - 4 };
    const hit = hitscan(sim.world, from, { x: 0, y: 0, z: 1 }, 30, sim.player()!.id);
    expect(hit.entity).toBe(guard);
    expect(hit.zone).toBe("head");
    const wall = hitscan(sim.world, { x: 0, y: 1.2, z: 0 }, { x: 1, y: 0, z: 0 }, 60, sim.player()!.id);
    expect(wall.zone).toBeNull();
  });

  it("damage events carry the zone", () => {
    const sim = Simulation.create({ seed: 5 });
    const hits = collect<{ zone: string; sourceId: number }>(sim, "DamageDealt");
    const guard = byKey(sim, "guard")!;
    // Past the crate, 2.5 m away. Crouched, the eye is at 1.14 m: aim down at one thigh (not between the legs).
    teleportPlayer(sim, { x: guard.position.x - 0.1, y: 0, z: guard.position.z - 2.5 }, 0, 0.24);
    run(sim, crouchTicks + 1, input({ crouch: true }));
    const mine = () => hits.filter((h) => h.sourceId === sim.player()!.id);
    for (let i = 0; i < 60 && mine().length === 0; i++) sim.step(input({ fire: true, crouch: true }));
    expect(mine()[0]?.zone).toBe("leg");
  });
});

describe("aim spread in the sim", () => {
  it("crouching narrows it, moving and shooting widen it, and bloom recovers", () => {
    const sim = Simulation.create({ seed: 2 });
    const standing = sim.aimSpread();
    run(sim, crouchTicks + 1, input({ crouch: true }));
    const crouched = sim.aimSpread();
    expect(crouched).toBeLessThan(standing * 0.6);
    run(sim, crouchTicks + 1, input({ moveZ: 1, sprint: true }));
    expect(sim.aimSpread()).toBeGreaterThan(standing);
    run(sim, 30);
    expect(sim.aimSpread()).toBeCloseTo(standing);
    sim.step(input({ fire: true }));
    const bloomed = sim.aimSpread();
    expect(bloomed).toBeGreaterThan(standing);
    run(sim, 60);
    expect(sim.aimSpread()).toBeCloseTo(standing);
  });

  it("follows the starting optics' stability; a ganger has none", () => {
    const sim = Simulation.create({ seed: 2 });
    expect(sim.aimSpread()).toBeCloseTo(WEAPONS.pistol.spread.base * 0.9);
    const guard = byKey(sim, "guard")!;
    expect(aimSpreadOf(guard, null)).toBeCloseTo(WEAPONS.gangerSmg.spread.base);
  });

  it("is deterministic: the same seed spreads the same shots", () => {
    const shots = (seed: number) => {
      const sim = Simulation.create({ seed });
      const out = collect<{ to: { x: number; y: number } }>(sim, "ShotFired");
      run(sim, 120, input({ fire: true }));
      return out.map((s) => `${s.to.x.toFixed(4)},${s.to.y.toFixed(4)}`);
    };
    expect(shots(9)).toEqual(shots(9));
    expect(new Set(shots(9)).size).toBeGreaterThan(1);
  });
});

describe("violence interrupts a conversation", () => {
  /** Puts the player in a conversation next to the alerted guard, in its line of fire. */
  const talkingNearGuard = (distance: number) => {
    const sim = Simulation.create({ seed: 4 });
    const guard = byKey(sim, "guard")!;
    // Only the guard: other gangers in the alley would shoot from further away.
    for (const g of [...sim.world.with("ai")]) if (g !== guard) sim.world.remove(g);
    guard.ai!.alerted = true;
    teleportPlayer(sim, { x: guard.position.x, y: 0, z: guard.position.z - distance });
    sim.session.dialogueActive = true;
    return { sim, guard, events: collect<{ reason: string; sourceId: number }>(sim, "DialogueInterrupted") };
  };

  it("ends the dialogue and hands control back when an enemy opens fire", () => {
    const { sim, guard, events } = talkingNearGuard(5);
    for (let i = 0; i < 120 && events.length === 0; i++) sim.step();
    expect(events).toHaveLength(1);
    expect(["damage", "gunfire"]).toContain(events[0]!.reason);
    expect(events[0]!.sourceId).toBe(guard.id);
    expect(sim.session.dialogueActive).toBe(false);
    expect(sim.session.lastThreat?.sourceId).toBe(guard.id);
    // The player moves again.
    sim.step(input({ moveZ: -1 }));
    expect(Math.hypot(sim.player()!.velocity!.x, sim.player()!.velocity!.z)).toBeGreaterThan(0);
  });

  it("reports damage when the shot lands", () => {
    const { sim, events } = talkingNearGuard(3);
    const hurt = collect<{ targetId: number }>(sim, "DamageDealt");
    for (let i = 0; i < 600 && !hurt.some((h) => h.targetId === sim.player()!.id); i++) {
      sim.session.dialogueActive = true;
      sim.step();
    }
    expect(events.at(-1)?.reason).toBe("damage");
  });

  it("emits once per conversation and nothing outside one", () => {
    const { sim, events } = talkingNearGuard(5);
    run(sim, 300);
    expect(events).toHaveLength(1);
    expect(GUNFIRE_INTERRUPT_RADIUS).toBeGreaterThan(5);
  });
});
