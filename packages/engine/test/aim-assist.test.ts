import { EMPTY_INPUT, type InputFrame, degToRad } from "@seki/core";
import { describe, expect, it } from "vitest";
import { AimAssist, type AimTarget, SNAP_MAX, SNAP_TIME, slowdownFactor, snapTurn } from "../src/input/aim-assist";

const DT = 1 / 60;

/** A target `deg` degrees to the right of the axis, level with it, with an angular radius of `radiusDeg`. */
const right = (deg: number, radiusDeg = 1): AimTarget => ({ yaw: degToRad(deg), pitch: 0, angle: degToRad(deg), radius: degToRad(radiusDeg), distance: 12 });

const aimed = (patch: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, aim: true, ...patch });

const assist = (targets: AimTarget[], level: AimAssist["level"] = "standard"): AimAssist => {
  const a = new AimAssist();
  a.level = level;
  a.adsWeapon = true;
  a.targets = targets;
  return a;
};

/** Raises the sights from touch and runs `steps` steps; the yaw the pull added. */
const pullOver = (a: AimAssist, steps: number, look = 0): number => {
  a.observe(true, true);
  let yaw = 0;
  for (let i = 0; i < steps; i++) yaw += a.apply(aimed({ lookYaw: look }), DT).lookYaw - look;
  return yaw;
};

describe("aim assist slowdown (ADR-0072)", () => {
  it("slows to 0.55 on the chest and back to 1 at 1.5 × the silhouette", () => {
    expect(slowdownFactor([right(0)], "standard")).toBeCloseTo(0.55, 6);
    expect(slowdownFactor([right(0.75)], "standard")).toBeCloseTo(0.775, 6);
    expect(slowdownFactor([right(1.5)], "standard")).toBe(1);
    expect(slowdownFactor([right(2)], "standard")).toBe(1);
  });

  it("slows less with the light level, not at all when off, and the strongest target counts", () => {
    expect(slowdownFactor([right(0)], "light")).toBeCloseTo(0.75, 6);
    expect(slowdownFactor([right(0)], "off")).toBe(1);
    expect(slowdownFactor([right(1.2), right(0.3)], "standard")).toBeCloseTo(0.55 + 0.45 * 0.2, 6);
    expect(slowdownFactor([], "standard")).toBe(1);
  });

  it("slows a frame's look only with a sights weapon and the assist on", () => {
    const a = assist([right(0)]);
    const slowed = a.slow({ ...EMPTY_INPUT, lookYaw: 0.1, lookPitch: 0.02 });
    expect(slowed.lookYaw).toBeCloseTo(0.055, 9);
    expect(slowed.lookPitch).toBeCloseTo(0.011, 9);
    a.adsWeapon = false;
    expect(a.slow({ ...EMPTY_INPUT, lookYaw: 0.1 }).lookYaw).toBe(0.1);
    a.adsWeapon = true;
    a.level = "off";
    expect(a.slow({ ...EMPTY_INPUT, lookYaw: 0.1 }).lookYaw).toBe(0.1);
  });
});

describe("aim assist pull on raising the sights (ADR-0072)", () => {
  it("pulls 60% of the way to a chest inside the 6° cone, none just outside it", () => {
    expect(snapTurn([right(3, 0)])!.yaw).toBeCloseTo(degToRad(1.8), 9);
    expect(snapTurn([right(5.9, 0)])!.yaw).toBeCloseTo(degToRad(5.9 * 0.6), 9);
    expect(snapTurn([right(6.1, 0)])).toBeNull();
  });

  it("counts the silhouette reaching into the cone, and pulls at most 4°", () => {
    expect(snapTurn([right(7, 0.9)])).toBeNull();
    expect(snapTurn([right(7, 1.1)])!.yaw).toBeCloseTo(SNAP_MAX, 9);
    expect(snapTurn([right(6.8, 1)])!.yaw).toBeCloseTo(SNAP_MAX, 9);
    expect(snapTurn([right(6.5, 1)])!.yaw).toBeCloseTo(degToRad(3.9), 9);
  });

  it("takes the chest nearest the axis, in both directions", () => {
    const left: AimTarget = { yaw: degToRad(-2), pitch: degToRad(-1), angle: Math.hypot(degToRad(2), degToRad(1)), radius: 0, distance: 10 };
    const t = snapTurn([right(4, 0), left])!;
    expect(t.yaw).toBeCloseTo(degToRad(-1.2), 9);
    expect(t.pitch).toBeCloseTo(degToRad(-0.6), 9);
  });

  it("spreads the pull over 0.15 s and stops there: no tracking", () => {
    const a = assist([right(3, 0)]);
    const steps = Math.round(SNAP_TIME / DT);
    expect(pullOver(a, steps)).toBeCloseTo(degToRad(1.8), 9);
    expect(a.pulling).toBe(false);
    expect(a.apply(aimed(), DT).lookYaw).toBe(0);
  });

  it("a turn against the pull ends it; one along it or across it does not", () => {
    const against = assist([right(3, 0)]);
    against.observe(true, true);
    against.apply(aimed(), DT);
    expect(against.apply(aimed({ lookYaw: -0.001 }), DT).lookYaw).toBe(-0.001);
    expect(against.pulling).toBe(false);
    expect(against.apply(aimed(), DT).lookYaw).toBe(0);
    const along = assist([right(3, 0)]);
    expect(pullOver(along, 9, 0.001)).toBeCloseTo(degToRad(1.8), 9);
    const across = assist([right(3, 0)]);
    across.observe(true, true);
    expect(across.apply(aimed({ lookPitch: 0.01 }), DT).lookYaw).toBeGreaterThan(0);
    expect(across.pulling).toBe(true);
  });

  it("pulls only on the rise from touch, with a sights weapon and the assist on", () => {
    const mouse = assist([right(3, 0)]);
    mouse.observe(true, false);
    expect(mouse.pulling).toBe(false);
    const held = assist([right(3, 0)]);
    pullOver(held, 9);
    held.observe(true, true);
    expect(held.pulling).toBe(false);
    const off = assist([right(3, 0)], "off");
    off.observe(true, true);
    expect(off.pulling).toBe(false);
    const melee = assist([right(3, 0)]);
    melee.adsWeapon = false;
    melee.observe(true, true);
    expect(melee.pulling).toBe(false);
  });

  it("letting go of the sights or a reset drops the pull", () => {
    const a = assist([right(3, 0)]);
    a.observe(true, true);
    expect(a.apply(aimed({ aim: false }), DT).lookYaw).toBe(0);
    expect(a.pulling).toBe(false);
    a.reset();
    a.observe(true, true);
    expect(a.pulling).toBe(true);
    a.reset();
    expect(a.pulling).toBe(false);
  });
});
