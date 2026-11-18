import { type DomainEvents, EventBus } from "@seki/core";
import { describe, expect, it } from "vitest";
import { HAPTIC, bindHaptics, webHaptics } from "../src/haptics";
import { loadSettings } from "../src/settings";

/*
 * Haptics on a phone (the user's ask of 18.11): the player's shots, hits taken, kills, hard
 * landings and death buzz, nobody else's, and only while the setting is on.
 */

const P = 1;
const AT = { x: 0, y: 1, z: 0 };

const harness = (on = true) => {
  const bus = new EventBus<DomainEvents>();
  const buzzes: (number | readonly number[])[] = [];
  let enabled = on;
  bindHaptics(bus, { pulse: (p) => buzzes.push(p) }, () => P, () => enabled);
  return { bus, buzzes, set: (v: boolean) => (enabled = v) };
};

describe("haptics (18.11)", () => {
  it("buzzes for the player's shot, a hit it takes, its kill, a hard landing and its death", () => {
    const { bus, buzzes } = harness();
    bus.emit("ShotFired", { shooterId: P, from: AT, to: AT, hitEntity: null, look: "pistol" });
    bus.emit("DamageDealt", { sourceId: 9, targetId: P, amount: 10, critical: false, zone: "torso", at: AT });
    bus.emit("DamageDealt", { sourceId: 9, targetId: P, amount: 10, critical: true, zone: "head", at: AT });
    bus.emit("EntityKilled", { entityId: 9, tag: null, killerId: P });
    bus.emit("Landed", { entityId: P, drop: 6, hard: true, damage: 5, at: AT });
    bus.emit("PlayerDied", { entityId: P });
    expect(buzzes).toEqual([HAPTIC.shot, HAPTIC.hurt, HAPTIC.hurtCritical, HAPTIC.kill, HAPTIC.landing, HAPTIC.death]);
  });

  it("stays still for others' shots, hits it deals, a soft landing, and with the setting off", () => {
    const { bus, buzzes, set } = harness();
    bus.emit("ShotFired", { shooterId: 9, from: AT, to: AT, hitEntity: P, look: "pistol" });
    bus.emit("DamageDealt", { sourceId: P, targetId: 9, amount: 10, critical: false, zone: "torso", at: AT });
    bus.emit("EntityKilled", { entityId: 9, tag: null, killerId: 7 });
    bus.emit("Landed", { entityId: P, drop: 1, hard: false, damage: 0, at: AT });
    expect(buzzes).toEqual([]);
    set(false);
    bus.emit("ShotFired", { shooterId: P, from: AT, to: AT, hitEntity: null, look: "pistol" });
    expect(buzzes).toEqual([]);
  });

  it("uses the Web Vibration API where there is one, and none without; the setting defaults on and is kept", () => {
    const calls: unknown[] = [];
    webHaptics({ vibrate: (p) => (calls.push(p), true) })!.pulse(HAPTIC.kill);
    expect(calls).toEqual([[...HAPTIC.kill]]);
    expect(webHaptics({})).toBeNull();
    const store = new Map<string, string>([["seki.settings.v1", JSON.stringify({ rev: 3, haptics: false })]]);
    expect(loadSettings({ getItem: (k) => store.get(k) ?? null, setItem: () => undefined }).haptics).toBe(false);
    expect(loadSettings({ getItem: () => null, setItem: () => undefined }).haptics).toBe(true);
  });
});
