import { describe, expect, it } from "vitest";
import { VENUE_KINDS } from "@seki/core";
import { INTERIORS, MAP_CHUNKS } from "@seki/sim";
import { buildCityMap } from "../src/city-map";

/** The venues on the map (ADR-0100): the map's shops, cafés and bars and the game's named interiors as `venue` labels. */

const map = buildCityMap();
const venues = map.labels!.filter((l) => l.kind === "venue");

describe("venues in the city map (ADR-0100)", () => {
  it("names every venue of the map's standing buildings with its 2077 name, kind and neon, where it is", () => {
    const places = venues.filter((l) => l.venue !== "interior");
    const all = MAP_CHUNKS.flatMap((c) => c.buildings.flatMap((b) => (b.venues ?? []).map((v) => ({ ...v, x: b.x + v.x, z: b.z + v.z }))));
    expect(places.length).toBeGreaterThan(300);
    expect(places.length).toBeLessThanOrEqual(all.length);
    for (const l of places) {
      expect(VENUE_KINDS, l.text).toContain(l.venue);
      expect(l.color, l.text).toMatch(/^#[0-9a-f]{6}$/);
      expect(l.key, l.text).toBeUndefined();
      expect(all.some((v) => v.name === l.text && Math.abs(v.x - l.x) < 0.1 && Math.abs(v.z - l.z) < 0.1), l.text).toBe(true);
    }
    expect(places.map((l) => l.text)).toContain("APTEKA GEMMA");
  });

  it("names the game's interiors by key, without the gallery's shops or the metro's platforms", () => {
    const inside = venues.filter((l) => l.venue === "interior");
    const ids = inside.map((l) => l.text);
    expect(ids).toEqual(expect.arrayContaining(["interior.clinic", "interior.neon-koi", "interior.alchemia-gallery", "interior.alchemia-p2", "interior.trasa-podziemna", "interior.w3-hall"]));
    expect(ids.some((k) => k.startsWith("interior.alchemia-shop-"))).toBe(false);
    expect(ids.some((k) => k.startsWith("interior.metro-"))).toBe(false);
    expect(inside.every((l) => l.key === true)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    // Over its own rooms: the clinic's label inside one of the clinic's rooms.
    const clinic = inside.find((l) => l.text === "interior.clinic")!;
    expect(INTERIORS.find((i) => i.id === "clinic")!.rooms.some((r) => clinic.x >= r.minX && clinic.x <= r.maxX && clinic.z >= r.minZ && clinic.z <= r.maxZ)).toBe(true);
  });
});
