import { describe, expect, it } from "vitest";
import { type AudioPort, EMPTY_INPUT } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { P1, P1_CABINS, P1_RAMP, TRAFFIC_ROUTES, VIEW_HALF_ANGLE, type Entity, eyeOf, lineOfSight, p1RampY } from "@seki/sim";
import { FakeRender, teleport } from "./story-helpers";
import { GameSession } from "../src/game-session";

/**
 * The cars of Alchemia's P-1 in the street's traffic (ADR-0074 §4, G-491, G-510), headless: seen
 * from T0's square by the ramp's trench, one comes along Bajkowskiego, turns onto the driveway and
 * down the ramp into the south hand-over cabin, another comes out of the north cabin, up the ramp
 * and away along Bajkowskiego, onto its right lane and south down Lubartowska past the deptak's
 * mouth (T-324); on the ramp's surface, never into another car, and neither comes or goes where
 * Seki on the square would see it. Since C7 (20.11) two cars a route, as the board's busy ramp: both
 * of each route's cars drive the ramp. A car out of sight comes back where its timetable is (the
 * traffic's rule), so one out of P-1 may turn up anywhere under the deck, not only in its cabin.
 */

const audio: AudioPort = { play() {}, stopAll() {} };
const IN = TRAFFIC_ROUTES.length - 2;
const OUT = TRAFFIC_ROUTES.length - 1;
/** Lubartowska (w40050981) south of Bajkowskiego, the cars' way since the deptak north of it (T-324). */
const SOUTH = { x: 440.5, z: -40 };
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

/**
 * Would Seki on the square see a car at `p`: within 0.6 of the traffic's radius, in her view's cone
 * and nothing solid between her eye and it (the traffic's own rule, `inPlayerView`).
 */
const inSight = (session: GameSession, p: { x: number; y: number; z: number }): boolean => {
  const me = session.sim.player()!;
  const off = Math.atan2(p.x - me.position.x, p.z - me.position.z) - me.yaw;
  if (Math.hypot(p.x - me.position.x, p.z - me.position.z) >= 260 * 0.6 || Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > VIEW_HALF_ANGLE) return false;
  return lineOfSight(session.sim.world, eyeOf(me), { x: p.x, y: p.y + 1.25, z: p.z });
};

describe("the cars in and out of Alchemia's P-1 (ADR-0074 §4, G-491)", () => {
  it("brings one from Bajkowskiego down the ramp into the south cabin and one out of the north cabin south down Lubartowska, into no other car", () => {
    const session = start();
    const lives = new Map<number, { route: number; first: Car["vehicle"]["s"]; last: number; seen: { x: number; y: number; z: number }[] }>();
    const done: { route: number; first: number; last: number; seen: { x: number; y: number; z: number }[] }[] = [];
    const comesOrGoes: string[] = [];
    const into: string[] = [];
    const offRamp: string[] = [];
    let before = new Map<number, { x: number; y: number; z: number }>();
    /** Each route's cars seen on the ramp (in, out). */
    const rampIds = [new Set<number>(), new Set<number>()] as const;
    for (let i = 0; i < 60 * 70; i++) {
      session.step(EMPTY_INPUT);
      const all = cars(session);
      const ramp = all.filter((c) => c.vehicle.route === IN || c.vehicle.route === OUT);
      const now = new Map(ramp.map((c) => [c.id, { ...c.position }]));
      // After the street filled at the teleport: nobody comes or goes in her sight.
      if (i > 30) {
        for (const [id, p] of now) if (!before.has(id) && inSight(session, p)) comesOrGoes.push(`${i} came at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
        for (const [id, p] of before) if (!now.has(id) && inSight(session, p)) comesOrGoes.push(`${i} went at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
      }
      for (const [id, life] of lives) {
        if (now.has(id)) continue;
        done.push(life);
        lives.delete(id);
      }
      for (const c of ramp) {
        if (c.position.x > P1_RAMP.minX && c.position.x < P1_RAMP.maxX && c.position.z > P1_RAMP.top && c.position.z < P1_RAMP.foot) rampIds[c.vehicle.route === IN ? 0 : 1].add(c.id);
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
    // Out: from under the deck (its north cabin, P-1's floor or the ramp's covered part, out of the street's sight) up the
    // ramp, south down Lubartowska and never onto the deptak north of Bajkowskiego.
    const underDeck = (p: { x: number; z: number }) =>
      cabin(P1_CABINS[1]!, p) || (p.x > P1.minX && p.x < P1.maxX && p.z > P1_RAMP.covered && p.z < P1.maxZ && p.x < P1_RAMP.maxX);
    const went = done.filter((l) => l.route === OUT && underDeck(l.seen[0]!) && l.seen.some((p) => Math.hypot(p.x - SOUTH.x, p.z - SOUTH.z) < 3));
    expect(done.filter((l) => l.route === OUT).flatMap((l) => l.seen.filter((p) => p.x > 434 && p.z > -14))).toEqual([]);
    expect(went.length).toBeGreaterThan(0);
    // Two cars a route (C7): both of each drive the ramp.
    expect([TRAFFIC_ROUTES[IN]!.vehicles, TRAFFIC_ROUTES[OUT]!.vehicles]).toEqual([2, 2]);
    expect(rampIds.map((s) => s.size)).toEqual([2, 2]);
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
