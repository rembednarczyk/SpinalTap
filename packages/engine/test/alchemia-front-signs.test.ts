// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALCHEMIA_CENTRE, ALCHEMIA_PIECES, FRONT_SIGN, L3, L3_TOP } from "@seki/sim";
import { parseCityKit, swatchUv } from "../src/renderer/city-kit-data";
import { MeshSink } from "../src/renderer/mesh-sink";
import { alchemiaGeometry } from "../src/renderer/alchemia/alchemia-geometry";
import { ALCHEMIA_DRAW } from "../src/renderer/alchemia/alchemia-view";
import { FRONT_HOLOS, HOLO_PROGRAM, HOLO_Z, SIGN_FRAME, SIGN_LINES, pictureScreens, planAlchemiaSigns, screenFacing } from "../src/renderer/alchemia/front-signs";
import { MAP_SIGNS_FRAGMENT } from "../src/renderer/mapcity/map-signs";
import { MAP_SIGN_KIND, NEAR_ONLY } from "../src/renderer/mapcity/sign-plan";
import { glyphCell } from "../src/renderer/mapcity/venue-plan";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));

const all = { minX: -1e6, maxX: 1e6, minZ: -1e6, maxZ: 1e6 };

/** Each quad of a signs' sink: its kind (near flag off), seed and corners. */
const quads = (s: MeshSink) =>
  Array.from({ length: s.vertexCount / 4 }, (_, q) => {
    const corners = [0, 1, 2, 3].map((k) => ({ x: s.positions[(q * 4 + k) * 3]!, y: s.positions[(q * 4 + k) * 3 + 1]!, z: s.positions[(q * 4 + k) * 3 + 2]! }));
    return { kind: s.uvs2[q * 8 + 1]!, seed: s.uvs2[q * 8]!, corners, normal: { x: s.normals[q * 12]!, z: s.normals[q * 12 + 2]! }, bright: s.colors[q * 16 + 3]! };
  });
const span = (pts: readonly { x: number; y: number; z: number }[], k: "x" | "y" | "z") => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))] as const;
const colourOf = (q: { bright: number }): number => q.bright;
const letters = (text: string) => [...text].filter((c) => c !== " " && glyphCell(c) !== null).length;

/**
 * The front's sign, holograms and screens' pictures of ADR-0074 C4 (the board's lightbox, the two
 * upright holograms by it and the podium's LED screens), in the map city's signs: no draw call more.
 */
describe("Alchemia's front light (ADR-0074 C4)", () => {
  const sink = new MeshSink();
  const drawn = planAlchemiaSigns(sink, all);
  const all4 = quads(sink);

  it("draws the sign, its two holograms and every screen outside, all of it near only", () => {
    expect(drawn).toBe(1 + FRONT_HOLOS.length + pictureScreens().length);
    expect(pictureScreens().length).toBe(ALCHEMIA_PIECES.filter((p) => p.kind === "screen" && !p.inside).length);
    // Every quad near only: it fades out before Alchemia's mesh goes.
    for (const q of all4) expect(q.kind).toBeGreaterThanOrEqual(NEAR_ONLY.kind);
    const kinds = new Set(all4.map((q) => q.kind - NEAR_ONLY.kind));
    expect(kinds).toEqual(new Set([MAP_SIGN_KIND.venue, MAP_SIGN_KIND.glyph, MAP_SIGN_KIND.screen]));
    // Nothing in a cell elsewhere.
    expect(planAlchemiaSigns(new MeshSink(), { minX: 0, maxX: 128, minZ: 0, maxZ: 128 })).toBe(0);
  });

  it("fades every light out before the building's mesh goes (ADR-0074 §7: within ALCHEMIA_DRAW of the hall's middle)", () => {
    // An eye ALCHEMIA_DRAW off the middle is at least that less a light's own distance off the light.
    const farthest = Math.max(...all4.flatMap((q) => q.corners.map((c) => Math.hypot(c.x - ALCHEMIA_CENTRE.x, c.z - ALCHEMIA_CENTRE.z))));
    expect(ALCHEMIA_DRAW - farthest).toBeGreaterThan(NEAR_ONLY.to);
    expect(MAP_SIGNS_FRAGMENT).toContain(`smoothstep(${NEAR_ONLY.from.toFixed(1)}, ${NEAR_ONLY.to.toFixed(1)}, dist)`);
    expect(MAP_SIGNS_FRAGMENT).toContain("screenPicture(uv, seed, col, time, reduce)");
  });

  it("writes ALCHEMIA over CENTRUM HANDLOWE inside the lightbox's frame, white with a cyan halo", () => {
    const glyphs = all4.filter((q) => q.kind - NEAR_ONLY.kind === MAP_SIGN_KIND.glyph && q.corners[0]!.z < FRONT_SIGN.z0 + 1e-6 && q.corners[0]!.z > FRONT_SIGN.z0 - 0.1);
    // Each letter thrice: its core and two rings of halo.
    expect(glyphs.length).toBe(3 * SIGN_LINES.reduce((s, l) => s + letters(l.text), 0));
    // The cores (the brightest) across the face inside its frame; a letter's capital is some half of its cell, round its middle.
    const cores = glyphs.filter((q) => colourOf(q) > 1.2);
    expect(cores.length).toBe(SIGN_LINES.reduce((s, l) => s + letters(l.text), 0));
    const [x0, x1] = span(cores.flatMap((q) => q.corners), "x");
    expect(x0).toBeGreaterThan(FRONT_SIGN.x0 + SIGN_FRAME);
    expect(x1).toBeLessThan(FRONT_SIGN.x1 - SIGN_FRAME);
    for (const q of cores) {
      const [y0, y1] = span(q.corners, "y");
      const cap = { lo: (y0 + y1) / 2 - 0.06 * (y1 - y0) - 0.27 * (y1 - y0), hi: (y0 + y1) / 2 - 0.06 * (y1 - y0) + 0.27 * (y1 - y0) };
      expect(cap.lo).toBeGreaterThan(FRONT_SIGN.y0 + SIGN_FRAME);
      expect(cap.hi).toBeLessThan(FRONT_SIGN.y1 - SIGN_FRAME);
      expect(q.normal.z).toBeCloseTo(-1, 6);
    }
    // ALCHEMIA over CENTRUM HANDLOWE, the two lines about as wide as each other, as on the board.
    const line = (l: (typeof SIGN_LINES)[number]) => cores.filter((q) => Math.abs(span(q.corners, "y")[1] - span(q.corners, "y")[0] - l.height) < 1e-6);
    const width = (l: (typeof SIGN_LINES)[number]) => {
      const [a, b] = span(line(l).flatMap((q) => q.corners), "x");
      return b - a;
    };
    expect(span(line(SIGN_LINES[0]).flatMap((q) => q.corners), "y")[0]).toBeGreaterThan(span(line(SIGN_LINES[1]).flatMap((q) => q.corners), "y")[0]);
    expect(width(SIGN_LINES[0]) / width(SIGN_LINES[1])).toBeGreaterThan(0.85);
    expect(width(SIGN_LINES[0]) / width(SIGN_LINES[1])).toBeLessThan(1.35);
    // Big: ALCHEMIA's capitals over a metre high, its line half the sign's width at least.
    expect(SIGN_LINES[0].height * 0.5).toBeGreaterThan(1);
    expect(width(SIGN_LINES[0])).toBeGreaterThan((FRONT_SIGN.x1 - FRONT_SIGN.x0) / 2);
    // The lightbox's face: one quad of glow inside the frame.
    const face = all4.filter((q) => q.kind - NEAR_ONLY.kind === MAP_SIGN_KIND.venue);
    expect(face).toHaveLength(1);
  });

  it("stands the holograms by the sign, upright panels rising over L3's roof, clear of the sign", () => {
    const holos = all4.filter((q) => q.kind - NEAR_ONLY.kind === MAP_SIGN_KIND.screen && Math.floor(q.seed) === HOLO_PROGRAM);
    expect(holos).toHaveLength(2);
    for (const q of holos) {
      const [x0, x1] = span(q.corners, "x");
      const [, y1] = span(q.corners, "y");
      expect(q.corners.every((c) => Math.abs(c.z - HOLO_Z) < 1e-9)).toBe(true);
      expect(x1 < FRONT_SIGN.x0 || x0 > FRONT_SIGN.x1).toBe(true);
      expect(x0).toBeGreaterThan(L3.minX);
      expect(x1).toBeLessThan(L3.maxX);
      expect(y1).toBeGreaterThan(L3_TOP + 2);
      // Upright, its aspect in its seed.
      expect(((q.seed % 1) * 16).toFixed(3)).toBe(((x1 - x0) / (y1 - span(q.corners, "y")[0])).toFixed(3));
      expect(x1 - x0).toBeLessThan(y1 - span(q.corners, "y")[0]);
    }
  });

  it("puts a picture on each screen's outer face, its aspect in its seed, its caption at its foot", () => {
    const pics = all4.filter((q) => q.kind - NEAR_ONLY.kind === MAP_SIGN_KIND.screen && Math.floor(q.seed) !== HOLO_PROGRAM);
    expect(pics).toHaveLength(pictureScreens().length);
    pictureScreens().forEach((p, i) => {
      const q = pics[i]!;
      const n = screenFacing(p.box);
      expect(q.normal.x).toBeCloseTo(n.x, 6);
      expect(q.normal.z).toBeCloseTo(n.z, 6);
      // Out of the panel's face, not in it.
      const c = q.corners[0]!;
      if (n.z < 0) expect(c.z).toBeLessThan(p.box.z0);
      if (n.x > 0) expect(c.x).toBeGreaterThan(p.box.x1);
      if (n.x < 0) expect(c.x).toBeLessThan(p.box.x0);
      const [y0, y1] = span(q.corners, "y");
      const along = n.z !== 0 ? span(q.corners, "x") : span(q.corners, "z");
      expect(((q.seed % 1) * 16).toFixed(2)).toBe(((along[1] - along[0]) / (y1 - y0)).toFixed(2));
      // A program of three in turn: neighbours start on different spots.
      expect(Math.floor(q.seed)).toBe(i % 3);
    });
    // The L3's side screens face off it, west and east.
    const sides = pictureScreens().filter((p) => p.box.x1 - p.box.x0 < p.box.z1 - p.box.z0).map((p) => screenFacing(p.box).x);
    expect(sides.sort()).toEqual([-1, 1]);
  });

  it("draws the lightbox and the emitters in the tiers' mesh, the screens outside as dark panels without bands (C4)", () => {
    // C4: the screens outside lost their bands (their pictures are the signs' now).
    const g = alchemiaGeometry(kitData, pictureScreens());
    const outside = new Set<string>();
    for (const s of [g.tiers, g.outside, g.inside]) {
      for (let v = 0; v < s.positions.length / 3; v++) {
        const [x, y, z] = [s.positions[v * 3]!, s.positions[v * 3 + 1]!, s.positions[v * 3 + 2]!];
        const on = pictureScreens().some(({ box: b }) => x > b.x0 - 0.03 && x < b.x1 + 0.03 && y > b.y0 - 0.03 && y < b.y1 + 0.03 && z > b.z0 - 0.03 && z < b.z1 + 0.03);
        if (on) outside.add(`${s.uvs[v * 2]},${s.uvs[v * 2 + 1]}`);
      }
    }
    expect([...outside]).toEqual([swatchUv(kitData, "glass-dark").join(",")]);
    // The lightbox: its body, its pale frame proud of the face, a strip of light along its top; no neon tubes of letters on it.
    const tiers = alchemiaGeometry(kitData).tiers;
    const box = new Set<string>();
    for (let v = 0; v < tiers.positions.length / 3; v++) {
      const [x, y, z] = [tiers.positions[v * 3]!, tiers.positions[v * 3 + 1]!, tiers.positions[v * 3 + 2]!];
      if (x > FRONT_SIGN.x0 - 0.01 && x < FRONT_SIGN.x1 + 0.01 && y > FRONT_SIGN.y0 - 0.01 && y < FRONT_SIGN.y1 + 0.01 && z > FRONT_SIGN.z0 - 0.1 && z < FRONT_SIGN.z1 + 0.01) box.add(`${tiers.uvs[v * 2]},${tiers.uvs[v * 2 + 1]}`);
    }
    for (const c of ["metal", "ac", "neon-cyan"]) expect(box.has(swatchUv(kitData, c).join(",")), c).toBe(true);
    const onSign: number[] = [];
    for (let v = 0; v < tiers.positions.length / 3; v++) {
      const [x, y, z] = [tiers.positions[v * 3]!, tiers.positions[v * 3 + 1]!, tiers.positions[v * 3 + 2]!];
      if (x > FRONT_SIGN.x0 + SIGN_FRAME + 0.01 && x < FRONT_SIGN.x1 - SIGN_FRAME - 0.01 && y > FRONT_SIGN.y0 + SIGN_FRAME + 0.01 && y < FRONT_SIGN.y1 - SIGN_FRAME - 0.01 && z < FRONT_SIGN.z0 - 0.001 && z > FRONT_SIGN.z0 - 0.2) onSign.push(v);
    }
    expect(onSign).toEqual([]);
  });
});
