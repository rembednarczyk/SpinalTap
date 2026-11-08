import { describe, expect, it } from "vitest";
import { type AudioPort, EMPTY_INPUT } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { P1_CABINS, P1_RAMP, TRAFFIC_ROUTES, type Entity, p1DriveFloor, p1RampY } from "@seki/sim";
import { FakeRender, teleport } from "./story-helpers";
import { GameSession } from "../src/game-session";

/**
 * The cars of Alchemia's P-1 in the street's traffic (ADR-0074 §4, G-491, G-510), headless: seen
 * from T0's square by the ramp's trench, one comes along Bajkowskiego, turns onto the driveway and
 * down the ramp into the south hand-over cabin, another comes out of the north cabin, up the ramp
 * and away along Bajkowskiego and up Lubartowska past Olejna; on the ramp's surface, never into
 * another car, and neither comes or goes where Seki on the square would see it.
 */

const audio: AudioPort = { play() {}, stopAll() {} };
const IN = TRAFFIC_ROUTES.length - 2;
const OUT = TRAFFIC_ROUTES.length - 1;
const OLEJNA = { x: 454.9, z: 42.8 };
/** On T0 west of the ramp's trench, looking south-east to Bajkowskiego and the driveway. */
const ON_T0 = { x: 407, z: 0 };
const LOOK = Math.atan2(414 - ON_T0.x, -12 - ON_T0.z);

type Car = Entity & { vehicle: NonNullable<Entity["vehicle"]> };

const start = () => {
  const session = new GameSession({
    render: new FakeRender(),
    audio,
    persistence: new SavePersistence(new MemorySaveStore()),
    ui: createUiStore(),
    story: STORY_SOURCE,
    seed: () => 77,
    now: () => new Date(2026, 9, 27),
    traffic: "high",
  });
  session.newGame();
  // From 21:00 to the morning's rush hour: a car on each of the ramp's routes.
  session.sim.enqueue({ type: "wait", minutes: 11 * 60 });
  session.step(EMPTY_INPUT);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  teleport(session, ON_T0.x, ON_T0.z, LOOK);
  return session;
};

const cars = (session: GameSession): Car[] => [...session.sim.world].filter((e): e is Car => e.vehicle !== undefined);

/** Do two cars' footprints overlap (their rectangles, by the separating axes)? */
const overlap = (a: Car, b: Car): boolean => {
  const axes = [a.yaw, b.yaw].flatMap((y) => [[Math.sin(y), Math.cos(y)], [Math.cos(y), -Math.sin(y)]] as const);
  const reach = (c: Car, [ax, az]: readonly [number, number]) => {
    const [tx, tz] = [Math.sin(c.yaw), Math.cos(c.yaw)];
    return Math.abs(tx * ax + tz * az) * c.vehicle.half.l + Math.abs(tz * ax - tx * az) * c.vehicle.half.w;
  };
  return axes.every((ax) => Math.abs((b.position.x - a.position.x) * ax[0] + (b.position.z - a.position.z) * ax[1]) < reach(a, ax) + reach(b, ax));
};

/** Would Seki on the square see a car at `p`: within 0.6 of the traffic's radius, in her view's cone, not under T0's slab or the terrace over the ramp? */
const inSight = (me: { x: number; z: number; yaw: number }, p: { x: number; z: number }): boolean => {
  const off = Math.atan2(p.x - me.x, p.z - me.z) - me.yaw;
  const under = p1DriveFloor(p.x, p.z) !== null && p.z > P1_RAMP.covered;
  return Math.hypot(p.x - me.x, p.z - me.z) < 260 * 0.6 && Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < 1.2 && !under;
};

describe("the cars in and out of Alchemia's P-1 (ADR-0074 §4, G-491)", () => {
  it("brings one from Bajkowskiego down the ramp into the south cabin and one out of the north cabin up Lubartowska past Olejna, into no other car", () => {
    const session = start();
    const lives = new Map<number, { route: number; first: Car["vehicle"]["s"]; last: number; seen: { x: number; y: number; z: number }[] }>();
    const done: { route: number; first: number; last: number; seen: { x: number; y: number; z: number }[] }[] = [];
    const comesOrGoes: string[] = [];
    const into: string[] = [];
    const offRamp: string[] = [];
    let before = new Map<number, { x: number; z: number }>();
    for (let i = 0; i < 60 * 70; i++) {
      session.step(EMPTY_INPUT);
      const me = session.sim.player()!;
      const all = cars(session);
      const ramp = all.filter((c) => c.vehicle.route === IN || c.vehicle.route === OUT);
      const now = new Map(ramp.map((c) => [c.id, { x: c.position.x, z: c.position.z }]));
      // After the street filled at the teleport: nobody comes or goes in her sight.
      if (i > 30) {
        for (const [id, p] of now) if (!before.has(id) && inSight({ ...me.position, yaw: me.yaw }, p)) comesOrGoes.push(`${i} came at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
        for (const [id, p] of before) if (!now.has(id) && inSight({ ...me.position, yaw: me.yaw }, p)) comesOrGoes.push(`${i} went at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
      }
      for (const [id, life] of lives) {
        if (now.has(id)) continue;
        done.push(life);
        lives.delete(id);
      }
      for (const c of ramp) {
        const life = lives.get(c.id) ?? { route: c.vehicle.route, first: c.vehicle.s, last: c.vehicle.s, seen: [] };
        life.last = c.vehicle.s;
        life.seen.push({ ...c.position });
        lives.set(c.id, life);
        for (const o of all) if (o !== c && overlap(c, o)) into.push(`${i} ${c.id} into ${o.id} at ${c.position.x.toFixed(1)},${c.position.z.toFixed(1)}`);
        const onRamp = c.position.x > P1_RAMP.minX && c.position.x < P1_RAMP.maxX && c.position.z > P1_RAMP.top + 1 && c.position.z < P1_RAMP.foot - 1;
        if (onRamp && Math.abs(c.position.y - p1RampY(c.position.z)) > 0.01) offRamp.push(`${i} ${c.position.z.toFixed(1)}: ${c.position.y.toFixed(2)}`);
      }
      before = now;
    }
    done.push(...lives.values());
    expect(into).toEqual([]);
    expect(offRamp).toEqual([]);
    expect(comesOrGoes).toEqual([]);
    const cabin = (c: (typeof P1_CABINS)[number], p: { x: number; z: number }) => p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ;
    // In: along Bajkowskiego west of the driveway, then all the way into the south cabin.
    const came = done.filter((l) => l.route === IN && l.seen.some((p) => p.z < -12 && p.x < 405) && l.seen.some((p) => cabin(P1_CABINS[0]!, p)));
    expect(came.length).toBeGreaterThan(0);
    // Out: from the north cabin up the ramp, by Olejna northwards.
    const went = done.filter((l) => l.route === OUT && cabin(P1_CABINS[1]!, l.seen[0]!) && l.seen.some((p) => Math.hypot(p.x - OLEJNA.x, p.z - OLEJNA.z) < 3));
    expect(went.length).toBeGreaterThan(0);
  });

  it("stops before Seki on the ramp's east lane, and she never stands inside it (G-492: the traffic's body)", () => {
    const session = start();
    const lane = (P1_RAMP.minX + P1_RAMP.walk) / 2 + 1.6;
    const at = { x: lane, z: P1_RAMP.top + 8 };
    teleport(session, at.x, at.z, Math.PI, 0, p1RampY(at.z));
    let stopped = false;
    const inside: string[] = [];
    for (let i = 0; i < 60 * 40; i++) {
      session.step(EMPTY_INPUT);
      const me = session.sim.player()!.position;
      for (const c of cars(session).filter((v) => v.vehicle.route === IN)) {
        const [tx, tz] = [Math.sin(c.yaw), Math.cos(c.yaw)];
        const [dx, dz] = [me.x - c.position.x, me.z - c.position.z];
        const [fwd, lat] = [dx * tx + dz * tz, dx * tz - dz * tx];
        if (Math.abs(fwd) < c.vehicle.half.l && Math.abs(lat) < c.vehicle.half.w) inside.push(`${i}: ${fwd.toFixed(2)},${lat.toFixed(2)}`);
        if (c.vehicle.v === 0 && fwd > 0 && fwd < c.vehicle.half.l + 3 && Math.abs(lat) < 1) stopped = true;
      }
    }
    expect(inside).toEqual([]);
    expect(stopped).toBe(true);
  });
});
