import { describe, expect, it } from "vitest";
import {
  BALCONY_TOP,
  COYOTE_TIME,
  FALL_SAFE_HEIGHT,
  JUMP_SPEED,
  OVERPASS_TOP,
  ROOF_MID_TOP,
  ROOF_WEST_TOP,
  MARKET_PLACE,
  Simulation,
  TARG_ROOF_STASH,
  fallDamage,
  market,
} from "../src";
import { collect, input, run, teleportPlayer } from "./helpers";

const SOUTH = Math.PI;
const WEST = -Math.PI / 2;
const EAST = Math.PI / 2;

/**
 * The market keeps its own coordinates, moved onto Aleja Tysiąclecia by `MARKET_PLACE`
 * (ADR-0045): the player is put at a point of the market and read back in its coordinates.
 */
const at = (x: number, y: number, z: number, yaw = 0): Simulation => {
  const sim = Simulation.create({ seed: 1 });
  teleportPlayer(sim, market(x, y, z), yaw);
  run(sim, 2);
  teleportPlayer(sim, market(x, y, z), yaw);
  // Nobody shoots at the test subject.
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

const player = (sim: Simulation) => sim.player()!;
const pos = (sim: Simulation) => {
  const p = player(sim).position;
  return { x: p.x - MARKET_PLACE.x, y: p.y - MARKET_PLACE.y, z: p.z - MARKET_PLACE.z };
};

/**
 * Steps `frame` while `going` holds (at most `limit` steps) and returns the longest move of the
 * player in one step, metres: a climber eased on and off a ladder never jumps further than a run.
 */
const longestStep = (sim: Simulation, frame: Parameters<Simulation["step"]>[0], going: () => boolean, limit = 400): number => {
  let longest = 0;
  for (let i = 0; i < limit && going(); i++) {
    const from = { ...player(sim).position };
    sim.step(frame);
    const to = player(sim).position;
    longest = Math.max(longest, Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z));
  }
  return longest;
};

/** A market stall counter, 1 m high, x ∈ [95.4, 98], z ∈ [67.35, 68.65]. */
const COUNTER = { x: 96.7, front: 69.2, top: 1 } as const;

describe("jump (ADR-0021)", () => {
  it("cannot walk onto a 1 m counter, but jumps onto it", () => {
    const walk = at(COUNTER.x, 0, 70, SOUTH);
    run(walk, 60, input({ moveZ: 1 }));
    expect(pos(walk).y).toBeCloseTo(0, 5);
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
    expect(pos(sim).y).toBeCloseTo(0, 5);
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
    for (let i = 0; i < 60 && player(sim).climb?.settle; i++) sim.step(input({ moveZ: 1 }));
    // On the ladder: no fire, no gravity, forward climbs.
    run(sim, 40, input({ moveZ: 1, fire: true }));
    expect(pos(sim).y).toBeGreaterThan(0.9);
    expect(pos(sim).x).toBeCloseTo(73.2, 5);
    for (let i = 0; i < 200 && (player(sim).climb || player(sim).mantle); i++) sim.step(input({ moveZ: 1 }));
    expect(pos(sim).y).toBeCloseTo(BALCONY_TOP, 5);
    run(sim, 5);
    expect(pos(sim).y).toBeCloseTo(BALCONY_TOP, 5);
    // Along the balcony and into the second ladder.
    player(sim).yaw = WEST;
    for (let i = 0; i < 120 && pos(sim).x > 69.3; i++) sim.step(input({ moveZ: 1 }));
    player(sim).yaw = SOUTH;
    for (let i = 0; i < 30 && !player(sim).climb; i++) sim.step(input({ moveZ: 1 }));
    expect(player(sim).climb?.ladder).toBe("targ-escape-2");
    for (let i = 0; i < 300 && (player(sim).climb || player(sim).mantle); i++) sim.step(input({ moveZ: 1 }));
    expect(pos(sim).y).toBeCloseTo(ROOF_WEST_TOP, 5);
    expect(pos(sim).z).toBeLessThan(64);
    expect(climbs.map((c) => c.on)).toEqual([true, false, true, false]);
  });

  it("walking into the foot from an angle eases her onto the rungs, the view turning with her", () => {
    // 30 degrees off the ladder and a hand's width to its side.
    const a = SOUTH + 0.52;
    const sim = at(73.2 - Math.sin(a) * 1.2 + 0.2, 0, 64.4 - Math.cos(a) * 1.2, a);
    let longestTurn = 0;
    const turnOf = () => player(sim).yaw;
    const onTheWay = () => !player(sim).climb || player(sim).climb?.settle !== undefined;
    let longest = 0;
    for (let i = 0; i < 90 && onTheWay(); i++) {
      const yaw = turnOf();
      longest = Math.max(longest, longestStep(sim, input({ moveZ: 1 }), () => true, 1));
      longestTurn = Math.max(longestTurn, Math.abs(Math.atan2(Math.sin(turnOf() - yaw), Math.cos(turnOf() - yaw))));
    }
    expect(player(sim).climb?.ladder).toBe("targ-escape-1");
    // Before: 0.57 m sideways and the whole 30 degrees in the step she caught it.
    expect(longest).toBeLessThan(0.12);
    expect(longestTurn).toBeLessThan(0.1);
    expect(pos(sim).x).toBeCloseTo(73.2, 5);
    expect(pos(sim).z).toBeCloseTo(64.4, 5);
    expect(player(sim).yaw).toBeCloseTo(SOUTH, 5);
  });

  it("steps off at the top in a pull-over, not a jump onto the roof", () => {
    const sim = at(69.2, BALCONY_TOP, 64.4, SOUTH);
    sim.step(input({ interact: true }));
    expect(player(sim).climb?.ladder).toBe("targ-escape-2");
    const climbing = () => player(sim).climb !== undefined || player(sim).mantle !== undefined;
    // Before: the last rung put her 1.1 m over onto the roof in one step.
    expect(longestStep(sim, input({ moveZ: 1 }), climbing)).toBeLessThan(0.2);
    expect(climbing()).toBe(false);
    expect(pos(sim).y).toBeCloseTo(ROOF_WEST_TOP, 5);
    expect(pos(sim).z).toBeCloseTo(63.3, 5);
    run(sim, 10);
    expect(pos(sim).y).toBeCloseTo(ROOF_WEST_TOP, 5);
  });

  it("from the top she swings over the edge onto the rungs, not a jump onto them", () => {
    const sim = at(69.2, ROOF_WEST_TOP, 63.3, 0);
    run(sim, 2);
    const from = { ...player(sim).position };
    sim.step(input({ interact: true }));
    expect(player(sim).climb?.ladder).toBe("targ-escape-2");
    // Before: the key put her 1.1 m out and 0.8 m down in one step.
    const moved = Math.hypot(player(sim).position.x - from.x, player(sim).position.y - from.y, player(sim).position.z - from.z);
    const settling = () => player(sim).climb?.settle !== undefined;
    expect(Math.max(moved, longestStep(sim, input(), settling))).toBeLessThan(0.2);
    // On the rungs, facing the wall, a little below the top.
    expect(pos(sim).z).toBeCloseTo(64.4, 5);
    expect(pos(sim).y).toBeCloseTo(ROOF_WEST_TOP - 0.8, 5);
    expect(player(sim).yaw).toBeCloseTo(SOUTH, 5);
    // Over the roof first, then down: never inside the wall below the roof's edge.
    const edge = 64;
    const back = at(69.2, ROOF_WEST_TOP, 63.3, 0);
    run(back, 2);
    back.step(input({ interact: true }));
    for (let i = 0; i < 60 && back.player()!.climb?.settle; i++) {
      const p = back.player()!.position;
      if (p.z - MARKET_PLACE.z < edge + 0.3) expect(p.y - MARKET_PLACE.y).toBeCloseTo(ROOF_WEST_TOP, 5);
      back.step(input());
    }
  });

  it("the interact key climbs down from the top; back steps down, and jump lets go", () => {
    const sim = at(69.2, ROOF_WEST_TOP, 63.3, 0);
    run(sim, 2);
    expect(sim.session.focusPrompt).toBe("prompt.ladder.down");
    sim.step(input({ interact: true }));
    expect(player(sim).climb?.ladder).toBe("targ-escape-2");
    run(sim, 1);
    expect(sim.session.focusPrompt).toBeNull();
    for (let i = 0; i < 60 && player(sim).climb?.settle; i++) sim.step(input());
    const y0 = pos(sim).y;
    run(sim, 40, input({ moveZ: -1 }));
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
    expect(loaded.player()!.position.y - MARKET_PLACE.y).toBeCloseTo(y, 5);
  });

  it("a game saved in any step of the swing onto the rungs or the pull-over loads without a fall", () => {
    /** Loads `sim` as saved now and lets it run: she is on the rungs or on the roof, unhurt. */
    const loadsSafely = (sim: Simulation, what: string) => {
      const loaded = Simulation.fromSnapshot(sim.snapshot(null, "ladder", ""));
      const landed = collect<{ drop: number }>(loaded, "Landed");
      run(loaded, 60);
      const p = loaded.player()!;
      const y = p.position.y - MARKET_PLACE.y;
      const onRungs = p.climb?.ladder === "targ-escape-2";
      expect(onRungs || Math.abs(y - ROOF_WEST_TOP) < 1e-6, `${what}: y ${y}`).toBe(true);
      expect(landed.filter((l) => l.drop > 0.5), `${what}: fell`).toHaveLength(0);
      expect(p.health?.current, what).toBe(100);
    };
    // Down: the interact key at the top, saved in every step of the swing.
    for (let k = 1; k <= 40; k++) {
      const sim = at(69.2, ROOF_WEST_TOP, 63.3, 0);
      run(sim, 2);
      sim.step(input({ interact: true }));
      run(sim, k);
      loadsSafely(sim, `swing, step ${k}`);
    }
    // Up: the pull-over at the top of the ladder, saved in every step of it.
    const start = () => {
      const sim = at(69.2, BALCONY_TOP, 64.4, SOUTH);
      sim.step(input({ interact: true }));
      for (let i = 0; i < 300 && player(sim).climb; i++) sim.step(input({ moveZ: 1 }));
      expect(player(sim).mantle).toBeDefined();
      return sim;
    };
    for (let k = 0; k <= 40; k++) {
      const sim = start();
      run(sim, k);
      loadsSafely(sim, `pull-over, step ${k}`);
    }
  });

  it("the third ladder leads to Hebi's roof stash, placed once when the player comes near", () => {
    const sim = at(79.6, ROOF_WEST_TOP, 60.5, EAST);
    const bag = () => sim.world.with("lootBag").entities.find((e) => e.lootBag.key === TARG_ROOF_STASH.key);
    run(sim, 2);
    expect(sim.domain.loot.containers.some((c) => c.key === TARG_ROOF_STASH.key)).toBe(true);
    expect(bag()?.position.y).toBeCloseTo(ROOF_MID_TOP + MARKET_PLACE.y, 5);
    sim.step(input({ interact: true }));
    expect(player(sim).climb?.ladder).toBe("targ-escape-3");
    for (let i = 0; i < 300 && (player(sim).climb || player(sim).mantle); i++) sim.step(input({ moveZ: 1 }));
    expect(pos(sim).y).toBeCloseTo(ROOF_MID_TOP, 5);
    // Placed once: walking about up here does not add another.
    run(sim, 30);
    expect(sim.domain.flags).toContain(`placed:${TARG_ROOF_STASH.key}`);
    expect(sim.domain.loot.containers.filter((c) => c.key === TARG_ROOF_STASH.key)).toHaveLength(1);
  });
});
