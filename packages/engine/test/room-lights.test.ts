import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { CLINIC_DETAIL, KOI_DETAIL, S7_INTERIORS, TESSEN_OFFICE_DETAIL, interiorAt } from "@seki/sim";
import { INDOOR_RIG, ROOM_RIG, indoorRig } from "../src/npr/lighting";
import { LIT_ROOMS, ROOM_LAMPS, ROOM_LAMPS_ON, roomLampsFor } from "../src/renderer/rooms/room-lights";

/*
 * The old town's rooms and Tessen's office in their interior mode (`docs/zasady-lokacji.md` §13): every lamp hangs in
 * its room by something that gives light in the picture (no light from nowhere), clipped to that room, and an eye in a
 * room gets only that room's lamps.
 */

const REACH = 3;
const LIGHTY = /lamp|light|neon|aquarium|jukebox|desk|shelf/i;

const fixtures = (): { x: number; y: number; z: number }[] => [
  ...S7_INTERIORS.filter((p) => p.view.kind === "neon").map((p) => p.center),
  ...[...KOI_DETAIL, ...CLINIC_DETAIL, ...TESSEN_OFFICE_DETAIL]
    .filter((p) => LIGHTY.test(ROOM_DETAIL_SHAPES[p.variant]?.key ?? ""))
    .map((p) => ({ x: p.x, y: p.y, z: p.z })),
];

describe("the small rooms' practicals (§13)", () => {
  it("lights Neon Koi, the clinic and the pass office, each lamp inside its own room and clipped to it", () => {
    expect([...LIT_ROOMS].sort()).toEqual(["clinic", "neon-koi", "tessen-office"]);
    for (const { key, room, light } of ROOM_LAMPS) {
      const c = light.clip;
      const p = light.position;
      expect(p.x >= c.minX && p.x <= c.maxX && p.z >= c.minZ && p.z <= c.maxZ && p.y >= c.minY && p.y <= c.maxY, key).toBe(true);
      expect(interiorAt({ x: p.x, y: c.minY + 1, z: p.z })?.id, key).toBe(room);
    }
  });

  it("hangs every lamp within reach of a fitting, a sign or a screen of its room", () => {
    const all = fixtures();
    for (const { key, light } of ROOM_LAMPS) {
      const d = Math.min(...all.map((f) => Math.hypot(f.x - light.position.x, f.z - light.position.z)));
      expect(d, key).toBeLessThanOrEqual(REACH);
    }
  });

  it("gives an eye in a room only that room's lamps, the nearest first", () => {
    for (const room of LIT_ROOMS) {
      const first = ROOM_LAMPS.find((l) => l.room === room)!;
      const on = roomLampsFor(room, first.light.position);
      expect(on.length).toBeLessThanOrEqual(ROOM_LAMPS_ON);
      expect(on.every((l) => l.room === room)).toBe(true);
      expect(on[0]).toBe(first);
    }
  });

  it("dims the room's own rig under the sky's, the same by day and night", () => {
    expect(indoorRig("room", 0)).toBe(ROOM_RIG);
    expect(indoorRig("room", 1)).toBe(ROOM_RIG);
    expect(indoorRig("w3", 0.5)).toBe(INDOOR_RIG);
  });
});
