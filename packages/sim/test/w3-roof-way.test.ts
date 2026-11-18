import { describe, expect, it } from "vitest";
import { type Contract, QUICKHACKS, contractAlarmFlag, contractTag, type Vec3 } from "@seki/core";
import { SIM_HZ, Simulation, W3_CABIN, W3_CORE_BLIND_SPOT, W3_LAYOUT, W3_PIPE_LADDER, W3_PLATFORM, W3_ROOF, W3_ROOF_N, W3_VIRUS_TERMINAL, W3_Y, w3 } from "../src";
import { inZone } from "../src/world/disguise";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

/**
 * G-908: W-3's quiet way over the pipes and row N's roof (ADR-0082 §1 Q2, §2) has the ADR's
 * threats: the roof's two cameras at (2530; 440) and (2556; 440) and the observer in the tower's
 * cabin (`tessen_sniper`, 40 m of sight, no shot before the alarm). Standing in their sight raises
 * the job's alarm; crouched through the observer's look away to the yard, along the hall's wall
 * in the west camera's dead angle and with the east one rebooted, the way stays quiet down the
 * hatch to the upload.
 */

const CAM_W = "dev:w3-roof-cam-w";
const CAM_E = "dev:w3-roof-cam-e";
const observerKey = (c: Contract) => `${c.id}-observer`;
const alarmUp = (sim: Simulation, c: Contract) => sim.domain.flags.includes(contractAlarmFlag(c.id));
const roof = (x: number, z: number): Vec3 => w3(x, W3_ROOF, z);

/** The job taken by the core (its chunk streamed in), the gun away; `keep` says who of the crew stays. */
const job = (keep: (key: string) => boolean = () => true): { sim: Simulation; c: Contract } => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, W3_CORE_BLIND_SPOT);
  sim.step();
  sim.enqueue({ type: "accept-contract", kind: "sabotage" });
  sim.step();
  const c = sim.domain.contracts.active;
  if (c?.kind !== "sabotage") throw new Error("no sabotage");
  for (const e of [...sim.world].filter((g) => g.tag === contractTag(c.id) && !keep(g.key ?? ""))) sim.world.remove(e);
  sim.step(input({ toggleWeapon: true }));
  run(sim, 30);
  return { sim, c };
};

/** Seconds until the job's alarm goes up, standing still (or crouched) for at most `seconds`; null: never. */
const alarmWithin = (sim: Simulation, c: Contract, seconds: number, crouch = false): number | null => {
  for (let i = 0; i < seconds * SIM_HZ; i++) {
    sim.step(input({ crouch }));
    if (alarmUp(sim, c)) return i / SIM_HZ;
  }
  return null;
};

/** Walks (or crouches) to each point in turn, turning towards it; stops early once the alarm is up. */
const walk = (sim: Simulation, c: Contract, points: readonly { x: number; z: number }[], crouch = false): void => {
  for (const goal of points) {
    for (let i = 0; i < 30 * SIM_HZ && !alarmUp(sim, c); i++) {
      const p = sim.player()!;
      const [dx, dz] = [goal.x - p.position.x, goal.z - p.position.z];
      if (Math.hypot(dx, dz) < 0.4) break;
      p.yaw = Math.atan2(dx, dz);
      sim.step(input({ moveZ: 1, crouch }));
    }
  }
};

/** `reboot_optics` (slot 2) on the camera, looking straight at it from where she stands. */
const rebootOptics = (sim: Simulation, camKey: string, crouch: boolean): void => {
  const me = sim.player()!;
  const cam = byKey(sim, camKey)!.position;
  const [dx, dz] = [cam.x - me.position.x, cam.z - me.position.z];
  me.yaw = Math.atan2(dx, dz);
  me.pitch = Math.atan2(me.position.y + (crouch ? 1.14 : 1.62) - cam.y, Math.hypot(dx, dz));
  sim.step(input({ scan: true, quickhack: 2, crouch }));
  run(sim, Math.ceil(QUICKHACKS.reboot_optics.upload * SIM_HZ) + 1, input({ scan: true, crouch }));
};

/**
 * Crouched on the tower's bridge under the cabin's floor till the observer looks away to the yard:
 * his facing turning north past the bridge's end, which bears 1.87 from him, out of his cone (1.05).
 */
const waitForObserver = (sim: Simulation, c: Contract): void => {
  const o = byKey(sim, observerKey(c))!;
  for (let i = 0, prev = Infinity; i < 20 * SIM_HZ; i++) {
    sim.step(input({ crouch: true }));
    if (o.yaw < 0.82 && o.yaw < prev) return;
    prev = o.yaw;
  }
  throw new Error("the observer never looked away");
};

/** The bridge's end on row N's roof, out of the observer's sight under the cabin's floor. */
const BRIDGE_END = { x: 2500.3, z: 438.65 };
/** Along the hall's wall: in the west camera's dead angle, and past 20 m of the observer once at its east end. */
const WALL_STRIP = [{ x: 2512, z: 431 }, { x: 2550, z: 431 }];
/** On the strip by the hall's wall, 33 m off the cabin, where the observer's look falls after he turns. */
const STOP_IN_VIEW = { x: 2531, z: 431 };
/** Behind the east camera, west of it, north of the hall's wall: where she reboots it from. */
const BEHIND_EAST = { x: 2550, z: 437.5 };
/** The hatch's ladder top, by the hatch's curb. */
const HATCH_TOP = { x: 2564, z: 437.8 };

describe("W-3's pipes and roof way: the roof's cameras and the cabin's observer (ADR-0082 §1 Q2, §2, G-908)", () => {
  it("puts the ADR's two cameras on row N's parapet, watching the roof during the sabotage, and the observer in the cabin, on its floor", () => {
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, roof(2522, 436));
    run(sim, 2 * SIM_HZ);
    // Out of the job the roof is no one's no-go zone.
    for (const key of [CAM_W, CAM_E]) {
      const cam = byKey(sim, key)!;
      expect(cam.device?.restricted?.during, key).toBe("sabotage");
      expect(cam.device?.spot, key).toBe(0);
    }
    expect([byKey(sim, CAM_W)!.position, byKey(sim, CAM_E)!.position]).toEqual([w3(2530, 11.5, 440), w3(2556, 11.5, 440)]);
    const { sim: s, c } = job();
    run(s, 2 * SIM_HZ);
    const o = byKey(s, observerKey(c))!;
    expect(o.enemy?.type).toBe("tessen_sniper");
    expect(o.ai?.aggroRange).toBe(40);
    expect(o.tag).toBe(contractTag(c.id));
    expect(o.position.y).toBeCloseTo(W3_Y + W3_CABIN.floor, 3);
    expect(o.position.x).toBeGreaterThan(W3_CABIN.minX);
    expect(o.position.x).toBeLessThan(W3_CABIN.maxX);
  });

  it("gives the roof cameras a no-go zone of the roof alone, not corridor N, the mezzanine or server room N under it", () => {
    expect(inZone(W3_ROOF_N, roof(2540, 434))).toBe(true);
    for (const p of [w3(2540, 0, 431), w3(2540, W3_LAYOUT.MEZZANINE, 434), w3(2566, 0, 437)]) expect(inZone(W3_ROOF_N, p), `${p.x},${p.y},${p.z}`).toBe(false);
  });

  it("a save of the running job from before the observer (v44) loads with him at his post in the cabin", () => {
    const { sim, c } = job();
    run(sim, 2 * SIM_HZ);
    const saved = JSON.parse(JSON.stringify(sim.snapshot(null, "mid", ""))) as ReturnType<Simulation["snapshot"]>;
    expect(saved.entities.some((e) => e.key === observerKey(c))).toBe(true);
    // Without his entry, as a save made before him: the job's templates bring him in fresh at his post.
    const restored = Simulation.fromSnapshot({ ...saved, entities: saved.entities.filter((e) => e.key !== observerKey(c)) });
    run(restored, 2 * SIM_HZ);
    const o = byKey(restored, observerKey(c))!;
    expect(o.ai?.alerted).toBe(false);
    expect(o.position.y).toBeCloseTo(W3_Y + W3_CABIN.floor, 3);
  });

  it.each([
    ["the west one, along the cooling units' south side", CAM_W, roof(2522, 436)],
    ["the east one, at the hatch", CAM_E, roof(HATCH_TOP.x, HATCH_TOP.z)],
  ] as const)("standing in a roof camera's view raises the job's alarm: %s", (_name, key, at) => {
    const { sim, c } = job(() => false);
    teleportPlayer(sim, at, 0);
    expect(alarmWithin(sim, c, 3)).not.toBeNull();
    expect(byKey(sim, key)!.device?.spot).toBe(1);
  });

  it("the observer sees her standing on the roof 37 m off and raises the alarm without a shot; crouched there he does not", () => {
    for (const crouch of [false, true]) {
      const { sim, c } = job((k) => k.endsWith("-observer"));
      const o = byKey(sim, observerKey(c))!;
      const shots = collect<{ shooterId: number }>(sim, "ShotFired");
      // In the west camera's dead angle by the hall's wall: only the observer can see her here.
      teleportPlayer(sim, roof(2530, 431), 0);
      const at = alarmWithin(sim, c, 16, crouch);
      if (crouch) {
        expect(at).toBeNull();
        continue;
      }
      expect(at).not.toBeNull();
      expect(o.ai?.alerted).toBe(true);
      expect(shots.filter((s) => s.shooterId === o.id)).toEqual([]);
    }
  });

  it.each([
    ["crouched past the observer, along the hall's wall, the east camera rebooted: quiet", { stand: false, wall: true, reboot: true }, null],
    ["standing up past the observer, stopping in his view: he sees her", { stand: true, wall: true, reboot: true }, "observer"],
    ["along the cooling units: the west camera sees her", { stand: false, wall: false, reboot: true }, CAM_W],
    ["down the hatch without rebooting the east camera: it sees her", { stand: false, wall: true, reboot: false }, CAM_E],
  ] as const)("from the pipes' ladder over the roof to the hatch, %s", (_name, way, seenBy) => {
    const { sim, c } = job();
    // Who had seen her when the alarm went up: the observer alerted, a camera's spot full.
    const seen: string[] = [];
    sim.bus.on("ContractAlarm", () => {
      if (byKey(sim, observerKey(c))?.ai?.alerted) seen.push("observer");
      for (const k of [CAM_W, CAM_E]) if (byKey(sim, k)?.device?.spot === 1) seen.push(k);
    });
    // Up the ladder from the riverside path, along the pipe walk and round the tower's shaft on its platform.
    teleportPlayer(sim, w3(W3_PIPE_LADDER.x, W3_PLATFORM, 439.8), 0);
    walk(sim, c, [{ x: 2446, z: 442.55 }, { x: 2484.5, z: 442.55 }, { x: 2487.2, z: 442.55 }, { x: 2487.2, z: 437.1 }, { x: 2495, z: 437.1 }, { x: 2495, z: 438.65 }, BRIDGE_END]);
    expect(alarmUp(sim, c)).toBe(false);
    waitForObserver(sim, c);
    // Past the observer by the hall's wall, then on by the wall or up along the cooling units' south side.
    // Standing, she stops a few seconds where his look falls (the meter fills gradually, ADR-0069 of 18.11: a glance
    // from 33 m as she walks on leaves him only wondering).
    if (way.stand) {
      walk(sim, c, [WALL_STRIP[0]!, STOP_IN_VIEW]);
      alarmWithin(sim, c, 8);
    }
    walk(sim, c, way.wall ? WALL_STRIP : [WALL_STRIP[0]!, { x: 2522, z: 436 }, { x: 2550, z: 436 }], !way.stand);
    walk(sim, c, [BEHIND_EAST], true);
    if (way.reboot && !alarmUp(sim, c)) {
      rebootOptics(sim, CAM_E, true);
      expect(byKey(sim, CAM_E)?.hackFx?.blind ?? 0).toBeGreaterThan(0);
    }
    walk(sim, c, [{ x: 2560, z: 436 }, HATCH_TOP]);
    if (seenBy) {
      // Seen on the roof, by the hatch at the latest.
      if (!alarmUp(sim, c)) expect(alarmWithin(sim, c, 2)).not.toBeNull();
      expect(seen).toEqual([seenBy]);
      return;
    }
    expect(alarmUp(sim, c)).toBe(false);
    // He never so much as wondered, nor did a camera.
    expect(byKey(sim, observerKey(c))?.ai).toMatchObject({ alerted: false, suspicion: 0 });
    expect([CAM_W, CAM_E].map((k) => byKey(sim, k)?.device?.spot)).toEqual([0, 0]);
    // Down the hatch's ladder into server room N, to the camera's dead angle by the core: the upload.
    const ladder = [...sim.world.with("ladder")].find((e) => e.ladder.key === "w3-hatch")!.ladder;
    sim.player()!.yaw = ladder.yaw + Math.PI;
    sim.step(input({ interact: true }));
    for (let i = 0; i < 20 * SIM_HZ && (i < 5 || sim.player()!.climb); i++) sim.step(input({ moveZ: -1 }));
    expect(sim.player()!.position.y).toBeCloseTo(W3_Y, 1);
    walk(sim, c, [W3_CORE_BLIND_SPOT]);
    sim.player()!.yaw = Math.atan2(W3_VIRUS_TERMINAL.x - W3_CORE_BLIND_SPOT.x, W3_VIRUS_TERMINAL.z - W3_CORE_BLIND_SPOT.z);
    sim.step(input({ interact: true }));
    expect(sim.domain.contracts.active).toMatchObject({ route: "quiet" });
    // The upload runs on in the dead angle (its whole 40 s and the way out: w3-sabotage.test.ts).
    run(sim, 5 * SIM_HZ);
    expect(sim.domain.contracts.active?.progress).toBeGreaterThanOrEqual(5 * SIM_HZ);
    expect(sim.domain.contracts.active?.away).toBeUndefined();
    expect(alarmUp(sim, c)).toBe(false);
  });
});
