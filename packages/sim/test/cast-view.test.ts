import { describe, expect, it } from "vitest";
import { CAST_KEYS, type ViewDescriptor } from "@seki/core";
import { CAST_OF_SPAWN, ENCOUNTERS, KANAL_PATROL_ACTORS, castViewOf, ground } from "../src";
import { GAME_ACTORS } from "../src/content/street-props";
import { actorEntity } from "../src/world/factory";
import { passerbyEntity } from "../src/world/passersby";
import { teleportPlayer, run } from "./helpers";
import { street } from "./micro-scenes";

const ACTORS = [...GAME_ACTORS, ...KANAL_PATROL_ACTORS];
const viewOfActor = (key: string): ViewDescriptor | undefined => {
  const def = ACTORS.find((a) => a.spawn.key === key);
  return def ? actorEntity(1, def, "c").view : undefined;
};
const castOf = (v: ViewDescriptor | undefined) => (v?.kind === "npc" || v?.kind === "enemy" ? v.cast : undefined);
const lookOf = (v: ViewDescriptor | undefined) => (v?.kind === "npc" || v?.kind === "enemy" ? v.look : undefined);

/** ADR-0076 stage 1: who a character is and the seed of its look, in its view only. */
describe("the cast in the views (ADR-0076)", () => {
  it("names the characters of the story by their spawn keys: Kaito is the fixer of Neon Koi", () => {
    expect(viewOfActor("fixer")).toMatchObject({ kind: "npc", preset: "fixer", cast: "kaito" });
    expect(viewOfActor("ume")).toMatchObject({ kind: "npc", preset: "civilian", cast: "ume" });
    expect(viewOfActor("kurosawa")).toMatchObject({ kind: "npc", preset: "fixer", cast: "kurosawa" });
    // The background has a look but no name.
    expect(castOf(viewOfActor("koi-barman"))).toBeUndefined();
    expect(lookOf(viewOfActor("koi-barman"))).toEqual(expect.any(Number));
    expect(castOf(viewOfActor("guard"))).toBeUndefined();
  });

  it("covers every name of the cast, by a character the content places (an actor or a street scene)", () => {
    const placed = new Set([...ACTORS.map((a) => a.spawn.key), ...ENCOUNTERS.flatMap((e) => (e.npcKey ? [e.npcKey] : []))]);
    for (const key of Object.keys(CAST_OF_SPAWN)) expect(placed.has(key), key).toBe(true);
    expect(new Set(Object.values(CAST_OF_SPAWN))).toEqual(new Set(CAST_KEYS));
    // One spawn key per name: two bodies of one character would be the same look twice.
    expect(Object.values(CAST_OF_SPAWN).length).toBe(CAST_KEYS.length);
  });

  it("seeds the look from the key, the same in every game, and different between characters", () => {
    expect(lookOf(viewOfActor("ume"))).toBe(castViewOf("ume", "ume").look);
    expect(lookOf(viewOfActor("ume"))).toBe(lookOf(viewOfActor("ume")));
    const looks = new Set(ACTORS.filter((a) => a.kind === "npc").map((a) => lookOf(viewOfActor(a.spawn.key))));
    expect(looks.size).toBe(new Set(ACTORS.filter((a) => a.kind === "npc").map((a) => a.spawn.key)).size);
  });

  it("gives a resident passer-by the look of its chunk and its place in the plan", () => {
    const stop = { spot: { at: { x: 0, y: 0, z: 0 }, yaw: 0 }, activity: "stand" } as unknown as Parameters<typeof passerbyEntity>[3];
    const a = passerbyEntity(7, "k1", 3, stop).view;
    const b = passerbyEntity(9, "k1", 3, stop).view;
    const c = passerbyEntity(7, "k1", 4, stop).view;
    expect(lookOf(a)).toEqual(expect.any(Number));
    expect(lookOf(a)).toBe(lookOf(b));
    expect(lookOf(a)).not.toBe(lookOf(c));
    expect(castOf(a)).toBeUndefined();
  });

  it("names the character of a street scene without giving it a key: Shiro under his lamp", () => {
    const sim = street(21);
    teleportPlayer(sim, ground(97, -23 + 10));
    run(sim, 2);
    const poet = [...sim.world].find((e) => !e.key && e.view?.kind === "npc" && Math.hypot(e.position.x - 97, e.position.z + 23) < 0.5);
    expect(poet?.view).toMatchObject({ kind: "npc", preset: "civilian", cast: "shiro", look: castViewOf("enc-shiro", "enc-shiro").look });
  });
});
