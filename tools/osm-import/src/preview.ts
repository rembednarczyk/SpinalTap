/**
 * `pnpm osm:preview [outDir]`: draws each district from the generated chunks as SVG (terrain
 * shaded by height with 2 m contours, surfaces, buildings by use, landmark names, chunk edges)
 * for eyeballing the import against the map. Not part of the build.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { terrainHeightAt } from "../../../packages/core/src/world/city-geo.ts";
import { DISTRICTS } from "./config.ts";
import { generate } from "./generate.ts";
import { loadInputs } from "./load.ts";
import { type ChunkOut } from "./model.ts";

const SCALE = 2;
const SURFACE: Record<string, string> = {
  water: "#5b8fd6",
  grass: "#9ccf7f",
  square: "#e6dcc3",
  road: "#7d7d85",
  cobble: "#b08a67",
  sidewalk: "#d0d0d6",
  footway: "#efe3b0",
  rail: "#5a4a3a",
};
const USE: Record<string, string> = {
  residential: "#c98f6b",
  commercial: "#d96a6a",
  civic: "#8f7ad1",
  church: "#e0c040",
  historic: "#b85fb0",
  industrial: "#7a8a96",
  garage: "#9a9a9a",
  other: "#b0a090",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const shade = (y: number, lo: number, hi: number): string => {
  const t = hi > lo ? (y - lo) / (hi - lo) : 0.5;
  const c = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${c(40, 245)},${c(70, 235)},${c(60, 200)})`;
};

const svgFor = (name: string, chunks: readonly ChunkOut[]): string => {
  const minX = Math.min(...chunks.map((c) => c.bounds.minX));
  const maxX = Math.max(...chunks.map((c) => c.bounds.maxX));
  const minZ = Math.min(...chunks.map((c) => c.bounds.minZ));
  const maxZ = Math.max(...chunks.map((c) => c.bounds.maxZ));
  const W = (maxX - minX) * SCALE;
  const H = (maxZ - minZ) * SCALE;
  const X = (x: number) => ((x - minX) * SCALE).toFixed(1);
  const Z = (z: number) => ((maxZ - z) * SCALE).toFixed(1);
  const poly = (flat: readonly number[], dx: number, dz: number) => {
    const pts: string[] = [];
    for (let i = 0; i < flat.length; i += 2) pts.push(`${X(flat[i]! + dx)},${Z(flat[i + 1]! + dz)}`);
    return pts.join(" ");
  };
  const lo = Math.min(...chunks.flatMap((c) => c.terrain.heights));
  const hi = Math.max(...chunks.flatMap((c) => c.terrain.heights));
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 40}" font-family="sans-serif">`, `<rect width="100%" height="100%" fill="#222"/>`];
  for (const c of chunks) {
    const g = c.terrain;
    const step = Math.max(g.cell, 4);
    for (let z = c.bounds.minZ; z < c.bounds.maxZ; z += step) {
      for (let x = c.bounds.minX; x < c.bounds.maxX; x += step) {
        const y = terrainHeightAt(g, x + step / 2, z + step / 2);
        const band = Math.floor(y / 2) % 2 === 0 ? 1 : 0.93;
        out.push(`<rect x="${X(x)}" y="${Z(z + step)}" width="${step * SCALE}" height="${step * SCALE}" fill="${shade(y, lo, hi)}" opacity="${band}"/>`);
      }
    }
  }
  for (const c of chunks) for (const gr of c.ground) out.push(`<polygon points="${poly(gr.outline, 0, 0)}" fill="${SURFACE[gr.surface]}" fill-opacity="0.85"/>`);
  for (const c of chunks) {
    for (const b of c.buildings) {
      out.push(`<polygon points="${poly(b.outline, b.x, b.z)}" fill="${USE[b.use]}" stroke="#222" stroke-width="0.6"/>`);
      if (b.parts.length > 1) for (const p of b.parts) out.push(`<polygon points="${poly(p, b.x, b.z)}" fill="none" stroke="#0003" stroke-width="0.4"/>`);
    }
  }
  for (const c of chunks) {
    for (const s of c.streets) {
      if (s.line.length < 4) continue;
      const i = Math.floor(s.line.length / 4) * 2;
      out.push(`<text x="${X(s.line[i]!)}" y="${Z(s.line[i + 1]!)}" font-size="11" fill="#003" opacity="0.8">${esc(s.name)}</text>`);
    }
    for (const b of c.buildings) if (b.name) out.push(`<text x="${X(b.x)}" y="${Z(b.z)}" font-size="13" font-weight="bold" fill="#000" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(b.name)} (${b.height}${b.roof ? `+${b.roof}` : ""} m)</text>`);
    out.push(`<rect x="${X(c.bounds.minX)}" y="${Z(c.bounds.maxZ)}" width="${(c.bounds.maxX - c.bounds.minX) * SCALE}" height="${(c.bounds.maxZ - c.bounds.minZ) * SCALE}" fill="none" stroke="#f0f" stroke-dasharray="8 6"/>`);
    out.push(`<text x="${+X(c.bounds.minX) + 6}" y="${+Z(c.bounds.maxZ) + 18}" font-size="14" fill="#f0f">${c.id} cell ${c.terrain.cell} m</text>`);
  }
  out.push(`<text x="10" y="${H + 26}" font-size="16" fill="#fff">${name}: x ${minX}..${maxX}, z ${minZ}..${maxZ}; terrain y ${lo}..${hi} m (shade, 2 m bands)</text>`, "</svg>");
  return out.join("\n");
};

const dir = process.argv[2] ?? "lublin-preview";
mkdirSync(dir, { recursive: true });
const inputs = loadInputs();
const { chunks } = generate(inputs.osm, inputs.src);
for (const d of DISTRICTS) {
  const file = join(dir, `${d.slug}.svg`);
  writeFileSync(file, svgFor(d.name, chunks.filter((c) => c.district === d.id)));
  console.log(file);
}
