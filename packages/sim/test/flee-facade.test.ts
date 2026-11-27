import { describe, expect, it } from "vitest";
import { FLEE_RADIUS, Simulation } from "../src";
import { passerbyOnDeptak, run, setWalkerDown, teleportPlayer } from "./helpers";

/**
 * An escape into a facade at a slant to the threat (G-980). On Krakowskie Przedmieście by
 * (275.4; −123.9) the facade runs north-east, and a walker running west from the player 2 m east
 * of it took the turn into the facade first (`FLEE_TURNS`' order), ran into it, swung across to
 * the turn along it (1.56 rad) and back to the north (2.35 rad): 5 jumps of its heading in 5 s.
 * Pinned to the place, not to a walker's number: whichever walker it is, it is set down there on
 * the crowd's route past it. The same walker 0.39 m off, at that route's own point, still swings (G-981).
 */
const hostileCrowd = (seed: number): Simulation => {
  const snap = Simulation.create({ seed, crowd: "high" }).snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, civilians: -60 } } }, undefined, "high");
};
const byId = (sim: Simulation, id: number) => [...sim.world].find((e) => e.id === id)!;
/** A turn of the heading between two steps this sharp (radians) is a jump, as `flee-wall.test.ts` reads it. */
const JUMP = 0.4;
const AT = { x: 275.4, z: -123.9 };
/** The crowd's route past the facade there, walked north-north-east (where E3's tables deal walker 1002005 of seed 17 out). */
const WALK = { speed: 1.25, heading: 0.22 };

const escape = (seed: number) => {
  const sim = hostileCrowd(seed);
  const walker = passerbyOnDeptak(sim, 2);
  setWalkerDown(sim, walker, AT.x, AT.z, WALK);
  teleportPlayer(sim, { x: AT.x + 2, y: walker.position.y, z: AT.z });
  let [jumps, last] = [0, null as number | null];
  for (let i = 0; i < 300; i++) {
    run(sim, 1);
    const w = byId(sim, walker.id);
    if (Math.hypot(w.velocity!.x, w.velocity!.z) < 0.05) continue;
    if (last !== null && Math.abs(Math.atan2(Math.sin(w.yaw - last), Math.cos(w.yaw - last))) > JUMP) jumps++;
    last = w.yaw;
  }
  const w = byId(sim, walker.id);
  return { jumps, distance: Math.hypot(w.position.x - AT.x - 2, w.position.z - AT.z) };
};

describe("an escape into a facade at a slant (G-980)", () => {
  it.each([3, 17, 29])("runs along it instead of swinging from side to side (seed %i)", (seed) => {
    const r = escape(seed);
    expect(r.jumps, JSON.stringify(r)).toBeLessThanOrEqual(2);
    expect(r.distance).toBeGreaterThanOrEqual(FLEE_RADIUS);
  });
});
