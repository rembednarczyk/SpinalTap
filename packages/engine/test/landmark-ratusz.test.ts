import { describe, expect, it } from "vitest";
import { groundY } from "@seki/sim";
import { COLUMN_TOP, porticoOf } from "@seki/sim/lublin";
import { MeshSink } from "../src/renderer/mesh-sink";
import { planNearFrames } from "../src/renderer/mapcity/cell-plan";
import { ROOF_STYLE } from "../src/renderer/mapcity/facade-style";
import { type LandmarkFrame, isLandmarkFrame, landmarkAt, planLandmarkSigns } from "../src/renderer/mapcity/landmarks";
import { SWATCH } from "../src/renderer/mapcity/landmarks/kit";
import { clockWalls } from "../src/renderer/mapcity/landmarks/landmark-plan";
import { balconyFloor, palaceAxes, palaceRows } from "../src/renderer/mapcity/landmarks/palace";
import { BALUSTRADE, porticoOn } from "../src/renderer/mapcity/landmarks/portico";
import { along, before, cityAround, colored, crosses, data, near3, points } from "./landmark-fixture";

/**
 * Nowy Ratusz from the landmark kit (ADR-0062, G-119, T-067; G-117): the palace front with a
 * portico over Plac Łokietka, the risalit's block over the wings' roof and the tower with its
 * clocks and copper helmet, after the user's photographs (Lublin360 2017, Street View 2025).
 */

const HALL = "w66264120";
const RISALIT = "w619138853";
const TOWER = "w619138854";
const { near, frameOf } = cityAround(416.1, -69.6);
const hall = () => frameOf(HALL) as LandmarkFrame;

/** The near mesh of a building as the cell plans it: from its recipe, else from the facade plan. */
const cell = (id: string): MeshSink => {
  const sink = new MeshSink();
  planNearFrames(sink, [frameOf(id)], true, undefined, () => []);
  return sink;
};

describe("Nowy Ratusz from the landmark kit (G-119)", () => {
  it("finds its recipe for the hall, the risalit's block and the tower, and for no neighbour", () => {
    for (const id of [HALL, RISALIT, TOWER]) {
      const b = data(id);
      expect(landmarkAt(b.x, b.z, b.outline.length / 2)?.recipe.key, id).toBe("nowy-ratusz");
    }
    expect(near.filter((o) => landmarkAt(o.x, o.z, o.outline.length / 2)?.recipe.key === "nowy-ratusz").map((o) => o.id).sort()).toEqual([HALL, RISALIT, TOWER].sort());
  });

  it("keeps the wings' roof under the risalit's block, so the block stands over it (G-117)", () => {
    const block = frameOf(RISALIT);
    const sink = cell(HALL);
    expect(points(sink).some((p) => p.v2 >= ROOF_STYLE)).toBe(true);
    // Nothing of the hall over the block's outline from a metre under its top up: its walls show
    // over the roof by a storey of round-headed windows (before: the roof rose to 22.4 over 20.3).
    const c = block.b.ring.reduce((a, p) => ({ x: a.x + p.x / 4, z: a.z + p.z / 4 }), { x: 0, z: 0 });
    for (const p of block.b.ring) {
      for (const t of [0, 0.5, 0.9]) {
        const q = { x: c.x + (p.x - c.x) * t, z: c.z + (p.z - c.z) * t };
        expect(crosses(sink, { ...q, y: block.top - 1 }, { ...q, y: block.top + 20 }), `${q.x}, ${q.z}`).toBe(false);
      }
    }
    // The red roof of the data, low as on the photographs.
    expect(colored(sink, SWATCH.tile).length).toBeGreaterThan(0);
  });

  it("paints the walls in sand plaster with cream detail (building:colour=yellow, G-118)", () => {
    for (const id of [HALL, RISALIT]) {
      const f = frameOf(id);
      expect(isLandmarkFrame(f), id).toBe(true);
      expect(f.style.plaster, id).toBe(SWATCH.sand);
      expect(colored(cell(id), SWATCH.cream).length, id).toBeGreaterThan(50);
    }
  });

  it("stands a giant order of four columns through the ground and first floors, the balcony before the second's at about 10 m (NMPT)", () => {
    const f = hall();
    const po = porticoOn(f)!;
    expect(po).not.toBeNull();
    expect(po.w.nz).toBeLessThan(-0.9);
    const palace = f.landmark.part.tier.palace!;
    const { rows } = palaceRows(f, palace);
    const course = balconyFloor(f, palace);
    // On the first floor's top, under the second floor's windows; NMPT 9.6-11.0 m before the front.
    expect(course).toBeCloseTo(rows[1]![1], 6);
    expect(course - data(HALL).y).toBeGreaterThan(9.6);
    expect(course - data(HALL).y).toBeLessThan(11);
    // The columns' solids reach the balcony.
    expect(Math.abs(data(HALL).y + COLUMN_TOP - course)).toBeLessThan(0.3);
    const sink = near3(f);
    const cream = colored(sink, SWATCH.cream);
    for (const c of porticoOf(HALL)!.columns) {
      // A shaft round the axis from the ground up to the entablature under the balcony.
      const shaft = cream.filter((p) => Math.hypot(p.x - c.x, p.z - c.z) < 0.8);
      expect(Math.min(...shaft.map((p) => p.y))).toBeLessThan(groundY(c.x, c.z) + 0.6);
      expect(Math.max(...shaft.map((p) => p.y))).toBeGreaterThan(course - 0.8);
    }
    // The balustrade over the balcony's floor, at the front past the columns.
    const rail = colored(sink, SWATCH.plasterTrim).filter((p) => p.y > course + BALUSTRADE.rail - 0.15 && p.y < course + BALUSTRADE.rail + 0.05);
    expect(rail.some((p) => before(po.w, p) > po.p.out)).toBe(true);
  });

  it("puts round-headed windows on the first floor and none on the ground floor in the door's bay", () => {
    const f = hall();
    const po = porticoOn(f)!;
    const pitch = f.landmark.part.tier.palace!.pitch;
    const ground = palaceAxes(po.w, po, pitch, 0);
    const first = palaceAxes(po.w, po, pitch, 1);
    expect(first.length).toBe(ground.length + 1);
    const d = { x: 415.08, z: -84.95 };
    expect(Math.min(...ground.map((u) => Math.abs(u - along(po.w, d))))).toBeGreaterThan(1.2);
    expect(Math.min(...first.map((u) => Math.abs(u - along(po.w, d))))).toBeLessThan(0.6);
    expect(colored(near3(f), SWATCH.sandPanel).length).toBeGreaterThan(0);
    // The landmark draws its own main door there, where the OSM entrance and the furniture's door were.
    const leaves = colored(near3(f), SWATCH.door);
    expect(leaves).toHaveLength(4);
    expect(Math.abs(leaves.reduce((a, p) => a + along(po.w, p), 0) / 4 - along(po.w, d))).toBeLessThan(0.6);
  });

  it("raises five flags over the balcony and signs the portico with the data's name", () => {
    const f = hall();
    expect(f.landmark.recipe.layer.flags).toHaveLength(5);
    const slots: string[] = [];
    planLandmarkSigns(new MeshSink(), f, (name) => slots.push(name) - 1);
    expect(slots).toEqual([data(HALL).name]);
    expect(colored(near3(f), "#1f3f99").length).toBe(8);
    // Its light letters stand on a dark tablet on the entablature: on cream they would not show.
    expect(colored(near3(f), SWATCH.tablet)).toHaveLength(4);
  });

  it("gives the tower GUGiK's heights (body 30.5 m, peak 38 m), a 4 m clock storey towards the plaza and the yards, a copper one and the helmet", () => {
    const f = frameOf(TOWER) as LandmarkFrame;
    const d = data(TOWER);
    const { neon, old } = clockWalls(f);
    expect(neon!.nz).toBeLessThan(-0.9);
    expect(old!.nz).toBeGreaterThan(0.9);
    const sink = near3(f);
    expect(colored(sink, SWATCH.patina).length).toBeGreaterThan(20);
    // NMPT over the tower: body 29.6-31.8 m, spire 38.2 m; LoD2 37.7 m (was 25.1 and 28.1).
    expect(f.top - d.y).toBeGreaterThan(29.6);
    expect(f.top - d.y).toBeLessThan(31.8);
    const peak = Math.max(...points(sink).map((p) => p.y));
    expect(peak - d.y).toBeGreaterThan(37.5);
    expect(peak - d.y).toBeLessThan(38.5);
    expect(f.landmark.part.tier.split).toBe(4);
    expect(f.top - f.b.foot - 4).toBeGreaterThan(5.5);
    // The bell shows over the cornice from the plaza: over 2 m of it at more than half the tower's radius.
    const bell = colored(sink, SWATCH.patina).filter((p) => p.y > f.top + 2 && Math.hypot(p.x - 415, p.z + 79.3) > 1.1);
    expect(bell.length).toBeGreaterThan(0);
  });
});
