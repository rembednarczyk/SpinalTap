import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { type LandmarkFrame, isLandmarkFrame, landmarkAt, planFarLandmark, planLandmarkSigns } from "../src/renderer/mapcity/landmarks";
import { SWATCH } from "../src/renderer/mapcity/landmarks/kit";
import { mouthWall } from "../src/renderer/mapcity/landmarks/landmark-plan";
import { LANDMARK_TEXTS } from "../src/renderer/mapcity/landmarks/recipes";
import { along, before, cityAround, colored, crosses, data, near3, outside, passageOpen, points } from "./landmark-fixture";

/**
 * Zamek Lubelski from the landmark kit (ADR-0062 stage 5, G-841, T-112): the neo-Gothic west
 * front over Plac Zamkowy after the user's photograph (Street View 2025) and the curator's audit
 * (`docs/plany/zamek-lubelski.md`): cream plaster, an attic with battlements over the outer
 * walls up to NMPT's crown, the gate's risalit between two turrets with dark spires, its stepped
 * parapet, two rose windows over the pointed portal, rows of lancets.
 */

const CASTLE = "w48500136";
const { near, frameOf } = cityAround(887.6, 234);
const castle = () => frameOf(CASTLE) as LandmarkFrame;
/** The two short runs of the outline either side of the gate's wall (OSM's turrets), their centroids. */
const TURRETS = [
  { x: 836.8, z: 245.2 },
  { x: 836.4, z: 230.3 },
];

describe("Zamek Lubelski from the landmark kit (G-841)", () => {
  it("finds its recipe for the castle and for no neighbour (the Donżon and the chapel keep theirs)", () => {
    const b = data(CASTLE);
    expect(landmarkAt(b.x, b.z, b.outline.length / 2)?.recipe.key).toBe("zamek-lubelski");
    expect(near.filter((o) => landmarkAt(o.x, o.z, o.outline.length / 2)?.recipe.key === "zamek-lubelski").map((o) => o.id)).toEqual([CASTLE]);
  });

  it("has NMPT's heights in the data: eaves towards the courtyard at y 3.3, the outer walls' crown at y 7.5", () => {
    const d = data(CASTLE);
    expect(d.y + d.height).toBeGreaterThan(3.1);
    expect(d.y + d.height).toBeLessThan(3.5);
    expect(d.y + d.height + d.roof!).toBeGreaterThan(7.3);
    expect(d.y + d.height + d.roof!).toBeLessThan(7.7);
  });

  it("paints the walls in cream plaster (building:colour=beige) with lighter trim", () => {
    const f = castle();
    expect(isLandmarkFrame(f)).toBe(true);
    expect(f.style.plaster).toBe(SWATCH.ivory);
    expect(colored(near3(f), SWATCH.plasterTrim).length).toBeGreaterThan(200);
  });

  it("raises an attic with battlements over the outer walls to the crown and keeps the courtyard open", () => {
    const f = castle();
    const d = data(CASTLE);
    const crown = d.y + d.height + d.roof!;
    const sink = near3(f);
    const pts = points(sink);
    // Merlons along the north wing's west wall (842.0, 263.9)-(840.3, 245.5): boxes over the walk.
    const wing = f.walls.find((w) => Math.abs(w.a.x - 842) < 0.2 && Math.abs(w.a.z - 263.9) < 0.2)!;
    const top = pts.filter((p) => p.y > crown - 0.05 && p.y < crown + 0.05 && Math.abs(before(wing, p)) < 0.5 && along(wing, p) > 0 && along(wing, p) < wing.length);
    const merlons = new Set(top.map((p) => Math.round(along(wing, p) / 0.5)));
    expect(merlons.size).toBeGreaterThan(10);
    // The courtyard (y -7.3) under the open sky: no slab of the roof fanned over the C outline.
    for (const q of [
      { x: 870, z: 235 },
      { x: 900, z: 230 },
      { x: 920, z: 225 },
    ]) {
      expect(crosses(sink, { ...q, y: -5 }, { ...q, y: 30 }), `${q.x}, ${q.z}`).toBe(false);
    }
    // Within the outline (a cornice's depth) but the turrets, rounder than OSM's small steps.
    for (const p of pts) if (TURRETS.every((t) => Math.hypot(p.x - t.x, p.z - t.z) > 2.2)) expect(outside(f.b.ring, p), `${p.x}, ${p.z}`).toBeLessThan(0.6);
  });

  it("stands two turrets with merlons either side of the gate to NMPT's flat tops (y 12.0-12.4), dark spires to about y 15.5", () => {
    const f = castle();
    const d = data(CASTLE);
    const crown = d.y + d.height + d.roof!;
    // Over the parapet's peaks (y 10.0-10.4): the turrets and their spires only.
    const high = points(near3(f)).filter((p) => p.y > crown + 3.2);
    expect(high.length).toBeGreaterThan(50);
    for (const p of high) expect(Math.min(...TURRETS.map((t) => Math.hypot(p.x - t.x, p.z - t.z))), `${p.x}, ${p.z}`).toBeLessThan(2.8);
    for (const t of TURRETS) {
      const body = high.filter((p) => Math.hypot(p.x - t.x, p.z - t.z) > 1.2 && Math.hypot(p.x - t.x, p.z - t.z) < 2.8);
      expect(Math.max(...body.map((p) => p.y))).toBeGreaterThan(12);
      expect(Math.max(...body.map((p) => p.y))).toBeLessThan(12.4);
      // The spire with its pennant: dark metal, no flag in colours.
      const spire = colored(near3(f), SWATCH.metal).filter((p) => Math.hypot(p.x - t.x, p.z - t.z) < 0.7 && p.y > crown + 3.2);
      expect(Math.max(...spire.map((p) => p.y))).toBeGreaterThan(15.2);
      expect(Math.max(...spire.map((p) => p.y))).toBeLessThan(15.8);
      expect(colored(near3(f), "#d4213d").some((p) => Math.hypot(p.x - t.x, p.z - t.z) < 2)).toBe(false);
    }
  });

  it("draws the risalit's stepped parapet, two rose windows over a pointed portal, and keeps the passage open", () => {
    const f = castle();
    const gate = mouthWall(f, "old")!;
    expect(gate.w.nx).toBeLessThan(-0.9);
    const sink = near3(f);
    const mid = (gate.u0 + gate.u1) / 2;
    const roses = colored(sink, SWATCH.rose).filter((p) => Math.abs(before(gate.w, p)) < 0.2);
    expect(roses.some((p) => along(gate.w, p) < mid - 1.5)).toBe(true);
    expect(roses.some((p) => along(gate.w, p) > mid + 1.5)).toBe(true);
    expect(Math.min(...roses.map((p) => p.y))).toBeGreaterThan(gate.top + 2);
    // The portal's head rises over the passage's mouth, the passage itself stays open.
    const head = colored(sink, SWATCH.plasterTrim).filter((p) => Math.abs(before(gate.w, p)) < 0.2 && Math.abs(along(gate.w, p) - mid) < 0.3);
    expect(Math.max(...head.map((p) => p.y))).toBeGreaterThan(gate.top + 2);
    expect(passageOpen(sink, f)).toEqual([]);
    // Triangular merlons: the parapet's peaks between the turrets at NMPT's y 10.0-10.4.
    const peaks = points(sink).filter((p) => Math.abs(before(gate.w, p)) < 0.6 && along(gate.w, p) > 1.5 && along(gate.w, p) < gate.w.length - 1.5);
    expect(peaks.filter((p) => p.y > 10).length).toBeGreaterThan(5);
    expect(Math.max(...peaks.map((p) => p.y))).toBeLessThan(10.4);
    // Rose windows of about 1.7 m radius: their dark glass spans over 3 m.
    const left = roses.filter((p) => along(gate.w, p) < mid);
    expect(Math.max(...left.map((p) => p.y)) - Math.min(...left.map((p) => p.y))).toBeGreaterThan(3.2);
  });

  it("puts one row of lancets on the wings, round windows about 10 m over the forecourt and a frieze of arcades under the crown, and the museum's sign over the gate", () => {
    const f = castle();
    const sink = near3(f);
    // The gate's floor at the west mouth (the first doorway of the data).
    const floor = f.b.doorways![0]!.bottom;
    const d = data(CASTLE);
    const crown = d.y + d.height + d.roof!;
    const wing = f.walls.find((w) => Math.abs(w.a.x - 842) < 0.2 && Math.abs(w.a.z - 263.9) < 0.2)!;
    const glass = colored(sink, SWATCH.opening).filter((p) => Math.abs(before(wing, p)) < 0.1);
    const lancets = glass.filter((p) => p.y < floor + 5);
    expect(new Set(lancets.map((p) => Math.round(along(wing, p)))).size).toBeGreaterThan(2);
    // Nothing dark between the lancets and the round windows (no second row), the round windows at 10 m.
    expect(glass.filter((p) => p.y > floor + 5 && p.y < floor + 9.4)).toEqual([]);
    const round = glass.filter((p) => p.y >= floor + 9.4);
    expect(round.length).toBeGreaterThan(0);
    expect(Math.max(...round.map((p) => p.y))).toBeLessThan(floor + 10.6);
    const frieze = colored(sink, SWATCH.ivoryNiche).filter((p) => Math.abs(before(wing, p)) < 0.1 && p.y > crown - 2);
    expect(new Set(frieze.map((p) => Math.round(along(wing, p) / 0.9))).size).toBeGreaterThan(10);
    expect(LANDMARK_TEXTS).toContain("MUZEUM");
    const slots: string[] = [];
    planLandmarkSigns(new MeshSink(), f, (name) => slots.push(name) - 1);
    expect(slots).toContain("MUZEUM");
  });

  it("draws the far solid with the attic and the turrets, no roof over the courtyard", () => {
    const f = castle();
    const d = data(CASTLE);
    const far = new MeshSink();
    planFarLandmark(far, f);
    expect(Math.max(...points(far).map((p) => p.y))).toBeGreaterThan(d.y + d.height + d.roof! + 2);
    expect(crosses(far, { x: 870, y: -5, z: 235 }, { x: 870, y: 30, z: 235 })).toBe(false);
  });
});
