import { describe, expect, it } from "vitest";
import { type DomainEvents, EMPTY_INPUT, type SaveSnapshot, type Vec3 } from "@seki/core";
import { FLIGHT_HEADROOM, METRO_CUTS, METRO_PLATFORMS, SIM_HZ, Simulation, groundY, heightApart, interiorAt, metroStation } from "../src";
import { inBuilding } from "../src/content/lublin/places";
import { PADS } from "../src/content/lublin/sites";
import { TRASA_PODZIEMNA_BOUNDS } from "../src/content/kanal-underground";
import { spotFrame } from "../src/content/metro-pavilion";
import { rayGeometry } from "../src/world/hitscan";
import { LEVEL_GAP } from "../src/world/nav";
import { collect, input, run, teleportPlayer } from "./helpers";

/**
 * The metro's platforms (ADR-0071 stage 4): down a second flight from the hall of each entrance
 * A, under the street. The walks are the player's own (sprinting, turning towards each point).
 */

type Platformed = (typeof METRO_PLATFORMS)[number];
const PLATFORMS = METRO_PLATFORMS.map((e) => [`${e.station} ${e.label}`, e] as const);

const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** A point of the entrance's frame (u inwards from the opening, w across) at height y. */
const at = (e: Platformed, u: number, w: number, y: number): Vec3 => ({ ...spotFrame(e.spot).point(u, w), y });

/** Sprints to (x, z), turning towards it every step; the distance left when it stopped. */
const walkTo = (sim: Simulation, p: { x: number; z: number }, seconds = 8): number => {
  for (let i = 0; i < seconds * SIM_HZ; i++) {
    const q = sim.player()!.position;
    if (flat(p, q) < 0.4) break;
    const want = Math.atan2(p.x - q.x, p.z - q.z);
    const yaw = sim.player()!.yaw;
    sim.step({ ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) });
  }
  return flat(p, sim.player()!.position);
};

/** A new game with the AI of the street taken out, so nobody walks into the way. */
const quiet = (): Simulation => {
  const sim = Simulation.create({ seed: 3 });
  run(sim, 1);
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

describe("metro platforms (ADR-0071 stage 4)", () => {
  it("are under every station's entrance A, 8 m under its opening, and each station's riders get off there", () => {
    expect(PLATFORMS.map(([name]) => name)).toEqual(["shinsekai A", "kanal A", "targ A", "doki A"]);
    for (const e of METRO_PLATFORMS) {
      expect(e.platform.floor).toBeCloseTo(e.street - 8, 6);
      expect(metroStation(e.station).arrival).toEqual(e.platform.arrival);
      expect(interiorAt(e.platform.arrival)?.id).toBe(`metro-${e.station}`);
      expect(interiorAt(e.hallSpot)).toBeNull();
    }
  });

  it.each(PLATFORMS)("%s: from the car's door up both flights onto the street", (_name, e) => {
    const sim = quiet();
    const seen: string[] = [];
    sim.bus.on("InteriorLeft", (ev: DomainEvents["InteriorLeft"]) => seen.push(`out:${ev.interiorId}`));
    teleportPlayer(sim, e.arrival, e.arrivalYaw);
    run(sim, 2);
    const p = e.platform;
    expect(Math.abs(sim.player()!.position.y - p.floor)).toBeLessThan(0.05);
    const route = [at(e, p.u.back + 1, 0, p.floor), at(e, p.u.stepsTop - 0.6, 0, p.hall), e.hallSpot, e.door];
    for (const q of route) {
      const left = walkTo(sim, q);
      const y = sim.player()!.position.y;
      expect(left, `to ${q.x.toFixed(1)},${q.z.toFixed(1)} from ${sim.player()!.position.x.toFixed(1)},${y.toFixed(2)},${sim.player()!.position.z.toFixed(1)}`).toBeLessThan(0.6);
      expect(Math.abs(y - q.y), `height at ${q.x.toFixed(1)},${q.z.toFixed(1)}`).toBeLessThan(0.35);
    }
    expect(seen.filter((s) => s.includes("metro"))).toEqual([`out:metro-${e.station}`]);
  });

  it.each(PLATFORMS)("%s: down from the street to the ticket machine, which opens the line map", (_name, e) => {
    const sim = quiet();
    const entered = collect<DomainEvents["InteriorEntered"]>(sim, "InteriorEntered");
    const started = collect<{ kind: string; station?: string }>(sim, "InteractionStarted");
    teleportPlayer(sim, e.door, e.hallYaw + Math.PI);
    run(sim, 2);
    const p = e.platform;
    for (const q of [e.hallSpot, at(e, p.u.wallEnd + 0.2, 0, p.hall), at(e, p.u.back + 0.8, 0, p.floor), e.ticket]) expect(walkTo(sim, q)).toBeLessThan(0.6);
    expect(Math.abs(sim.player()!.position.y - p.floor)).toBeLessThan(0.05);
    expect(entered.map((x) => x.interiorId)).toEqual([`metro-${e.station}`]);
    teleportPlayer(sim, e.ticket, e.ticketYaw);
    run(sim, 2);
    sim.step(input({ interact: true }));
    expect(started).toEqual([expect.objectContaining({ kind: "metro", station: e.station })]);
  });

  it.each(PLATFORMS)("%s: the screen doors, the car and the walls keep feet on the platform", (_name, e) => {
    const sim = quiet();
    const p = e.platform;
    const mid = (p.w0 + p.w1) / 2;
    const towards = (from: Vec3, to: Vec3, seconds = 3): Vec3 => {
      teleportPlayer(sim, from, Math.atan2(to.x - from.x, to.z - from.z));
      run(sim, 2);
      run(sim, seconds * SIM_HZ, input({ moveZ: 1 }));
      return sim.player()!.position;
    };
    const mouth = at(e, 0, 0, 0);
    const u = (q: Vec3): number => e.spot.opens * (e.spot.along === "x" ? mouth.x - q.x : mouth.z - q.z);
    // Into a screen between the doors, into a door's opening (the car stands behind it), along to an end.
    for (const w of [mid, ...p.doors]) {
      const stop = towards(at(e, p.u.back + 2, w, p.floor), at(e, p.u.track, w, p.floor));
      expect(u(stop), `${w}`).toBeLessThan(p.u.edge + 0.1);
      expect(Math.abs(stop.y - p.floor)).toBeLessThan(0.05);
    }
    const end = towards(at(e, p.u.back + 2, mid, p.floor), at(e, p.u.back + 2, p.w1 + 10, p.floor), 5);
    expect(flat(end, at(e, p.u.back + 2, p.w1, p.floor))).toBeLessThan(0.6);
    expect(Math.abs(end.y - p.floor)).toBeLessThan(0.05);
  });

  it.each(PLATFORMS)("%s: the street over it stays the street, and the camera's ray on it meets walls, not the earth", (_name, e) => {
    const sim = quiet();
    const p = e.platform;
    const over = at(e, (p.u.back + p.u.edge) / 2, (p.w0 + p.w1) / 2 + 3, 0);
    teleportPlayer(sim, { ...over, y: groundY(over.x, over.z) + 0.5 });
    run(sim, SIM_HZ);
    expect(Math.abs(sim.player()!.position.y - groundY(over.x, over.z))).toBeLessThan(0.1);
    // From a shoulder on the platform along it: the end wall, metres off.
    const eye = at(e, p.u.back + 2, (p.w0 + p.w1) / 2, p.floor + 1.6);
    const along = at(e, p.u.back + 2, p.w1 + 1, p.floor + 1.6);
    const d = Math.hypot(along.x - eye.x, along.z - eye.z);
    const t = rayGeometry(sim.world, eye, { x: (along.x - eye.x) / d, y: 0, z: (along.z - eye.z) / d }, 40, true);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThan((p.w1 - p.w0) / 2 - 0.5);
  });

  it.each(PLATFORMS)("%s: the platform is a floor of its own, apart from the hall and the street", (_name, e) => {
    const sim = quiet();
    const p = e.platform;
    // From the platform's floor, not the vault's under it: 5.3 m under the hall, 8 m under the street.
    expect(heightApart(sim.world, e.ticket, e.hallSpot)).toBeCloseTo(p.hall - p.floor, 2);
    expect(heightApart(sim.world, e.ticket, e.door)).toBeGreaterThan(7.5);
    expect(heightApart(sim.world, e.ticket, e.hallSpot)).toBeGreaterThan(LEVEL_GAP);
    expect(heightApart(sim.world, e.ticket, e.arrival)).toBeLessThan(0.01);
  });

  it.each(PLATFORMS)("%s: a game saved on the platform loads on it", (_name, e) => {
    const sim = quiet();
    teleportPlayer(sim, e.ticket, e.ticketYaw);
    run(sim, 2);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "platform", "")));
    run(loaded, SIM_HZ);
    const q = loaded.player()!.position;
    expect(flat(q, e.ticket)).toBeLessThan(0.1);
    expect(Math.abs(q.y - e.platform.floor)).toBeLessThan(0.05);
    expect(loaded.session.interior).toBe(`metro-${e.station}`);
  });
});

describe("metro platforms in the map (ADR-0071 stage 4)", () => {
  it.each(PLATFORMS)("%s: the passage's ceiling stays under the street and leaves headroom over the stairs", (_name, e) => {
    const p = e.platform;
    const half = 1.5;
    for (const c of p.ceiling) {
      for (let u = c.u0; u <= c.u1 + 1e-9; u += 0.25) {
        for (let w = -half; w <= half + 1e-9; w += 0.25) {
          const q = at(e, u, w, 0);
          expect(groundY(q.x, q.z) - p.top, `${u},${w}`).toBeGreaterThanOrEqual(0.04);
        }
      }
      const stairs = p.hall - ((p.hall - p.floor) * Math.max(0, c.u0 - p.u.stepsTop)) / (p.u.back - p.u.stepsTop);
      expect(c.bottom - stairs).toBeGreaterThanOrEqual(FLIGHT_HEADROOM);
    }
    expect(p.doorwayHead).toBeGreaterThanOrEqual(FLIGHT_HEADROOM);
  });

  it.each(PLATFORMS)("%s: lies off the map's buildings, the cellars, the dug ground and the other platforms", (_name, e) => {
    const p = e.platform;
    // Where people walk (its rooms) is under no building of the map.
    for (const r of p.rooms) {
      for (let x = r.minX; x <= r.maxX; x += 0.5) for (let z = r.minZ; z <= r.maxZ; z += 0.5) expect(inBuilding(x, z), `${x},${z}`).toBe(false);
    }
    type R = { minX: number; maxX: number; minZ: number; maxZ: number };
    const meets = (r: R) => p.vaults.some(({ bounds: b }) => r.minX < b.maxX && r.maxX > b.minX && r.minZ < b.maxZ && r.maxZ > b.minZ);
    expect(meets(TRASA_PODZIEMNA_BOUNDS)).toBe(false);
    // The terrain dug down (the docks' basin, Trasa Podziemna's pad); the level pads over it are the street.
    for (const pad of PADS) if (pad.y < e.street - 1) expect(meets(pad.rect)).toBe(false);
    for (const c of METRO_CUTS) if (c !== e.cut) expect(meets(c.bounds)).toBe(false);
    for (const o of METRO_PLATFORMS) if (o !== e) for (const v of o.platform.vaults) expect(meets(v.bounds)).toBe(false);
  });

  it.each(PLATFORMS)("%s: its vaults start at the hall's end wall, off the shaft, and hug the passage", (_name, e) => {
    const [passage, deck] = e.platform.vaults;
    const c = e.cut.bounds;
    // The shaft and the passage's vault share the end wall's inner face, and no more.
    const overlap = Math.min(c.maxX, passage!.bounds.maxX) - Math.max(c.minX, passage!.bounds.minX);
    const overlapZ = Math.min(c.maxZ, passage!.bounds.maxZ) - Math.max(c.minZ, passage!.bounds.minZ);
    expect(Math.min(overlap, overlapZ)).toBeLessThanOrEqual(1e-9);
    const across = e.spot.along === "x" ? passage!.bounds.maxZ - passage!.bounds.minZ : passage!.bounds.maxX - passage!.bounds.minX;
    expect(across).toBeCloseTo(3, 6);
    expect(deck!.floor).toBeLessThan(e.platform.floor - 1.1);
  });
});
