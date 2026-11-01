import { describe, expect, it } from "vitest";
import { DRESS_FLAG, MeshSink, hexColor } from "../src/renderer/mesh-sink";
import { planNearBuilding } from "../src/renderer/mapcity/facade-plan";
import { ROOF_STYLE } from "../src/renderer/mapcity/facade-style";
import { type LandmarkFrame, landmarkAt, planFarLandmark, planLandmarkCables, planLandmarkSigns } from "../src/renderer/mapcity/landmarks";
import type { Wall } from "../src/renderer/mapcity/facade-frame";
import { gableOver, stringCourse } from "../src/renderer/mapcity/landmarks/classicist";
import { SWATCH, onWall } from "../src/renderer/mapcity/landmarks/kit";
import { cameraAlong, gableFace, litMouths, mouthWall, tabletOn, uplights } from "../src/renderer/mapcity/landmarks/landmark-plan";
import { sideOf } from "../src/renderer/mapcity/landmarks/layer2077";
import { pointInRing } from "../src/renderer/mapcity/polygon";
import { MAP_SIGN_KIND } from "../src/renderer/mapcity/sign-plan";
import { along, before, cityAround, colored, data, near3, onTheStreet, outside, passageOpen, points, ringsAround } from "./landmark-fixture";

/**
 * Brama Grodzka from the landmark kit (ADR-0062, stage 2): a plastered classicist gate house on
 * the data's solid, its passage open, the data's gabled roof, and the Old Town's subdued Lublin
 * 2077 layer on both fronts.
 */

const GATE = "w232362876";
const { near, frameOf } = cityAround(714.2, 141.3);
const gate = () => frameOf(GATE) as LandmarkFrame;
/** The outlines of the buildings round the gate in the data (Teatr NN, w66293322 and the rest). */
const nearby = ringsAround(714.2, 141.3, [GATE]);

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

  it("builds the classicist fronts: rustication to a string course over the arch, a keystone, one storey of large framed windows (two per front, the third axis would run into the neighbours)", () => {
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
      // The glass of the windows (0.06 m out) over the string course.
      const glass = on(SWATCH.opening, 0.06);
      const windows = glass.filter((p) => p.y < f.top);
      // One storey on the axes a neighbour leaves in sight: of three, the one behind Teatr NN (Grodzka's
      // front) and the one inside w66293322 (the castle's) are left out. Large windows, about 1 x 1.6 m.
      expect(windows.length / 4, side).toBe(2);
      for (const p of windows) expect(p.y).toBeGreaterThan(course + 0.3);
      expect(Math.max(...windows.map((p) => p.y)) - Math.min(...windows.map((p) => p.y)), side).toBeCloseTo(1.6, 2);
      const across = windows.map((p) => along(m.w, p)).sort((a, b) => a - b);
      expect(across[3]! - across[0]!, side).toBeGreaterThan(0.95);
      // The cornices over the windows (0.12 m out, under the main cornice), none behind a neighbour.
      for (const p of on(SWATCH.plasterTrim, 0.12).filter((q) => q.y < f.top - 0.6)) for (const r of nearby) expect(pointInRing(onWall(m.w, along(m.w, p), 0, 0.35), r), side).toBe(false);
      // The keystone stands proud of the arch's trim over the middle of the mouth.
      const key = on(SWATCH.plasterTrim, 0.08).filter((p) => p.y < course + 0.01 && p.y > m.top - 0.3);
      expect(key.length, side).toBe(4);
    }
  });

  it("takes one storey and the gables' faces from the recipe: a cartouche over the dated tablet over Grodzka, a lunette between blind niches towards the castle", () => {
    const f = gate();
    const front = f.landmark.part.tier.front!;
    expect(front.rows).toBe(1);
    expect(front.gables).toEqual({ old: "cartouche", new: "lunette" });
    expect(front.inscription).toBe("MDCCLXXXV");
    const sink = near3(f);
    const old = mouthWall(f, "old")!.w;
    const fresh = mouthWall(f, "new")!.w;
    expect(gableFace(f, old)).toBe("cartouche");
    expect(gableFace(f, fresh)).toBe("lunette");
    const inGable = (w: Wall, hex: string) => colored(sink, hex).filter((p) => p.y > f.top && Math.abs(before(w, p)) < 0.2);
    // Grodzka's gable: the cartouche's field and the tablet, no glass (no round window).
    expect(inGable(old, SWATCH.cartouche).length).toBeGreaterThan(10);
    expect(inGable(old, SWATCH.tablet).length).toBe(4);
    expect(inGable(old, SWATCH.opening).length).toBe(0);
    const t = tabletOn(f)!;
    expect(t.w).toBe(old);
    expect(t.text).toBe("MDCCLXXXV");
    // The castle's gable: a round-headed window (a head of more than one quad) between two blind niches.
    expect(inGable(fresh, SWATCH.cartouche).length).toBe(0);
    const glass = inGable(fresh, SWATCH.opening);
    expect(glass.length).toBeGreaterThan(4);
    const g = gableOver(f, fresh)!;
    for (const p of glass) expect(Math.abs(along(fresh, p) - g.u)).toBeLessThan(0.5);
    const niches = inGable(fresh, SWATCH.beigeNiche);
    expect(niches.filter((p) => along(fresh, p) < g.u - 1).length).toBeGreaterThan(4);
    expect(niches.filter((p) => along(fresh, p) > g.u + 1).length).toBeGreaterThan(4);
    // All of it within the gable: under the roof's line over each point, in front of the wall.
    for (const w of [old, fresh]) {
      const over = gableOver(f, w)!;
      const roofAt = (u: number) => {
        const s0 = u / w.length;
        for (let k = 0; k + 1 < over.line.length; k++) {
          const [a, ha] = over.line[k]!;
          const [b, hb] = over.line[k + 1]!;
          if (s0 >= a && s0 <= b) return over.y0 + ha + ((hb - ha) * (s0 - a)) / Math.max(b - a, 1e-9);
        }
        return over.y0;
      };
      for (const hex of [SWATCH.cartouche, SWATCH.tablet, SWATCH.opening, SWATCH.beigeNiche]) for (const p of inGable(w, hex)) expect(p.y).toBeLessThan(roofAt(along(w, p)) - 0.3);
    }
    // The year as an in-world sign on the tablet.
    const slots: string[] = [];
    planLandmarkSigns(new MeshSink(), f, (name) => slots.push(name) - 1);
    expect(slots).toEqual(["MDCCLXXXV"]);
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
    // One uplight at each mouth: the other's place lies in a neighbour (Teatr NN, w66293322).
    const lights = litMouths(f).map((m) => uplights(f, m).length);
    expect(lights).toEqual([1, 1]);
    expect(onTheStreet(f, sink, nearby)).toBe(2);
    // Signs: the uplights' beams only, one at each mouth, none in a neighbour; no screen, plaque, holo or strobe.
    const slots: string[] = [];
    const signs = new MeshSink();
    planLandmarkSigns(signs, f, (name) => slots.push(name) - 1);
    // The year on the tablet is the only text; the rest are the uplights' beams.
    expect(slots).toEqual(["MDCCLXXXV"]);
    const kinds = points(signs).map((p) => Math.round(p.v2));
    expect(new Set(kinds)).toEqual(new Set([MAP_SIGN_KIND.beam, MAP_SIGN_KIND.name]));
    expect(kinds.filter((k) => k === MAP_SIGN_KIND.beam).length / 4).toBe(2);
    for (const p of points(signs)) for (const r of nearby) expect(pointInRing(p, r)).toBe(false);
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
