import { describe, expect, it } from "vitest";
import { ALCHEMIA_CENTRE, groundY } from "@seki/sim";
import { LUBLIN_CHUNKS } from "@seki/sim/lublin";
// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { GeometrySink, parseCityKit, swatchUv } from "../src/renderer/city-kit-data";
import { MeshSink } from "../src/renderer/mesh-sink";
import { deptakSignGeometry } from "../src/renderer/alchemia/deptak-sign-geometry";
import { DEPTAK_SIGNS, TENEMENT_WALLS, planDeptakSigns, signAt } from "../src/renderer/alchemia/deptak-signs";
import { planAlchemiaSigns } from "../src/renderer/alchemia/front-signs";
import { MAP_SIGN_KIND, NEAR_ONLY } from "../src/renderer/mapcity/sign-plan";
import { glyphCell } from "../src/renderer/mapcity/venue-plan";

/**
 * The neons of the deptak on Lubartowska (ADR-0074 C7, the board's): an upright cyan SPOŻYWCZY and
 * ALCHEMIA out of the tenement across the deptak, a red SPOŻYWCZY board over its shop and a red
 * PARKING CAŁODOBOWY on its top storey, light only in the map city's signs (no mesh, no draw call).
 */

const all = { minX: -1e6, maxX: 1e6, minZ: -1e6, maxZ: 1e6 };
const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));

const quads = (s: MeshSink) =>
  Array.from({ length: s.vertexCount / 4 }, (_, q) => {
    const corners = [0, 1, 2, 3].map((k) => ({ x: s.positions[(q * 4 + k) * 3]!, y: s.positions[(q * 4 + k) * 3 + 1]!, z: s.positions[(q * 4 + k) * 3 + 2]! }));
    return { kind: s.uvs2[q * 8 + 1]!, corners, normal: { x: s.normals[q * 12]!, z: s.normals[q * 12 + 2]! }, bright: s.colors[q * 16 + 3]!, colour: [s.colors[q * 16]!, s.colors[q * 16 + 1]!, s.colors[q * 16 + 2]!] };
  });
/** A quad's middle's height: a letter's capital, some half of its cell, round it. */
const mid = (q: { corners: readonly { y: number }[] }): number => q.corners.reduce((m, c) => m + c.y, 0) / 4;
const letters = (text: string): number => [...text].filter((c) => c !== " " && glyphCell(c) !== null).length;

/** The tenement w66286394 of the map (OSM): its outline in the world. */
const tenement = (() => {
  for (const c of LUBLIN_CHUNKS) {
    const b = c.buildings.find((x) => x.id === "w66286394");
    if (!b) continue;
    const pts: { x: number; z: number }[] = [];
    for (let i = 0; i < b.outline.length; i += 2) pts.push({ x: b.x + b.outline[i]!, z: b.z + b.outline[i + 1]! });
    return { pts, top: b.y + b.height };
  }
  throw new Error("w66286394 is not in the map");
})();
const toOutline = (p: { x: number; z: number }): number => {
  let best = Infinity;
  const n = tenement.pts.length;
  for (let i = 0; i < n; i++) {
    const [a, b] = [tenement.pts[i]!, tenement.pts[(i + 1) % n]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
  }
  return best;
};

describe("the deptak's neons (ADR-0074 C7)", () => {
  const sink = new MeshSink();
  const drawn = planDeptakSigns(sink, all);
  const qs = quads(sink);

  it("draws the board's four: SPOŻYWCZY and ALCHEMIA upright, SPOŻYWCZY and PARKING CAŁODOBOWY across, each on both faces", () => {
    expect(DEPTAK_SIGNS.map((s) => (s.kind === "board" ? s.lines.join(" ") : s.text))).toEqual(["SPOŻYWCZY", "PARKING CAŁODOBOWY", "SPOŻYWCZY", "ALCHEMIA"]);
    expect(DEPTAK_SIGNS.map((s) => s.kind)).toEqual(["blade", "board", "board", "blade"]);
    expect(drawn).toBe(2 * letters("SPOŻYWCZY") + 2 * (letters("PARKING") + letters("CAŁODOBOWY")) + 2 * letters("SPOŻYWCZY") + 2 * letters("ALCHEMIA"));
    // Only the boards' rims and glows and the atlas's letters, none of them near only: the tenement is the map's, drawn as far as its signs.
    expect(new Set(qs.map((q) => q.kind))).toEqual(new Set([MAP_SIGN_KIND.venue, MAP_SIGN_KIND.glyph]));
    // Nothing in a cell elsewhere; the front's own light stays as C4's.
    expect(planDeptakSigns(new MeshSink(), { minX: 0, maxX: 128, minZ: 0, maxZ: 128 })).toBe(0);
    const front = new MeshSink();
    planAlchemiaSigns(front, all);
    expect(quads(front).every((q) => q.kind >= NEAR_ONLY.kind)).toBe(true);
  });

  it("hangs them on the tenement's west wall over the deptak, under its eaves, over heads", () => {
    for (const w of TENEMENT_WALLS) for (const p of [w.a, w.b]) expect(toOutline(p)).toBeLessThan(0.05);
    for (const s of DEPTAK_SIGNS) {
      expect(toOutline(signAt(s))).toBeLessThan(0.05);
      expect(s.y1).toBeLessThan(tenement.top - 0.5);
    }
    // Every quad within 3.7 m west of the wall, none inside it, all over 2.5 m above the pavement.
    for (const q of qs) {
      for (const c of q.corners) {
        expect(c.x).toBeLessThan(tenement.pts.reduce((m, p) => Math.max(m, p.x), -Infinity));
        expect(toOutline(c)).toBeLessThan(3.7);
        expect(c.y - groundY(c.x, c.z)).toBeGreaterThan(2.5);
      }
    }
  });

  it("stacks a blade's letters one under another inside its rim, readable from both ways along the street", () => {
    for (const s of DEPTAK_SIGNS.filter((x): x is Extract<typeof x, { kind: "blade" }> => x.kind === "blade")) {
      const at = signAt(s);
      const mine = qs.filter((q) => q.kind === MAP_SIGN_KIND.glyph && q.bright > 1.2 && q.corners.every((c) => Math.abs(c.z - at.z) < 1.5) && mid(q) > s.y0 && mid(q) < s.y1);
      expect(mine).toHaveLength(2 * letters(s.text));
      // Both faces: normals along the wall, either way.
      expect(new Set(mine.map((q) => Math.sign(q.normal.z)))).toEqual(new Set([1, -1]));
      // Each face's letters top to bottom in the text's order: their middles fall.
      const face = mine.filter((q) => q.normal.z > 0).map(mid);
      // The capitals (half a cell) inside the blade.
      for (const q of mine) {
        const h = Math.max(...q.corners.map((c) => c.y)) - Math.min(...q.corners.map((c) => c.y));
        expect(mid(q) + h / 4).toBeLessThan(s.y1);
        expect(mid(q) - h / 4).toBeGreaterThan(s.y0);
      }
      for (let i = 1; i < face.length; i++) expect(face[i]!).toBeLessThan(face[i - 1]!);
    }
  });

  it("lights the boards across red (their bodies the kit's red glow), their rims and letters white, every sign within reach of the front's square", () => {
    // The boards' rims white over their red: two faces each.
    const rims = qs.filter((q) => q.kind === MAP_SIGN_KIND.venue && q.colour[0]! > 0.9 && q.colour[1]! > 0.8);
    expect(rims).toHaveLength(2 * 2);
    // Their bodies in the tiers' mesh: the kit's red glow, the blades' dark boxes, the brackets, all on the wall's west and over heads.
    const g = new GeometrySink();
    deptakSignGeometry(g, kitData);
    const red = swatchUv(kitData, "neon-red");
    const uvs = Array.from({ length: g.vertexCount }, (_, v) => [g.uvs[v * 2]!, g.uvs[v * 2 + 1]!] as const);
    // A box is 24 corners: the two boards red, the two blades with their two brackets each and the boards' bars not.
    expect(uvs.filter(([u, v]) => Math.abs(u - red[0]) < 1e-6 && Math.abs(v - red[1]) < 1e-6)).toHaveLength(2 * 24);
    expect(g.vertexCount).toBe((2 + 2 + 2 * 2 + 2) * 24);
    for (let v = 0; v < g.vertexCount; v++) {
      const c = { x: g.positions[v * 3]!, y: g.positions[v * 3 + 1]!, z: g.positions[v * 3 + 2]! };
      expect(toOutline(c)).toBeLessThan(3.7);
      expect(c.y - groundY(c.x, c.z)).toBeGreaterThan(2.5);
    }
    // Some 60 m of the hall's middle at most: seen from the square before the front and the deptak.
    for (const s of DEPTAK_SIGNS) expect(Math.hypot(signAt(s).x - ALCHEMIA_CENTRE.x, signAt(s).z - ALCHEMIA_CENTRE.z)).toBeLessThan(65);
  });
});
