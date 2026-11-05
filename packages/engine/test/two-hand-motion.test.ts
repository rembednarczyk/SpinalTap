import { beforeAll, describe, expect, it } from "vitest";
import { Matrix, Vector3 } from "../src/babylon";
import { type RigMotion, animateRig, setWeaponDrawn, startReload } from "../src/renderer/characters";
import { gunShape, insideGun, onGun, skinnedBody } from "./body-geometry";
import { BODY, type Cast, LONG, type Long, POINTS, arm, cast, heldGun, palmOf, pose } from "./two-hand-cast";
import { worldOf } from "./t-pose";

/** One frame at 60 fps: the rig, the model over it and the weapons where they are. */
const frame = (c: Cast, speed: number, aim: number, motion: RigMotion = {}): void => {
  animateRig(c.rig, speed, 1 / 60, 0, { aim }, motion);
  c.models.update(1 / 60, c.rig.time);
  c.loadouts.update(c.rig);
};

/** The gun in the hands this frame: each palm's distance to its place, and the body vertices inside it (if `body`). */
const onHands = (c: Cast, kind: Long, body = false): { l: number; r: number; inside: string[] } | null => {
  const mesh = heldGun(c, kind);
  if (!mesh) return null;
  const gun = gunShape(mesh);
  const inverse = Matrix.Invert(gun.world);
  return {
    l: Vector3.Distance(palmOf(c, "L"), onGun(gun, ...POINTS[kind].fore)),
    r: Vector3.Distance(palmOf(c, "R"), onGun(gun, ...POINTS[kind].grip)),
    inside: body
      ? skinnedBody(c.meshes!, /body|face/i, BODY)
          .filter((v) => insideGun(gun, v.at, inverse, 0.004))
          .map((v) => {
            const q = Vector3.TransformCoordinates(v.at, inverse);
            return `${v.bone}@${q.x.toFixed(2)},${q.y.toFixed(2)},${q.z.toFixed(2)}`;
          })
      : [],
  };
};

/** The long gun slung across the back is showing. */
const slung = (c: Cast, kind: Long): boolean => c.scene.meshes.some((m) => m.isEnabled() && m.getTotalVertices() > 0 && m.name.includes(`-back-${kind}-`));

describe.each([["heroine"], ["ganger"]] as const)("a long gun through the moves (G-282): %s", (who) => {
  let c: Cast;
  beforeAll(async () => {
    c = await cast(who);
  }, 60_000);

  it.each(LONG)("%s: on a ladder and over a ledge it goes on the back, and comes back to both hands", async (kind) => {
    await arm(c, kind);
    pose(c, 0);
    for (const motion of [{ climb: 1 }, { climb: 1.5 }]) {
      for (let i = 0; i < 60; i++) {
        frame(c, 0.5, 0, motion);
        const held = onHands(c, kind, i % 10 === 0);
        // Before: the climbing arms let go and the gun hung in the air, 0.7-0.9 m from the hands.
        if (held) {
          expect(Math.max(held.l, held.r), `climb frame ${i}: palms off the gun`).toBeLessThan(0.08);
          expect(held.inside, `climb frame ${i}: body inside the gun`).toEqual([]);
        }
      }
      expect(heldGun(c, kind), "no gun in the hands on the ladder").toBeUndefined();
      expect(slung(c, kind), "the gun on the back").toBe(true);
    }
    for (let i = 0; i < 60; i++) frame(c, 0, 0);
    const back = onHands(c, kind)!;
    expect(back, "back in the hands off the ladder").not.toBeNull();
    expect(Math.max(back.l, back.r)).toBeLessThan(0.05);
  });

  it.each(LONG)("%s: through a stride, walking and crouch-walking from the hip and aimed, the gun stays clear of the body", async (kind) => {
    await arm(c, kind);
    // Each change of stance eases in over the frames sampled too.
    for (const [crouch, aim] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 0],
      [0, 1],
      [0, 0],
    ] as const) {
      for (let i = 0; i < 90; i++) {
        animateRig(c.rig, crouch ? 0.8 : 1.6, 1 / 60, crouch, { aim });
        // Every frame: the sleeves' spring bones need the whole motion.
        c.models.update(1 / 60, c.rig.time);
        c.loadouts.update(c.rig);
        if (i % 5 !== 0) continue;
        const held = onHands(c, kind, true)!;
        expect(held.inside, `crouch ${crouch} aim ${aim} frame ${i}: body inside the gun`).toEqual([]);
        expect(Math.max(held.l, held.r), `crouch ${crouch} aim ${aim} frame ${i}: palms off the gun`).toBeLessThan(0.05);
      }
    }
  });

  it.each(["rifle"] as const)("%s: walking aimed, the feet step the way the character walks", async (kind) => {
    await arm(c, kind);
    pose(c, 1);
    const inverse = Matrix.Invert(c.rig.root.computeWorldMatrix(true));
    let across = 0;
    let along = 0;
    let prev: Vector3 | null = null;
    for (let i = 0; i < 120; i++) {
      frame(c, 1.6, 1);
      const foot = Vector3.TransformCoordinates(worldOf(c.bone("L_Foot")), inverse);
      if (prev) {
        across += Math.abs(foot.x - prev.x);
        along += Math.abs(foot.z - prev.z);
      }
      prev = foot;
    }
    // Before: the bladed stance turned the legs too, and the feet swung 37° off the way of travel (0.75 across per 1 along).
    expect(across / along).toBeLessThan(0.15);
  });

  it.each(LONG)("%s: drawn and holstered, the gun only shows in the hands with both hands on it", async (kind) => {
    await arm(c, kind);
    pose(c, 0);
    for (const drawn of [false, true]) {
      setWeaponDrawn(c.rig, drawn);
      let shown = 0;
      for (let i = 0; i < 40; i++) {
        frame(c, 0, 0);
        const held = onHands(c, kind, i % 3 === 0);
        if (!held) continue;
        shown++;
        const at = `${drawn ? "draw" : "holster"} frame ${i} (drawn ${c.rig.drawn.toFixed(2)})`;
        // Before: the gun showed from half way through the draw while the hands were still 0.3-0.5 m away.
        expect(Math.max(held.l, held.r), at).toBeLessThan(0.06);
        expect(held.inside, `${at}: body inside the gun`).toEqual([]);
      }
      expect(shown, drawn ? "in the hands once drawn" : "in the hands at the start of the holster").toBeGreaterThan(0);
    }
  });

  it.each(LONG)("%s: reloading, the left hand fetches a magazine without going through the gun", async (kind) => {
    await arm(c, kind);
    pose(c, 0);
    startReload(c.rig, 1.5);
    let away = 0;
    for (let i = 0; i < 90; i++) {
      frame(c, 0, 0);
      const held = onHands(c, kind, i % 6 === 0)!;
      away = Math.max(away, held.l);
      expect(held.r, `reload frame ${i}: right palm off the grip`).toBeLessThan(0.05);
      // Before: the left arm swung to the chest through the gun, 30-444 vertices inside it.
      expect(held.inside, `reload frame ${i}: body inside the gun`).toEqual([]);
    }
    expect(away, "the left hand leaves the fore-end").toBeGreaterThan(0.1);
  });
});
