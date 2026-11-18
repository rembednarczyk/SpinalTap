import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { type CharacterRig, animateRig, buildHeroine, raiseWeapon, setWeaponDrawn, startReload } from "../src/renderer/characters";
import { REACH_PORT, type ReloadMotion, beginReload, reloadDown, reloadReach, tickReload } from "../src/renderer/reload-motion";

/*
 * The shotgun loads a round at a time: one 0.5 s reload step after another (`per-round`). Each
 * step played as a whole magazine reload, so the gun went down and came back up six times in
 * three seconds and the left hand went from the fore-end to the hip and back for every shell.
 * Loading rounds, the gun stays down for the run and the hand goes port → pouch → port.
 */

const DT = 1 / 60;
const ROUND = 0.5;
const ROUNDS = 6;

/** Runs a reload of `rounds` steps as the simulation sends them (each the moment the last ends), and `after` seconds past it. */
const run = (frame: (t: number) => void, start: (perRound: boolean) => void, rounds: number, perRound: boolean, after = 0.5): void => {
  let next = 0;
  let left = rounds;
  for (let t = 0; t < rounds * ROUND + after; t += DT) {
    if (left > 0 && t >= next - 1e-9) {
      start(perRound);
      next += ROUND;
      left--;
    }
    frame(t);
  }
};

const motion = (): ReloadMotion => ({ reload: 0, reloadTotal: 0, reloadRound: false, reloadHold: 0 });

describe("reloading a round at a time (the shotgun)", () => {
  it("keeps the weapon down for the whole run of rounds and brings it up after the last", () => {
    const m = motion();
    let lowest = 1;
    let after = 1;
    run(
      (t) => {
        tickReload(m, DT);
        if (t > 0.25 && t < ROUNDS * ROUND) lowest = Math.min(lowest, reloadDown(m));
        if (t > ROUNDS * ROUND + 0.25) after = Math.min(after, 1 - reloadDown(m));
      },
      (perRound) => beginReload(m, ROUND, perRound),
      ROUNDS,
      true,
    );
    expect(lowest, "down between rounds").toBeGreaterThan(0.95);
    expect(after, "up again after the last round").toBe(1);
  });

  it("takes the left hand from the port to the pouch and back for each round, not to the fore-end", () => {
    const m = motion();
    const pouch = Array.from({ length: ROUNDS }, () => 0);
    let lowest = 1;
    run(
      (t) => {
        tickReload(m, DT);
        const reach = reloadReach(m);
        const round = Math.floor(t / ROUND);
        if (round < ROUNDS) pouch[round] = Math.max(pouch[round]!, reach);
        if (t > 0.25 && t < ROUNDS * ROUND) lowest = Math.min(lowest, reach);
      },
      (perRound) => beginReload(m, ROUND, perRound),
      ROUNDS,
      true,
    );
    for (const [i, r] of pouch.entries()) expect(r, `round ${i + 1}: to the pouch`).toBeGreaterThan(0.95);
    expect(lowest, "never back to the fore-end mid-run").toBeGreaterThan(REACH_PORT - 0.05);
  });

  it("leaves a magazine reload as it was: one dip over its length", () => {
    const m = motion();
    const seen: number[] = [];
    beginReload(m, 1.5);
    for (let t = 0; t < 1.6; t += DT) {
      tickReload(m, DT);
      seen.push(reloadDown(m));
    }
    expect(Math.max(...seen)).toBeGreaterThan(0.99);
    expect(seen.at(-1)).toBe(0);
    expect(seen.reduce((n, d, i) => n + (i > 0 && d > 0.5 && seen[i - 1]! <= 0.5 ? 1 : 0), 0), "dips").toBe(1);
  });
});

describe("the figure reloading a shotgun", () => {
  const scene = new Scene(new NullEngine());
  const rig = (): CharacterRig => {
    const r = buildHeroine(scene, new ToonMaterials(scene), "seki");
    setWeaponDrawn(r, true);
    r.drawn = 1;
    return r;
  };

  it("holds the weapon at the chest through the rounds instead of bobbing it up for each", () => {
    const r = rig();
    let lo = Infinity;
    let hi = -Infinity;
    run(
      (t) => {
        animateRig(r, 0, DT, 0, { aim: 1 });
        if (t > 0.3 && t < ROUNDS * ROUND) {
          lo = Math.min(lo, r.elbowR.rotation.x);
          hi = Math.max(hi, r.elbowR.rotation.x);
        }
      },
      (perRound) => startReload(r, ROUND, perRound),
      ROUNDS,
      true,
    );
    // Before: the right elbow swung between the aim and the chest every 0.5 s, by more than a radian.
    expect(hi - lo, "right elbow swing over the run").toBeLessThan(0.1);
    expect(r.aim, "aiming again once loaded").toBeGreaterThan(0.5);
  });

  it("brings the weapon up at once when she fires mid-reload", () => {
    const r = rig();
    for (let i = 0; i < 15; i++) {
      if (i === 0) startReload(r, ROUND, true);
      animateRig(r, 0, DT, 0, {});
    }
    raiseWeapon(r);
    for (let i = 0; i < 15; i++) animateRig(r, 0, DT, 0, {});
    expect(r.reload).toBe(0);
    expect(r.reloadHold).toBe(0);
  });
});
