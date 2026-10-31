import { describe, expect, it } from "vitest";
import { DRESS_FLAG, MeshSink, hexColor } from "../src/renderer/mesh-sink";
import { planNearBuilding } from "../src/renderer/mapcity/facade-plan";
import { ROOF_STYLE } from "../src/renderer/mapcity/facade-style";
import { type LandmarkFrame, landmarkAt, planFarLandmark, planLandmarkCables, planLandmarkSigns } from "../src/renderer/mapcity/landmarks";
import { stringCourse } from "../src/renderer/mapcity/landmarks/classicist";
import { SWATCH } from "../src/renderer/mapcity/landmarks/kit";
import { cameraAlong, mouthWall } from "../src/renderer/mapcity/landmarks/landmark-plan";
import { sideOf } from "../src/renderer/mapcity/landmarks/layer2077";
import type { Wall } from "../src/renderer/mapcity/facade-frame";
import { MAP_SIGN_KIND } from "../src/renderer/mapcity/sign-plan";
import { cityAround, colored, data, near3, outside, passageOpen, points } from "./landmark-fixture";

/**
 * Brama Grodzka from the landmark kit (ADR-0062, stage 2): a plastered classicist gate house on
 * the data's solid, its passage open, the data's gabled roof, and the Old Town's subdued Lublin
 * 2077 layer on both fronts.
 */

const GATE = "w232362876";
const { near, frameOf } = cityAround(714.2, 141.3);
const gate = () => frameOf(GATE) as LandmarkFrame;

/** Signed distance of a point in front of a wall's plane. */
const before = (w: Wall, p: { x: number; z: number }): number => (p.x - w.a.x) * w.nx + (p.z - w.a.z) * w.nz;

describe("Brama Grodzka from the landmark kit (ADR-0062)", () => {
  it("finds its recipe by the data's position for the gate and for no other building, Teatr NN next door included", () => {
    const b = data(GATE);
    expect(b.name).toBe("Brama Grodzka");
    expect(landmarkAt(b.x, b.z, b.outline.length / 2)?.part.osm).toBe(GATE);
    const nn = data("w66293331");
    expect(landmarkAt(nn.x, nn.z, nn.outline.length / 2)).toBeNull();
    expect(near.filter((o) => landmarkAt(o.x, o.z, o.outline.length / 2)).map((o) => o.id)).toEqual([GATE]);
  });

  it("keeps the gate within its outline (a cornice's depth and the eaves) and under the data's peak, the roof reaching it", () => {
    const f = gate();
    const d = data(GATE);
    const peak = d.y + d.height + d.roof!;
    expect(f.top + f.b.roof!).toBeCloseTo(peak, 6);
    const pts = points(near3(f));
    const foot = Math.min(f.b.foot, ...(f.b.passages ?? []).flatMap((p) => p.floor));
    expect(pts.length).toBeGreaterThan(500);
    for (const p of pts) {
      expect(outside(f.b.ring, p)).toBeLessThan(0.6);
      expect(p.y).toBeGreaterThan(foot - 0.45);
      expect(p.y).toBeLessThanOrEqual(peak + 1e-6);
    }
    expect(Math.max(...pts.map((p) => p.y))).toBeGreaterThan(peak - 0.15);
  });

  it("gives it no window grid of the tenements and no superstructure, and the data's gabled roof in tiles", () => {
    const plain = new MeshSink();
    planNearBuilding(plain, frameOf(GATE, false));
    expect(points(plain).some((p) => p.u2 > 0)).toBe(true);
    const f = gate();
    expect(f.b.rise ?? 0).toBe(0);
    expect(f.b.roofShape).toBe("gabled");
    const kit = points(near3(f));
    expect(kit.every((p) => p.u2 === 0)).toBe(true);
    const roof = kit.filter((p) => p.v2 >= ROOF_STYLE);
    expect(roof.length).toBeGreaterThan(6);
    for (const p of roof) expect(p.y).toBeGreaterThan(f.top - 0.1);
    // A gable: the ridge runs along the passage, so both fronts (the passage's ends) stand up into the roof.
    for (const side of ["old", "new"] as const) {
      const m = mouthWall(f, side)!;
      const gable = colored(near3(f), SWATCH.beige).filter((p) => p.y > f.top + 1 && Math.abs(before(m.w, p)) < 0.02);
      expect(gable.length, side).toBeGreaterThan(0);
    }
  });

  it("leaves the passage open from mouth to mouth under its vault", () => {
    const f = gate();
    expect(f.b.passages?.length).toBe(1);
    expect(passageOpen(near3(f), f)).toEqual([]);
  });

  it("builds the classicist fronts: rustication to a string course over the arch, a keystone, two rows of three framed windows, a round gable window", () => {
    const f = gate();
    const sink = near3(f);
    const course = stringCourse(f);
    const crown = Math.max(...(f.b.passages ?? []).map((p) => p.crown));
    expect(course).toBeCloseTo(crown + 0.5, 6);
    const joints = colored(sink, SWATCH.beigeJoint);
    expect(joints.length).toBeGreaterThan(40);
    for (const p of joints) expect(p.y).toBeLessThan(course);
    for (const side of ["old", "new"] as const) {
      const m = mouthWall(f, side)!;
      const on = (hex: string, out: number) => colored(sink, hex).filter((p) => Math.abs(before(m.w, p) - out) < 1e-3);
      // The glass of the windows (0.06 m out) over the string course, the round window over the eaves.
      const glass = on(SWATCH.opening, 0.06);
      const windows = glass.filter((p) => p.y < f.top);
      expect(windows.length / 4, side).toBe(6);
      for (const p of windows) expect(p.y).toBeGreaterThan(course + 0.3);
      expect(glass.filter((p) => p.y > f.top).length, side).toBeGreaterThanOrEqual(12);
      // The windows' middle axis over the arch, as near as the wall's ends let it.
      const along = (p: { x: number; z: number }) => ((p.x - m.w.a.x) * (m.w.b.x - m.w.a.x) + (p.z - m.w.a.z) * (m.w.b.z - m.w.a.z)) / m.w.length;
      expect(Math.abs(windows.reduce((s, p) => s + along(p), 0) / windows.length - (m.u0 + m.u1) / 2), side).toBeLessThan(0.5);
      // The keystone stands proud of the arch's trim over the middle of the mouth.
      const key = on(SWATCH.plasterTrim, 0.08).filter((p) => p.y < course + 0.01 && p.y > m.top - 0.3);
      expect(key.length, side).toBe(4);
    }
  });

  it("lays the Old Town's subdued layer on both fronts: thin warm lines, uplights at both mouths, one camera, no neon or screens", () => {
    const f = gate();
    const sink = near3(f);
    const lit = points(sink).filter((p) => p.a === DRESS_FLAG.lit);
    expect(lit.length).toBeGreaterThan(0);
    const [r, g, b] = hexColor("#ffc98a");
    const warm = points(sink).filter((_, i) => sink.colors[i * 4 + 3] === DRESS_FLAG.lit && Math.abs(sink.colors[i * 4]! - r) < 1e-4 && Math.abs(sink.colors[i * 4 + 1]! - g) < 1e-4 && Math.abs(sink.colors[i * 4 + 2]! - b) < 1e-4);
    // Everything lit is warm but the camera's red light.
    expect(warm.length).toBeGreaterThan(0);
    expect(lit.length - warm.length).toBe(colored(sink, "#ff3030").length);
    expect(colored(sink, "#ff2e88").length).toBe(0);
    // One camera, on the Old Town's (Grodzka's) front.
    const cam = colored(sink, "#3a3f47");
    expect(cam.length).toBeGreaterThan(0);
    const old = mouthWall(f, "old")!;
    expect(sideOf(old.w, f.landmark.recipe.layer)).toBe("old");
    // Beside the arch's head, on the side of the mouth clear of the corner and the neighbour.
    const u = cameraAlong(old);
    expect(u < old.u0 - 0.5 || u > old.u1 + 0.5).toBe(true);
    expect(u).toBeGreaterThan(0.8);
    expect(u).toBeLessThan(old.w.length - 0.8);
    for (const p of cam) {
      expect(before(old.w, p)).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(old.top);
      expect(Math.hypot(p.x - cam[0]!.x, p.z - cam[0]!.z)).toBeLessThan(0.6);
    }
    // No cables; the uplights stand on the street at each mouth (Grodzka 2.4 m over the castle's side).
    const cables = new MeshSink();
    planLandmarkCables(cables, f);
    expect(cables.vertexCount).toBe(0);
    const metal = colored(sink, SWATCH.metal);
    for (const side of ["old", "new"] as const) {
      const m = mouthWall(f, side)!;
      const at = metal.filter((p) => before(m.w, p) > 0.05);
      expect(at.length, side).toBeGreaterThan(0);
      expect(Math.min(...at.map((p) => p.y)), side).toBeCloseTo(m.ground, 1);
    }
    expect(mouthWall(f, "old")!.ground - mouthWall(f, "new")!.ground).toBeGreaterThan(2);
    // Signs: the uplights' beams only, two at each mouth; no screen, plaque, holo or strobe.
    const slots: string[] = [];
    const signs = new MeshSink();
    planLandmarkSigns(signs, f, (name) => slots.push(name) - 1);
    expect(slots).toEqual([]);
    const kinds = points(signs).map((p) => Math.round(p.v2));
    expect(new Set(kinds)).toEqual(new Set([MAP_SIGN_KIND.beam]));
    expect(kinds.length / 4).toBe(4);
  });

  it("has a smaller far version with the solid, the gabled roof and the warm cornice lines", () => {
    const f = gate();
    const far = new MeshSink();
    planFarLandmark(far, f);
    expect(far.vertexCount).toBeGreaterThan(0);
    expect(far.vertexCount).toBeLessThan(near3(f).vertexCount / 3);
    const pts = points(far);
    expect(pts.some((p) => p.v2 >= ROOF_STYLE && p.y > f.top + 3)).toBe(true);
    expect(pts.some((p) => p.a === DRESS_FLAG.lit)).toBe(true);
  });
});
