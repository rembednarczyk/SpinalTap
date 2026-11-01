import { describe, expect, it } from "vitest";
import { type StreetPropItem, type ViewDescriptor, doorVariant } from "../../../packages/core/src";
import { doorSlots } from "../../../packages/engine/src/renderer/mapcity/door-slots";
import type { Wall } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { CLINIC_DOOR } from "../../../packages/sim/src/content/interiors";
import { PASSAGES } from "../../../packages/sim/src/content/lublin/sites";
import { surfaceY } from "../../../packages/sim/src/content/lublin/terrain";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import type { BoardSpan } from "../../osm-import/src/props-boards.ts";
import { cityFrames } from "../../osm-import/src/venue-boards.ts";
import { doorChecks } from "./door-pieces";

/**
 * The glitch scan's checks of the doors on the facades (ADR-0058 stage 9): a tenement of its own far
 * from the map's districts, a door in each kind of slot its wall has, then each door moved where it
 * must not be. Each check finds that door and nothing in the slots.
 */

const AT = { x: 5000, z: 5000 };
const ground = surfaceY(AT.x, AT.z);
const outline = [
  { x: -11.5, z: -6 },
  { x: 11.5, z: -6 },
  { x: 11.5, z: 6 },
  { x: -11.5, z: 6 },
];
const house = { kind: "building", outline, height: 15, levels: 4, use: "historic", look: 3 } as ViewDescriptor;
// A shop front's building (shop windows over its ground floor), 100 m east of the tenement.
const shopHouse = { kind: "building", outline, height: 15, levels: 4, use: "commercial", shopfront: true, look: 5 } as ViewDescriptor;
const views = [
  { view: house, at: { x: AT.x, y: ground, z: AT.z } },
  { view: shopHouse, at: { x: AT.x + 100, y: surfaceY(AT.x + 100, AT.z), z: AT.z } },
];

/** A building's wall facing -z (the outline's first edge, counter-clockwise from the corner at -11.5, -6), its slots and doors on it. */
const facing = (n: number) => {
  const frame = cityFrames(views)[n]!.frame;
  const wall = frame.walls.find((w) => w.nz < -0.9)!;
  const slots = doorSlots(frame, wall);
  const doorAt = (u: number, width: number, top: number, out = 0, lift = 0): StreetPropItem => {
    const x = wall.a.x + ((wall.b.x - wall.a.x) * u) / wall.length + wall.nx * out;
    const z = wall.a.z + ((wall.b.z - wall.a.z) * u) / wall.length + wall.nz * out;
    const y = surfaceY(x + wall.nx * 0.1, z + wall.nz * 0.1) + lift;
    return { prop: "door", x, y, z, yaw: Math.atan2(wall.nx, wall.nz), variant: doorVariant({ model: "tall", width, height: frame.b.base + top - y }) };
  };
  const fromSlot = (s: (typeof slots)[number], shift = 0, out = 0, lift = 0) => doorAt(s.u + shift, s.width, s.top, out, lift);
  return { wall, slots, doorAt, fromSlot };
};
const shop = facing(1);
const { wall, slots, doorAt, fromSlot } = facing(0);

const found = (doors: StreetPropItem[], boards: BoardSpan[] = []) => {
  const checks = doorChecks(views, doors, boards);
  return Object.fromEntries(Object.entries(checks).map(([k, f]) => [k, f().length]));
};
const none = { "door-off-wall": 0, "door-floating": 0, "door-in-window": 0, "door-in-board": 0, "door-in-passage": 0, "door-on-game-door": 0 };

describe("the glitch scan's checks of the facade doors (ADR-0058 stage 9)", () => {
  const cover = slots.find((s) => s.cover)!;
  const pier = slots.find((s) => !s.cover && s.u > 8)!;

  it("finds nothing in the walls' slots, the tenement's and the shop's", () => {
    expect(slots.length).toBeGreaterThan(4);
    expect(shop.slots.filter((s) => s.cover).length).toBeGreaterThan(2);
    expect(found([...slots.map((s) => fromSlot(s)), ...shop.slots.map((s) => shop.fromSlot(s))])).toEqual(none);
  });

  it("door-off-wall: a door 0.3 m out from the wall's face, or past its end", () => {
    expect(found([fromSlot(pier, 0, 0.3)])["door-off-wall"]).toBe(1);
    expect(found([doorAt(0.2, 1.2, 2.3)])["door-off-wall"]).toBe(1);
  });

  it("door-floating: a door 0.1 m over the paving, or sunk 0.1 m into it", () => {
    expect(found([fromSlot(pier, 0, 0, 0.1)])["door-floating"]).toBe(1);
    expect(found([fromSlot(pier, 0, 0, -0.1)])["door-floating"]).toBe(1);
  });

  it("door-floating: a door across a slope of the map, a jamb over 0.15 m off the paving", () => {
    const frames = cityFrames(WORLD_SCENERY).filter((b) => !b.landmark);
    const surf = (w: Wall, u: number) => surfaceY(w.a.x + ((w.b.x - w.a.x) * u) / w.length + w.nx * 0.1, w.a.z + ((w.b.z - w.a.z) * u) / w.length + w.nz * 0.1);
    const steep = frames.flatMap((b) => b.frame.walls.filter((w) => !w.blind && w.length > 4 && Math.abs(surf(w, w.length / 2 - 0.6) - surf(w, w.length / 2 + 0.6)) > 0.4).map((w) => ({ b, w })))[0]!;
    const { b, w } = steep;
    const x = w.a.x + (w.b.x - w.a.x) / 2;
    const z = w.a.z + (w.b.z - w.a.z) / 2;
    const y = surf(w, w.length / 2);
    const door: StreetPropItem = { prop: "door", x, y, z, yaw: Math.atan2(w.nx, w.nz), variant: doorVariant({ model: "steel", width: 1.2, height: 2.3 }) };
    expect(doorChecks([{ view: b.view, at: b.at }], [door], [])["door-floating"]!()).toHaveLength(1);
  });

  it("door-in-window: a door half over a window, or under the top of one it covers", () => {
    expect(found([fromSlot(cover, cover.width / 2)])["door-in-window"]).toBe(1);
    expect(found([doorAt(cover.u, cover.width, cover.top - 0.3)])["door-in-window"]).toBe(1);
  });

  it("door-in-window: a door half over a shop window, or under the top of one it covers", () => {
    const pane = shop.slots.find((s) => s.cover)!;
    expect(found([shop.fromSlot(pane, pane.width / 2)])["door-in-window"]).toBe(1);
    expect(found([shop.doorAt(pane.u, pane.width, pane.top - 0.3)])["door-in-window"]).toBe(1);
  });

  it("door-in-board: a door reaching into a board over it", () => {
    const d = fromSlot(pier);
    const a = { x: d.x - 1, z: d.z };
    const b = { x: d.x + 1, z: d.z };
    const board: BoardSpan = { a, b, nx: wall.nx, nz: wall.nz, bottom: d.y + 2.0, top: d.y + 2.7, wallA: wall.a, wallB: wall.b, text: "X" };
    expect(found([d], [board])["door-in-board"]).toBe(1);
    expect(found([d], [{ ...board, bottom: d.y + 2.5 }])["door-in-board"]).toBe(0);
  });

  it("door-in-passage: a door in a passage of the map, or over the gate a tenement may paint", () => {
    const p = PASSAGES[0]!;
    expect(found([{ prop: "door", x: p.from.x, y: 0, z: p.from.z, yaw: 0, variant: doorVariant({ model: "steel", width: 1.2, height: 2.3 }) }])["door-in-passage"]).toBe(1);
    const bay = wall.bay;
    expect(found([doorAt(1.5 * bay, 1.2, 2.3)])["door-in-passage"]).toBe(1);
    // One wider than the gate, over all of it.
    expect(found([doorAt(1.5 * bay, 2.0, 2.3)])["door-in-passage"]).toBe(1);
  });

  it("door-on-game-door: a door beside the game's own (ADR-0038)", () => {
    expect(found([{ prop: "door", x: CLINIC_DOOR.at.x, y: 0, z: CLINIC_DOOR.at.z + 0.5, yaw: 0, variant: doorVariant({ model: "steel", width: 1.2, height: 2.3 }) }])["door-on-game-door"]).toBe(1);
  });
});
