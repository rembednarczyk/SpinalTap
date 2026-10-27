import { describe, expect, it } from "vitest";
import {
  BALCONY_TOP,
  COYOTE_TIME,
  FALL_SAFE_HEIGHT,
  JUMP_SPEED,
  OVERPASS_TOP,
  ROOF_MID_TOP,
  ROOF_WEST_TOP,
  Simulation,
  TARG_ROOF_STASH,
  fallDamage,
} from "../src";
import { collect, input, run, teleportPlayer } from "./helpers";

const SOUTH = Math.PI;
const WEST = -Math.PI / 2;
const EAST = Math.PI / 2;

const at = (x: number, y: number, z: number, yaw = 0): Simulation => {
  const sim = Simulation.create({ seed: 1 });
  teleportPlayer(sim, { x, y, z }, yaw);
  run(sim, 2);
  teleportPlayer(sim, { x, y, z }, yaw);
  // Nobody shoots at the test subject.
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

const player = (sim: Simulation) => sim.player()!;
const pos = (sim: Simulation) => player(sim).position;

/** A market stall counter, 1 m high, x ∈ [95.4, 98], z ∈ [67.35, 68.65]. */
const COUNTER = { x: 96.7, front: 69.2, top: 1 } as const;

describe("jump (ADR-0021)", () => {
  it("cannot walk onto a 1 m counter, but jumps onto it", () => {
    const walk = at(COUNTER.x, 0, 70, SOUTH);
    run(walk, 60, input({ moveZ: 1 }));
    expect(pos(walk).y).toBe(0);
    expect(pos(walk).z).toBeGreaterThan(68.65);

    const sim = at(COUNTER.x, 0, COUNTER.front, SOUTH);
    const jumped = collect<{ entityId: number }>(sim, "Jumped");
    const landed = collect<{ drop: number }>(sim, "Landed");
    let peak = 0;
    sim.step(input({ moveZ: 1, jump: true }));
    for (let i = 0; i < 90 && landed.length === 0; i++) {
      sim.step(input({ moveZ: 1 }));
      peak = Math.max(peak, pos(sim).y);
    }
    expect(jumped).toHaveLength(1);
    expect(peak).toBeGreaterThan(1.1);
    expect(peak).toBeLessThan((JUMP_SPEED * JUMP_SPEED) / 40 + 0.05);
    // On top of the counter.
    expect(pos(sim).y).toBeCloseTo(COUNTER.top, 5);
    expect(pos(sim).z).toBeLessThan(68.65);
    run(sim, 10);
    expect(pos(sim).y).toBeCloseTo(COUNTER.top, 5);
  });

  it("has no double jump: a second press in the air does nothing", () => {
    const sim = at(96, 0, 76);
    const jumped = collect(sim, "Jumped");
    sim.step(input({ jump: true }));
    run(sim, 15);
    const mid = player(sim).fall!;
    sim.step(input({ jump: true }));
    expect(player(sim).fall!).toBeLessThan(mid);
    run(sim, 60);
    expect(jumped).toHaveLength(1);
    expect(pos(sim).y).toBe(0);
  });

  it("coyote time: a jump just after walking off an edge still takes off, a late one does not", () => {
    const onEdge = () => {
      const sim = at(COUNTER.x, COUNTER.top, 68, 0);
      run(sim, 2);
      // Walk north off the counter.
      let steps = 0;
      while (player(sim).fall === undefined && steps++ < 120) sim.step(input({ moveZ: 1 }));
      return sim;
    };
    const early = onEdge();
    expect(early.player()!.fall).toBeLessThan(0);
    run(early, 3, input({ moveZ: 1 }));
    early.step(input({ moveZ: 1, jump: true }));
    expect(early.player()!.fall).toBeGreaterThan(0);

    const late = onEdge();
    run(late, Math.ceil(COYOTE_TIME * 60) + 2, input({ moveZ: 1 }));
    expect(late.player()!.fall).toBeLessThan(0);
    late.step(input({ moveZ: 1, jump: true }));
    expect(late.player()!.fall).toBeLessThan(0);
  });

  it("buffers a press made just before landing", () => {
    const sim = at(96, 0, 76);
    const jumped = collect(sim, "Jumped");
    sim.step(input({ jump: true }));
    // Down again after ~0.66 s; press 4 steps before touching down.
    for (let i = 0; i < 120 && !(player(sim).fall !== undefined && player(sim).fall! < 0 && pos(sim).y < 0.25); i++) sim.step(input());
    sim.step(input({ jump: true }));
    run(sim, 8);
    expect(jumped).toHaveLength(2);
  });

  it("jumping keeps the take-off speed: the stick only nudges it in the air", () => {
    const sim = at(96, 0, 76, EAST);
    run(sim, 20, input({ moveZ: 1, sprint: true }));
    sim.step(input({ moveZ: 1, sprint: true, jump: true }));
    const vx = player(sim).velocity!.x;
    // Pull back hard in the air.
    run(sim, 10, input({ moveZ: -1 }));
    expect(player(sim).fall).toBeDefined();
    expect(player(sim).velocity!.x).toBeGreaterThan(vx * 0.5);
  });
});

describe("falls (ADR-0021)", () => {
  it("a fall from the overpass hurts through DamageDealt, lands hard and slows the next steps", () => {
    const sim = at(96, OVERPASS_TOP, 80);
    const damage = collect<{ sourceId: number; targetId: number; amount: number; zone: string }>(sim, "DamageDealt");
    const landed = collect<{ drop: number; hard: boolean; damage: number }>(sim, "Landed");
    const hp = player(sim).health!.current;
    for (let i = 0; i < 120 && landed.length === 0; i++) sim.step(input());
    expect(landed).toHaveLength(1);
    expect(landed[0]!.drop).toBeCloseTo(OVERPASS_TOP, 1);
    expect(landed[0]!.hard).toBe(true);
    expect(landed[0]!.damage).toBe(fallDamage(OVERPASS_TOP));
    expect(damage).toEqual([expect.objectContaining({ sourceId: player(sim).id, targetId: player(sim).id, zone: "leg", amount: fallDamage(OVERPASS_TOP) })]);
    expect(player(sim).health!.current).toBe(hp - fallDamage(OVERPASS_TOP));
    sim.step(input({ moveZ: 1 }));
    const slow = Math.hypot(player(sim).velocity!.x, player(sim).velocity!.z);
    run(sim, 60, input({ moveZ: 1 }));
    expect(Math.hypot(player(sim).velocity!.x, player(sim).velocity!.z)).toBeGreaterThan(slow * 1.8);
  });

  it("small drops and jumps do no harm", () => {
    expect(fallDamage(FALL_SAFE_HEIGHT)).toBe(0);
    expect(fallDamage(FALL_SAFE_HEIGHT + 1)).toBeGreaterThan(0);
    const sim = at(COUNTER.x, COUNTER.top, 68, 0);
    const landed = collect<{ hard: boolean; damage: number }>(sim, "Landed");
    run(sim, 60, input({ moveZ: 1 }));
    expect(landed).toEqual([expect.objectContaining({ hard: false, damage: 0 })]);
  });
});

describe("fire escape ladders (ADR-0021)", () => {
  it("walks into the ladder, climbs onto the balcony, then up the second ladder onto the roof", () => {
    const sim = at(73.2, 0, 65.6, SOUTH);
    const climbs = collect<{ on: boolean }>(sim, "LadderClimb");
    for (let i = 0; i < 60 && !player(sim).climb; i++) sim.step(input({ moveZ: 1 }));
    expect(player(sim).climb?.ladder).toBe("targ-escape-1");
    // On the ladder: no fire, no gravity, forward climbs.
    run(sim, 30, input({ moveZ: 1, fire: true }));
    expect(pos(sim).y).toBeGreaterThan(0.9);
    expect(pos(sim).x).toBe(73.2);
    for (let i = 0; i < 200 && player(sim).climb; i++) sim.step(input({ moveZ: 1 }));
    expect(pos(sim).y).toBeCloseTo(BALCONY_TOP, 5);
    run(sim, 5);
    expect(pos(sim).y).toBeCloseTo(BALCONY_TOP, 5);
    // Along the balcony and into the second ladder.
    player(sim).yaw = WEST;
    for (let i = 0; i < 120 && pos(sim).x > 69.3; i++) sim.step(input({ moveZ: 1 }));
    player(sim).yaw = SOUTH;
    for (let i = 0; i < 30 && !player(sim).climb; i++) sim.step(input({ moveZ: 1 }));
    expect(player(sim).climb?.ladder).toBe("targ-escape-2");
    for (let i = 0; i < 300 && player(sim).climb; i++) sim.step(input({ moveZ: 1 }));
    expect(pos(sim).y).toBeCloseTo(ROOF_WEST_TOP, 5);
    expect(pos(sim).z).toBeLessThan(64);
    expect(climbs.map((c) => c.on)).toEqual([true, false, true, false]);
  });

  it("the interact key climbs down from the top; back steps down, and jump lets go", () => {
    const sim = at(69.2, ROOF_WEST_TOP, 63.3, 0);
    run(sim, 2);
    expect(sim.session.focusPrompt).toBe("Zejdź po drabinie");
    sim.step(input({ interact: true }));
    expect(player(sim).climb?.ladder).toBe("targ-escape-2");
    run(sim, 1);
    expect(sim.session.focusPrompt).toBeNull();
    const y0 = pos(sim).y;
    run(sim, 30, input({ moveZ: -1 }));
    expect(pos(sim).y).toBeLessThan(y0 - 0.9);
    sim.step(input({ jump: true }));
    expect(player(sim).climb).toBeUndefined();
    run(sim, 90);
    expect(pos(sim).y).toBeCloseTo(BALCONY_TOP, 5);
  });

  it("a game saved on a ladder holds on after loading", () => {
    const sim = at(73.2, 0, 64.4, SOUTH);
    sim.step(input({ interact: true }));
    expect(player(sim).climb).toBeDefined();
    run(sim, 40, input({ moveZ: 1 }));
    const y = pos(sim).y;
    const loaded = Simulation.fromSnapshot(sim.snapshot(null, "ladder", ""));
    run(loaded, 30);
    expect(loaded.player()!.climb?.ladder).toBe("targ-escape-1");
    expect(loaded.player()!.position.y).toBeCloseTo(y, 5);
  });

  it("the third ladder leads to Hebi's roof stash, placed once when the player comes near", () => {
    const sim = at(79.6, ROOF_WEST_TOP, 60.5, EAST);
    const bag = () => sim.world.with("lootBag").entities.find((e) => e.lootBag.key === TARG_ROOF_STASH.key);
    run(sim, 2);
    expect(sim.domain.loot.containers.some((c) => c.key === TARG_ROOF_STASH.key)).toBe(true);
    expect(bag()?.position.y).toBeCloseTo(ROOF_MID_TOP, 5);
    sim.step(input({ interact: true }));
    expect(player(sim).climb?.ladder).toBe("targ-escape-3");
    for (let i = 0; i < 300 && player(sim).climb; i++) sim.step(input({ moveZ: 1 }));
    expect(pos(sim).y).toBeCloseTo(ROOF_MID_TOP, 5);
    // Placed once: walking about up here does not add another.
    run(sim, 30);
    expect(sim.domain.flags).toContain(`placed:${TARG_ROOF_STASH.key}`);
    expect(sim.domain.loot.containers.filter((c) => c.key === TARG_ROOF_STASH.key)).toHaveLength(1);
  });
});
