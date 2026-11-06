import { EMPTY_INPUT, degToRad } from "@seki/core";
import { AimAssist } from "@seki/engine";
import { type Entity, Simulation, chestOf, eyeOf, gangerEntity, ground } from "@seki/sim";
import { DEFAULT_SETTINGS } from "@seki/ui";
import { describe, expect, it } from "vitest";
import { aimTargetAlong, aimTargetsFor, feedAimAssist } from "../src/aim-assist-feed";
import { SETTINGS_KEY, loadSettings, sanitizeSettings } from "../src/settings";

/*
 * The simulation's targets as the engine's assist sees them (ADR-0072, stage 3): angles along the
 * aim axis, and in TPP only what the shoulder the shots start from sees. Plac Litewski, facing
 * north; nothing steps after the setup.
 */

const square = (seed = 7, tpp = false): Simulation => {
  const sim = Simulation.create({ seed });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  if (tpp) sim.step({ ...EMPTY_INPUT, toggleCamera: true });
  const p = sim.player()!;
  p.position = ground(70, -50);
  p.prevPosition = p.position;
  p.yaw = 0;
  p.pitch = 0;
  return sim;
};

const at = (sim: Simulation, dx: number, dz: number) => {
  const p = sim.player()!.position;
  return ground(p.x + dx, p.z + dz);
};

const ganger = (sim: Simulation, dx: number, dz: number): Entity => {
  const g = gangerEntity(4100, { key: "aim-feed", position: at(sim, dx, dz), yaw: Math.PI }, null, 80, sim.player()!.chunk ?? "");
  g.ai = { ...g.ai!, alerted: true };
  return sim.world.add(g);
};

/** A wall 4 m tall from `x0` to `x0 + 4` east of her, `dz` m north: its west edge cuts the view. */
const wallEastOf = (sim: Simulation, x0: number, dz: number): void => {
  const c = at(sim, x0 + 2, dz);
  sim.world.add({
    id: 4900,
    position: { ...c, y: c.y + 2 },
    prevPosition: { ...c, y: c.y + 2 },
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    view: { kind: "block", size: { x: 4, y: 4, z: 0.3 }, material: "metal" },
    solid: { min: { x: c.x - 2, y: c.y, z: c.z - 0.15 }, max: { x: c.x + 2, y: c.y + 4, z: c.z + 0.15 } },
  });
};

describe("aim targets for the assist (ADR-0072, stage 3)", () => {
  it("measures the turn to the chest along the aim axis, right and down positive", () => {
    const o = { x: 0, y: 1.6, z: 0 };
    const t = aimTargetAlong(o, 0, 0, { x: 12 * Math.tan(degToRad(3)), y: 1.6 - 12 * Math.tan(degToRad(2)), z: 12 }, 0.4)!;
    expect(t.yaw).toBeCloseTo(degToRad(3), 9);
    expect(t.pitch).toBeCloseTo(degToRad(2), 3);
    expect(t.angle).toBeCloseTo(Math.hypot(degToRad(3), degToRad(2)), 3);
    expect(t.radius).toBeCloseTo(Math.atan2(0.4, t.distance), 9);
    const turned = aimTargetAlong(o, degToRad(3), degToRad(2), { x: 0, y: 1.6, z: 12 }, 0.4)!;
    expect(turned.yaw).toBeCloseTo(degToRad(-3), 9);
    expect(turned.pitch).toBeCloseTo(degToRad(-2), 9);
  });

  it("an enemy the eye sees past the edge of a wall is no target in TPP when the right shoulder does not see it", () => {
    // Eye line 0.15 m west of the edge at the wall, the right shoulder's 0.125 m behind it.
    const fpp = square();
    const g1 = ganger(fpp, -0.3, 12);
    wallEastOf(fpp, 0, 6);
    expect(fpp.aimTargets().map((t) => t.id)).toEqual([g1.id]);
    expect(aimTargetsFor(fpp, fpp.player()!, false)).toHaveLength(1);

    const tpp = square(7, true);
    expect(tpp.domain.preferences.cameraMode).toBe("TPP");
    ganger(tpp, -0.3, 12);
    wallEastOf(tpp, 0, 6);
    expect(tpp.aimTargets()).toHaveLength(1);
    expect(aimTargetsFor(tpp, tpp.player()!, false)).toEqual([]);
    // Over the left shoulder the line clears the edge again.
    expect(aimTargetsFor(tpp, tpp.player()!, true)).toHaveLength(1);
  });

  it("in TPP the angle is the shoulder's: a chest straight ahead of the eye is off to the left", () => {
    const sim = square(23, true);
    const g = ganger(sim, 0, 12);
    const p = sim.player()!;
    p.pitch = aimTargetAlong(eyeOf(p), 0, 0, chestOf(g), 0)!.pitch;
    const [t] = aimTargetsFor(sim, p, false);
    expect(t!.yaw).toBeCloseTo(-Math.atan2(0.55, 12), 2);
  });

  it("feeds nothing with the assist off or without a sights weapon", () => {
    const sim = square();
    ganger(sim, 0.5, 12);
    const assist = new AimAssist();
    feedAimAssist(assist, DEFAULT_SETTINGS, sim, false);
    expect(assist).toMatchObject({ level: "standard", adsWeapon: true });
    expect(assist.targets).toHaveLength(1);
    feedAimAssist(assist, { aimAssist: "off" }, sim, false);
    expect(assist.targets).toEqual([]);
    sim.player()!.combatant!.stats = { ...sim.player()!.combatant!.stats!, ads: null };
    feedAimAssist(assist, DEFAULT_SETTINGS, sim, false);
    expect(assist).toMatchObject({ adsWeapon: false, targets: [] });
  });
});

describe("the aim assist setting (ADR-0072, stage 3)", () => {
  it("is standard by default and for entries saved before it, keeps a valid choice and drops anything else", () => {
    expect(DEFAULT_SETTINGS.aimAssist).toBe("standard");
    expect(sanitizeSettings({ quality: "low" }).aimAssist).toBe("standard");
    expect(sanitizeSettings({ aimAssist: "strong" }).aimAssist).toBe("standard");
    expect(sanitizeSettings({ aimAssist: 1 }).aimAssist).toBe("standard");
    expect(sanitizeSettings({ aimAssist: "light" }).aimAssist).toBe("light");
    expect(sanitizeSettings({ aimAssist: "off" }).aimAssist).toBe("off");
    const old = { getItem: (k: string) => (k === SETTINGS_KEY ? JSON.stringify({ rev: 2, touchSensitivity: 1.4 }) : null), setItem() {} };
    expect(loadSettings(old)).toMatchObject({ aimAssist: "standard", touchSensitivity: 1.4 });
  });
});
