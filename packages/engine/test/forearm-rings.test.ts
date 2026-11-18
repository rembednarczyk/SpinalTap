import { beforeAll, describe, expect, it } from "vitest";
import type { AppearanceDescriptor, WeaponLook } from "@seki/core";
import { Vector3 } from "../src/babylon";
import { type Cast, arm, cast, pose } from "./two-hand-cast";
import { worldOf } from "./t-pose";

/*
 * Seki's arm implant (ADR-0015 `implants: ["arms"]`): two copper rings round her right forearm.
 * They follow the forearm, not the hand: in every hold (a pistol at low ready or aimed, a long
 * gun held or aimed) each ring sits on the forearm between the elbow and the wrist, its axis
 * along it, as with the pistol, and does not turn off with the wrist's grip (the user, 18.11).
 */

const look = (active: WeaponLook): AppearanceDescriptor => ({
  weapons: { primary: active === "pistol" ? "rifle" : active, secondary: "pistol", melee: null, active: active === "pistol" ? "secondary" : "primary" },
  garments: {},
  implants: ["arms"],
});

/** How a ring sits on the model's right forearm: off its line (m), off its direction (°), along it (0 elbow .. 1 wrist). */
const seat = (c: Cast, ring: string) => {
  const elbow = worldOf(c.bone("R_LowerArm"));
  const wrist = worldOf(c.bone("R_Hand"));
  const along = wrist.subtract(elbow);
  const length = along.length();
  const dir = along.scale(1 / length);
  const node = c.scene.getMeshByName(ring)!;
  node.computeWorldMatrix(true);
  const at = node.getAbsolutePosition();
  const t = Vector3.Dot(at.subtract(elbow), dir) / length;
  const off = at.subtract(elbow.add(dir.scale(t * length))).length();
  // A torus's axis is its local Y.
  const axis = Vector3.TransformNormal(Vector3.Up(), node.getWorldMatrix()).normalize();
  const tilt = (Math.acos(Math.min(1, Math.abs(Vector3.Dot(axis, dir)))) * 180) / Math.PI;
  return { off, tilt, t };
};

describe("the arm implant's rings on Seki's right forearm", () => {
  let c: Cast;
  beforeAll(async () => {
    c = await cast("heroine");
  }, 60_000);

  it.each([
    ["pistol", 0],
    ["pistol", 1],
    ["rifle", 0],
    ["rifle", 1],
    ["shotgun", 1],
    ["smg", 1],
  ] as const)("%s, aim %d: both rings on the forearm, round it", async (kind, aim) => {
    await arm(c, kind);
    c.loadouts.set(c.rig, look(kind), "c");
    pose(c, aim);
    for (const ring of ["c-cyberarm0", "c-cyberarm1"]) {
      const s = seat(c, ring);
      expect(s.off, `${ring} off the forearm`).toBeLessThan(0.02);
      expect(s.tilt, `${ring} axis off the forearm`).toBeLessThan(12);
      expect(s.t, `${ring} along the forearm`).toBeGreaterThan(0.2);
      expect(s.t, `${ring} along the forearm`).toBeLessThan(1);
    }
  });
});
