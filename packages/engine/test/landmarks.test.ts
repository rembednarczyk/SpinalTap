import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { LUBLIN_CHUNKS } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { RawTexture, Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { DRESS_FLAG, MeshSink } from "../src/renderer/mesh-sink";
import { planNearBuilding } from "../src/renderer/mapcity/facade-plan";
import { ROOF_STYLE } from "../src/renderer/mapcity/facade-style";
import { type LandmarkFrame, landmarkAt, planFarLandmark, planLandmarkSigns } from "../src/renderer/mapcity/landmarks";
import { cableRuns, planLandmarkCables } from "../src/renderer/mapcity/landmarks/cables";
import { GALLERY } from "../src/renderer/mapcity/landmarks/elevation";
import { landmarkIndex } from "../src/renderer/mapcity/landmarks/match";
import { SWATCH, helmBase, helmProfile } from "../src/renderer/mapcity/landmarks/kit";
import { clockSpot, clockWalls, mouthWall, screenOn } from "../src/renderer/mapcity/landmarks/landmark-plan";
import { facing } from "../src/renderer/mapcity/landmarks/layer2077";
import { MapCity } from "../src/renderer/mapcity/map-city";
import { type P2, centroid, pointInRing } from "../src/renderer/mapcity/polygon";
import { MAP_SIGN_KIND } from "../src/renderer/mapcity/sign-plan";
import { cityAround, colored, data, near3, onTheStreet, outside, passageOpen, points, ringOf, ringsAround, scenery } from "./landmark-fixture";

/**
 * Brama Krakowska from the landmark kit (ADR-0062, stage 1): the recipe's detail stays in the
 * solid the map data gives (up to a cornice), replaces the tenements' windows, roofs and towers,
 * leaves the gate's passage open under its vault and has a smaller far version.
 */

const GATE = ["r7224409", "w617597407", "w617878341"] as const;

/** Every building of the data within 40 m of the gate, for the walls' neighbours. */
const { near, items, frameOf } = cityAround(472.6, -91.2);

describe("Brama Krakowska from the landmark kit (ADR-0062)", () => {
  it("finds its recipe by the data's position for the gate, its tower and octagon, and for no other building", () => {
    for (const id of GATE) {
      const b = data(id);
      expect(landmarkAt(b.x, b.z, b.outline.length / 2)?.part.osm).toBe(id);
    }
    const jezuicka = data("w66286384");
    expect(landmarkAt(jezuicka.x, jezuicka.z, jezuicka.outline.length / 2)).toBeNull();
    expect(near.filter((b) => landmarkAt(b.x, b.z, b.outline.length / 2)).length).toBe(GATE.length);
  });

  it("keeps every part within its outline (a cornice's depth) and between its foot and the data's top and roof", () => {
    for (const id of GATE) {
      const f = frameOf(id);
      const roof = f.b.roof ?? 0;
      const peak = f.top + (id === "r7224409" ? 0.06 : roof);
      const pts = points(near3(f));
      // The passage's lining reaches under its floor, which the street outside sets.
      const foot = Math.min(f.b.foot, ...(f.b.passages ?? []).flatMap((p) => p.floor));
      expect(pts.length).toBeGreaterThan(100);
      for (const p of pts) {
        expect(outside(f.b.ring, p)).toBeLessThan(0.6);
        expect(p.y).toBeGreaterThan(foot - 0.45);
        expect(p.y).toBeLessThanOrEqual(peak + 1e-6);
      }
      // The helmet fills the data's roof: its mast's warning light is the gate's peak.
      if (id === "w617878341") expect(Math.max(...pts.map((p) => p.y))).toBeGreaterThan(peak - 0.05);
    }
  });

  it("gives no part the window grid, a tiled roof, a superstructure or procedural towers", () => {
    for (const id of GATE) {
      const plain = new MeshSink();
      planNearBuilding(plain, frameOf(id, false));
      const kit = points(near3(frameOf(id)));
      // Walls with storeys and bays (windows) carry uv2.x > 0; roofs the roof style.
      expect(kit.every((p) => p.u2 === 0)).toBe(true);
      expect(kit.every((p) => p.v2 < ROOF_STYLE)).toBe(true);
      expect(points(plain).some((p) => p.u2 > 0 || p.v2 >= ROOF_STYLE)).toBe(true);
    }
  });

  it("leaves the passage open from mouth to mouth under the vault's springing and up to its crown on the axis", () => {
    const f = frameOf("r7224409");
    const p = f.b.passages![0]!;
    const floor = Math.max(p.floor[0], p.floor[1]);
    expect(passageOpen(near3(f), f)).toEqual([]);
    // The crown is the one from `sites.ts`: 4.2 m over the higher floor.
    expect(p.crown - floor).toBeCloseTo(4.2, 6);
  });

  it("has a smaller far version with the solid, the helmet and the lit elements", () => {
    for (const id of GATE) {
      const f = frameOf(id) as LandmarkFrame;
      const far = new MeshSink();
      planFarLandmark(far, f);
      expect(far.vertexCount).toBeGreaterThan(0);
      expect(far.vertexCount).toBeLessThan(near3(f).vertexCount);
      if (id === "w617878341") expect(points(far).some((p) => p.a === DRESS_FLAG.lit && p.y > f.top + 1)).toBe(true);
    }
  });

  it("puts the museum's plaque and the screen on the gate's west front, the holo clock on the octagon", () => {
    const slots: string[] = [];
    const slot = (name: string) => slots.push(name) - 1;
    const signs = new MeshSink();
    for (const id of GATE) planLandmarkSigns(signs, frameOf(id) as LandmarkFrame, slot);
    expect(slots).toEqual(["Muzeum Historii Miasta Lublina", "STARE MIASTO 旧市街"]);
    const kinds = new Set(points(signs).map((p) => Math.round(p.v2)));
    for (const k of [MAP_SIGN_KIND.name, MAP_SIGN_KIND.holo, MAP_SIGN_KIND.beam, MAP_SIGN_KIND.strobe]) expect(kinds.has(k)).toBe(true);
    // The names hang on the west (Krakowskie Przedmieście) side of the gate, facing it.
    const west = (frameOf("r7224409") as LandmarkFrame).landmark.recipe.layer.newTown;
    const names = points(signs).flatMap((p, i) => (Math.round(p.v2) === MAP_SIGN_KIND.name ? [signs.normals[i * 3]! * west.x + signs.normals[i * 3 + 2]! * west.z] : []));
    expect(names.length).toBe(8);
    for (const k of names) expect(k).toBeGreaterThan(0.9);
  });

  it("builds the brick after the photograph: zendrówki, small windows, battlements over white panels, stone buttresses (T-033)", () => {
    const annex = frameOf("r7224409") as LandmarkFrame;
    const tower = frameOf("w617597407") as LandmarkFrame;
    for (const f of [annex, tower]) {
      const sink = near3(f);
      // No white blind niches; dark headers in bands both ways on every shown wall.
      expect(colored(sink, SWATCH.niche).length).toBe(0);
      expect(colored(sink, SWATCH.header).length).toBeGreaterThan(200);
    }
    // Two or three small windows on each of the tower's long walls, none on the annex.
    const glass = colored(near3(tower), SWATCH.opening).filter((p) => p.y < tower.top - 0.6);
    for (const w of tower.walls.filter((x) => x.length > 6)) {
      const on = glass.filter((p) => Math.abs((p.x - w.a.x) * w.nx + (p.z - w.a.z) * w.nz - 0.035) < 1e-3);
      expect(on.length / 4).toBeGreaterThanOrEqual(w === screenOn(tower)?.w ? 1 : 2);
      expect(on.length / 4).toBeLessThanOrEqual(3);
    }
    expect(colored(near3(annex), SWATCH.opening).length).toBe(0);
    // Battlements: merlons up to the data's top over the free walls, with crenels down to a metre under it.
    const pts = points(near3(annex));
    const d = data("r7224409");
    expect(annex.top - d.y).toBeCloseTo(10, 6);
    const front = mouthWall(annex, "new")!.w;
    const onFront = (y: number) => pts.filter((p) => Math.abs(p.y - y) < 0.05 && Math.abs((p.x - front.a.x) * front.nx + (p.z - front.a.z) * front.nz) < 0.02);
    expect(onFront(annex.top).length).toBeGreaterThanOrEqual(8);
    expect(onFront(annex.top - 1).length).toBeGreaterThanOrEqual(8);
    // Two rows of white panels: about 8.5 m under the battlements and half way up (T-033).
    const white = colored(near3(annex), SWATCH.plasterTrim);
    for (const y of [8.5, 5]) expect(white.filter((p) => Math.abs(p.y - annex.b.foot - y) < 0.2).length / 4).toBeGreaterThanOrEqual(2);
    // Stone buttresses: battered on the west corner blocks, about 6 m (0.6 of the annex), within the cornice's depth.
    const stone = colored(near3(annex), SWATCH.stone).filter((p) => p.y > annex.b.foot + 5.9 && p.y < annex.b.foot + 6.1);
    expect(stone.length).toBeGreaterThanOrEqual(4);
    for (const p of colored(near3(annex), SWATCH.stone).filter((q) => q.y < annex.top - 1.1)) expect(outside(annex.b.ring, p)).toBeLessThan(0.46);
  });

  it("keeps Lublin 2077's fittings within a cornice's depth and runs cables from the west front to the tenement next door (T-034)", () => {
    // The uplights, the camera and the screen's frame stand out of the walls no more than a cornice (0.3 m).
    for (const id of GATE) {
      const f = frameOf(id) as LandmarkFrame;
      for (const p of [...colored(near3(f), SWATCH.metal), ...colored(near3(f), "#3a3f47")]) expect(outside(f.b.ring, p)).toBeLessThanOrEqual(0.31);
    }
    // The two uplights by the passage on Bramowa stand on the cobbles, not under or over them, and in no neighbour.
    const annex = frameOf("r7224409") as LandmarkFrame;
    expect(onTheStreet(annex, near3(annex), ringsAround(472.6, -91.2, GATE))).toBe(2);
    const tower = frameOf("w617597407") as LandmarkFrame;
    const runs = cableRuns(tower);
    expect(runs.length).toBe(2);
    const next = data("w66286400");
    const ring = ringOf(scenery(next));
    const west = tower.landmark.recipe.layer.newTown;
    const front = clockWalls(tower).neon!;
    for (const r of runs) {
      // From the tower's west wall, sagging down to the tenement's front corner under its eaves.
      expect(facing(front, west)).toBeGreaterThan(0.9);
      expect(Math.abs((r.a.x - front.a.x) * front.nx + (r.a.z - front.a.z) * front.nz)).toBeLessThan(0.1);
      expect(outside(ring, r.b)).toBeLessThan(0.3);
      expect(r.b.y).toBeLessThan(next.y + next.height);
      expect(r.a.y).toBeGreaterThan(r.b.y);
      expect(Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z)).toBeGreaterThan(5);
    }
    // Drawn near only, apart from the gate's solid; the Old Town's side has none.
    const sink = new MeshSink();
    planLandmarkCables(sink, tower);
    expect(sink.vertexCount).toBeGreaterThan(0);
    for (const id of ["r7224409", "w617878341"]) expect(cableRuns(frameOf(id) as LandmarkFrame)).toEqual([]);
  });

  it("takes the parts over a part and the cables' tenements from the map data: none when they are missing", () => {
    const full = landmarkIndex(LUBLIN_CHUNKS);
    const bare = landmarkIndex(LUBLIN_CHUNKS.map((c) => ({ ...c, buildings: c.buildings.filter((b) => b.id !== "w66286400" && b.id !== "w617597407") })));
    const key = (id: string) => [...full.entries()].find(([, p]) => p.part.osm === id)![0];
    expect(full.get(key("r7224409"))!.above!.length).toBe(1);
    expect(full.get(key("w617597407"))!.cableTo!.length).toBe(1);
    expect(bare.get(key("r7224409"))!.above).toBeUndefined();
    expect(bare.get(key("w617597407"))).toBeUndefined();
    expect(full.get(key("w617878341"))!.cableTo).toBeUndefined();
  });

  it("hangs the screen on the tower over the battlements, clear of the painting's niche over the arch (T-033, T-034)", () => {
    const annex = frameOf("r7224409") as LandmarkFrame;
    const mouth = mouthWall(annex, "new")!;
    const picture = colored(near3(annex), SWATCH.picture);
    expect(picture.length).toBeGreaterThan(0);
    const along = (p: P2) => ((p.x - mouth.w.a.x) * (mouth.w.b.x - mouth.w.a.x) + (p.z - mouth.w.a.z) * (mouth.w.b.z - mouth.w.a.z)) / mouth.w.length;
    // Centred over the arch, between its crown and the battlements.
    for (const p of picture) {
      expect(along(p)).toBeGreaterThan(mouth.u0);
      expect(along(p)).toBeLessThan(mouth.u1);
      expect(p.y).toBeGreaterThan(mouth.top);
      expect(p.y).toBeLessThan(annex.top - 1);
    }
    // The niche's frame about 1.1 x 2.1 m at 6.0-8.1 m over the foot (T-033).
    const frame = colored(near3(annex), SWATCH.stone).filter((p) => p.y > mouth.top + 0.3 && p.y < annex.top - 1.05 && along(p) > mouth.u0 && along(p) < mouth.u1);
    expect(Math.min(...frame.map((p) => p.y)) - annex.b.foot).toBeCloseTo(6, 1);
    expect(Math.max(...frame.map((p) => p.y)) - annex.b.foot).toBeCloseTo(8.1, 1);
    expect(Math.max(...frame.map(along)) - Math.min(...frame.map(along))).toBeCloseTo(1.1, 1);
    const tower = frameOf("w617597407") as LandmarkFrame;
    expect(screenOn(annex)).toBeNull();
    const s = screenOn(tower)!;
    // Seen from the plaza over the merlons 8 m in front of it.
    expect(s.y0).toBeGreaterThan(annex.top + 3.8);
    expect(s.y0).toBeGreaterThan(Math.max(...picture.map((p) => p.y)) + 1);
    expect(facing(s.w, annex.landmark.recipe.layer.newTown)).toBeGreaterThan(0.9);
  });

  it("gives the octagon walls to 22.5 m in two zones under a 7 m helmet, the peak the data's (T-032)", () => {
    const d = data("w617878341");
    const f = frameOf("w617878341") as LandmarkFrame;
    const roof = f.b.roof ?? 0;
    expect(f.b.foot - d.y).toBeCloseTo(16.7, 6);
    expect(f.top - d.y).toBeCloseTo(22.5, 6);
    expect(roof).toBeCloseTo(7, 6);
    expect(f.top + roof).toBeCloseTo(d.y + d.height + d.roof!, 6);
    // About 7.5 m across (the importer's correction of the mapped 6.6 m, T-032), round the same centre.
    const across = Math.max(...f.b.ring.flatMap((p) => f.b.ring.map((q) => Math.hypot(p.x - q.x, p.z - q.z))));
    expect(across).toBeGreaterThan(7);
    expect(across).toBeLessThan(8);
    expect(centroid(f.b.ring).x).toBeCloseTo(d.x, 0);
    // The lower zone with the clocks over the gallery's door, up to 20 m; the round-headed windows over it.
    const split = f.b.foot + f.landmark.part.tier.split!;
    expect(split - d.y).toBeCloseTo(20, 6);
    const { neon, old } = clockWalls(f);
    expect(neon && old).toBeTruthy();
    expect(facing(neon!, f.landmark.recipe.layer.newTown)).toBeGreaterThan(0.9);
    expect(facing(old!, f.landmark.recipe.layer.newTown)).toBeLessThan(-0.9);
    for (const w of [neon!, old!]) {
      const c = clockSpot(f, w);
      expect(c.y - c.r).toBeGreaterThanOrEqual(f.b.foot + GALLERY.floor + GALLERY.door);
      expect(c.y + c.r).toBeLessThanOrEqual(split);
      expect(c.r).toBeGreaterThan(0.5);
    }
    const sink = near3(f);
    const dark = colored(sink, SWATCH.opening).filter((p) => p.y < f.top);
    const c0 = centroid(f.b.ring);
    // Windows on at least six of the eight sides (by the direction from the centre, in 45° steps).
    const walls = new Set(dark.filter((p) => p.y > split).map((p) => Math.round((Math.atan2(p.z - c0.z, p.x - c0.x) / Math.PI) * 4)));
    expect(walls.size).toBeGreaterThanOrEqual(6);
    // Below the split only the gallery's door is dark: on the clock's wall, under the clock.
    for (const p of dark.filter((q) => q.y < split)) expect(p.y).toBeLessThanOrEqual(f.b.foot + GALLERY.floor + GALLERY.door + 1e-6);
  });

  it("puts the gallery with its balustrade on the octagon's west wall, over the tower's roof", () => {
    const f = frameOf("w617878341") as LandmarkFrame;
    const tower = frameOf("w617597407");
    const west = clockWalls(f).neon!;
    const white = colored(near3(f), SWATCH.plasterTrim).filter((p) => p.y > f.b.foot + GALLERY.floor - 0.2 && p.y < f.b.foot + GALLERY.floor + GALLERY.rail + 0.1 && outside(f.b.ring, p) > 0.3);
    expect(white.length).toBeGreaterThan(40);
    for (const p of white) {
      expect((p.x - west.a.x) * west.nx + (p.z - west.a.z) * west.nz).toBeGreaterThan(0);
      expect(outside(f.b.ring, p)).toBeLessThan(GALLERY.depth + 0.1);
      expect(pointInRing(p, tower.b.ring)).toBe(true);
    }
  });

  it("shapes the helmet as a bell, an open lantern, an onion and a spire with a ball in green patina", () => {
    const f = frameOf("w617878341") as LandmarkFrame;
    const c = f.landmark.part.crown;
    if (c.kind !== "helm") throw new Error("the octagon has a helmet");
    const base = helmBase(f.b.ring);
    const roof = f.b.roof!;
    const p = helmProfile(c.profile, base.r, roof);
    const top = (s: [number, number][]) => s[s.length - 1]![1] / roof;
    expect(top(p.shell)).toBeCloseTo(0.3, 6);
    expect(p.lantern[1]![1] / roof).toBeCloseTo(0.6, 6);
    expect(p.lantern[0]![0] / base.r).toBeCloseTo(0.23, 6);
    expect(top(p.onion)).toBeCloseTo(0.78, 6);
    // The onion swells wider than the lantern; the ball sits on the spire.
    expect(Math.max(...p.onion.map((q) => q[0]))).toBeGreaterThan(p.lantern[0]![0] * 1.2);
    expect(c.profile.ball).toBeGreaterThan(c.profile.onion);
    expect(c.profile.ball).toBeLessThan(c.profile.mast);
    // The mast is no longer than the spire (T-034).
    expect(1 - c.profile.mast).toBeLessThanOrEqual(c.profile.mast - c.profile.onion);
    expect(SWATCH.patina).toBe("#5a9a80");
    const helm = colored(near3(f), SWATCH.patina);
    expect(helm.length).toBeGreaterThan(100);
    expect(Math.min(...helm.map((q) => q.y))).toBeGreaterThanOrEqual(f.top - 1e-6);
  });

  it("draws the gate from its recipe in the map city: no tiled roof over the octagon", () => {
    const scene = new Scene(new NullEngine());
    const city = new MapCity({ scene, materials: new ToonMaterials(scene), shadow: null, quality: "high", signAtlas: RawTexture.CreateRGBATexture(new Uint8Array(4), 1, 1, scene) });
    for (const e of items) city.spawn(e.id, e.s.view, e.s.at);
    city.flush();
    for (let k = 0; k < 20; k++) city.update(1 / 60, { x: 472, y: 2, z: -91 }, false);
    const octagon = ringOf(items.find((i) => i.b.id === "w617878341")!.s);
    const top = data("w617878341").y + data("w617878341").height;
    const meshes = city.meshes.filter((m) => m.name.startsWith("map-near"));
    expect(meshes.length).toBeGreaterThan(0);
    let helm = 0;
    for (const m of meshes) {
      const pos = m.getVerticesData("position")!;
      const uv2 = m.getVerticesData("uv2")!;
      for (let i = 0; i < pos.length / 3; i++) {
        if (pos[i * 3 + 1]! < top + 0.5 || !pointInRing({ x: pos[i * 3]!, z: pos[i * 3 + 2]! }, octagon)) continue;
        helm++;
        expect(uv2[i * 2 + 1]!).toBeLessThan(ROOF_STYLE);
      }
    }
    expect(helm).toBeGreaterThan(50);
  });
});
