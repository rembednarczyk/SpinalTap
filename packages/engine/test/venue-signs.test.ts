import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { SIGN_GLYPHS, type ViewDescriptor } from "@seki/core";
import { LUBLIN_CHUNKS, buildingView } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { RawTexture, Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { MeshSink } from "../src/renderer/mesh-sink";
import { type MapBuilding, type MapVenue, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { MapCity, type MapView } from "../src/renderer/mapcity/map-city";
import { mapBuilding } from "../src/renderer/mapcity/map-building";
import { drawGlyphAtlas, oneChannel } from "../src/renderer/mapcity/map-signs";
import { cleanRing } from "../src/renderer/mapcity/polygon";
import { MAP_SIGN_KIND, planBuildingSigns } from "../src/renderer/mapcity/sign-plan";
import { glyphCell, planVenueSigns, venueBoards } from "../src/renderer/mapcity/venue-plan";

/**
 * Signs of the map's venues (ADR-0064 stage 4): a board and neon letters on the right wall, with
 * a fake scene where a mesh is needed; no browser.
 */

const rect = (x0: number, z0: number, x1: number, z1: number) => cleanRing([{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]);
const venue = (x: number, z: number, name = "RZEKOTKA 24/7", color = "#39ff8a"): MapVenue => ({ x, z, name, color });
const shop = (venues: MapVenue[], extra: Partial<MapBuilding> = {}): MapBuilding => ({ id: 5, ring: rect(0, 0, 18, 12), base: 0, foot: 0, height: 14, levels: 3, use: "residential", look: 77, roof: 4, shopfront: true, venues, ...extra });
const none = () => null;
const kindsOf = (sink: MeshSink): number[] => Array.from({ length: sink.vertexCount }, (_, i) => sink.uvs2[i * 2 + 1]!);
const count = (sink: MeshSink, kind: number) => kindsOf(sink).filter((k) => k === kind).length / 4;

describe("venue signs (ADR-0064 stage 4)", () => {
  it("hang over the window of the street wall nearest the venue, one neon letter per letter of the name", () => {
    // The venue is mapped just inside the south wall (z = 0).
    const f = facadeFrame(shop([venue(6, 1)]), none);
    const [b] = venueBoards(f);
    expect(b).toBeDefined();
    expect(b!.wall.nz).toBeCloseTo(-1, 9);
    expect(Math.abs(b!.u - 6)).toBeLessThan(0.01);
    expect(b!.y).toBeGreaterThan(f.b.base + 2.3);
    expect(b!.y).toBeLessThan(f.b.base + f.ground);
    const sink = new MeshSink();
    expect(planVenueSigns(sink, f, none)).toBe(1);
    expect(count(sink, MAP_SIGN_KIND.venue)).toBe(1);
    expect(count(sink, MAP_SIGN_KIND.glyph)).toBe([..."RZEKOTKA 24/7"].filter((c) => c !== " ").length);
    // The letters stay on the board.
    for (let i = 0; i < sink.vertexCount; i++) {
      if (sink.uvs2[i * 2 + 1] !== MAP_SIGN_KIND.glyph) continue;
      expect(Math.abs(sink.positions[i * 3]! - b!.u)).toBeLessThanOrEqual(b!.width / 2 + 1e-6);
      expect(Math.abs(sink.positions[i * 3 + 1]! - b!.y)).toBeLessThanOrEqual(b!.height / 2);
      expect(glyphCell("R")).not.toBeNull();
    }
  });

  it("go round a party wall to the street side, and never onto a wall a neighbour hides", () => {
    // A neighbour stands against the south wall: the venue near it signs the east wall.
    const neighbour = (_x: number, z: number) => (z < 0 ? 20 : null);
    const [b] = venueBoards(facadeFrame(shop([venue(16, 1)]), neighbour));
    expect(b!.wall.nx).toBeCloseTo(1, 9);
  });

  it("keep the boards of one wall apart and off the game's doorways, and drop one with no room left", () => {
    const f = facadeFrame(shop([venue(6, 0.5), venue(6.5, 0.5, "KAWA"), venue(7, 0.5, "APTEKA")], { doorways: [{ x: 12, z: 0, width: 2, bottom: 0, top: 2.6 }] }), none);
    const boards = venueBoards(f).filter((b) => b.wall.nz < -0.5);
    expect(boards.length).toBeGreaterThanOrEqual(2);
    const spans = boards.map((b) => [b.u - b.width / 2, b.u + b.width / 2] as const).sort((p, q) => p[0] - q[0]);
    for (let i = 1; i < spans.length; i++) expect(spans[i]![0]).toBeGreaterThanOrEqual(spans[i - 1]![1]);
    for (const [lo, hi] of spans) expect(hi <= 11 || lo >= 13).toBe(true);
    const crowded = facadeFrame(shop(Array.from({ length: 12 }, (_, i) => venue(9, 0.5, `LOKAL ${i}`)), { ring: rect(0, 0, 8, 6) }), none);
    expect(venueBoards(crowded).length).toBeLessThan(12);
  });

  it("squeeze a long name to the wall and take the place of the atlas's boards and blades", () => {
    const long = venueBoards(facadeFrame(shop([venue(2, 0.5, "GALERIA PRZY BRAMIE KRAKOWSKIEJ 2077")], { ring: rect(0, 0, 6, 12) }), none))[0]!;
    expect(long.width).toBeLessThanOrEqual(6 - 0.6 + 1e-9);
    expect(long.squeeze).toBeLessThan(1);
    const atlas = new MeshSink();
    planBuildingSigns(atlas, facadeFrame(shop([]), none), () => null);
    expect(count(atlas, MAP_SIGN_KIND.board)).toBeGreaterThan(0);
    const own = new MeshSink();
    planBuildingSigns(own, facadeFrame(shop([venue(6, 1)]), none), () => null);
    expect(count(own, MAP_SIGN_KIND.board)).toBe(0);
    expect(count(own, MAP_SIGN_KIND.blade)).toBe(0);
  });

  it("leave the streak on the pavement out on the phone", () => {
    const f = facadeFrame(shop([venue(6, 1)]), none);
    const full = new MeshSink();
    const lite = new MeshSink();
    planVenueSigns(full, f, none, false);
    planVenueSigns(lite, f, none, true);
    expect(count(full, MAP_SIGN_KIND.reflection)).toBe(1);
    expect(count(lite, MAP_SIGN_KIND.reflection)).toBe(0);
    expect(count(lite, MAP_SIGN_KIND.glyph)).toBe(count(full, MAP_SIGN_KIND.glyph));
  });

  it("draw every sign letter into its own cell of the glyph atlas", () => {
    const drawn: string[] = [];
    const ctx = { fillRect: () => {}, fillText: (t: string) => drawn.push(t) } as unknown as CanvasRenderingContext2D;
    drawGlyphAtlas(ctx);
    expect(drawn.join("")).toBe(SIGN_GLYPHS);
    expect(SIGN_GLYPHS.length).toBeLessThanOrEqual(64);
  });

  it("keep one byte a pixel of the glyph atlas, rows bottom up as a canvas texture lies", () => {
    // A 2 x 2 image: top row red 10, 20; bottom row 30, 40.
    const rgba = [10, 1, 1, 255, 20, 1, 1, 255, 30, 1, 1, 255, 40, 1, 1, 255];
    expect(Array.from(oneChannel(rgba, 2))).toEqual([30, 40, 10, 20]);
  });

  it("draw the glyph atlas at the size asked, 512 on the phone, letters scaled to the cells", () => {
    const fonts: string[] = [];
    const ctx = {
      fillRect: () => {},
      fillText: () => {},
      set font(f: string) {
        fonts.push(f);
      },
    } as unknown as CanvasRenderingContext2D;
    drawGlyphAtlas(ctx, 512);
    expect(fonts[0]).toMatch(/^bold 46px/);
  });
});

describe("venue signs in the map city", () => {
  it("take the view's venues to the world, beside the building's position", () => {
    const view = { kind: "building", outline: rect(-5, -5, 5, 5), height: 12, levels: 3, use: "residential", look: 3, venues: [{ at: { x: 1, z: -5 }, kind: "cafe", name: "KAWA", color: "#ffb000" }] } as Extract<ViewDescriptor, { kind: "building" }>;
    const b = mapBuilding(1, { ring: rect(15, 15, 25, 25), view, at: { x: 20, y: 0, z: 20 } }, none);
    expect(b.venues).toEqual([{ x: 21, z: 15, name: "KAWA", color: "#ffb000" }]);
  });

  it("sign the generated Lublin's venues in the cells' sign meshes, without a mesh more", () => {
    const meshesOf = (withVenues: boolean) => {
      const scene = new Scene(new NullEngine());
      const atlas = RawTexture.CreateRGBATexture(new Uint8Array(4), 1, 1, scene);
      const city = new MapCity({ scene, materials: new ToonMaterials(scene), shadow: null, quality: "high", signAtlas: atlas });
      const chunk = LUBLIN_CHUNKS.find((c) => c.id === "krakowskie-2-0")!;
      let id = 1;
      for (const b of chunk.buildings) {
        const v = buildingView(b) as MapView;
        city.spawn(id++, withVenues ? v : ({ ...v, venues: undefined } as MapView), { x: b.x, y: b.y, z: b.z });
      }
      city.flush();
      city.update(1 / 60, { x: 280, y: 2, z: -70 }, false);
      const signs = city.meshes.filter((m) => m.name.startsWith("map-signs"));
      const glyphs = signs.reduce((n, m) => n + Array.from(m.getVerticesData("uv2") ?? []).filter((v, i) => i % 2 === 1 && v === MAP_SIGN_KIND.glyph).length, 0);
      return { meshes: city.meshes.length, glyphs };
    };
    const without = meshesOf(false);
    const withVenues = meshesOf(true);
    expect(without.glyphs).toBe(0);
    expect(withVenues.glyphs).toBeGreaterThan(200);
    expect(withVenues.meshes).toBe(without.meshes);
  });
});
