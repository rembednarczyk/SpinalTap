/**
 * The rectangle a GUGiK extract is cut to (ADR-0077): `--bbox minX,minZ,maxX,maxZ` in game world
 * metres, or `--bbox-2180 minE,minN,maxE,maxN` in PUWG 1992 (EPSG:2180). Without either, the
 * whole of the downloaded sets (powiat 0663, the city of Lublin).
 */
import { type Rect } from "../../osm-import/src/geometry.ts";
import { puwgToWorld } from "./frame.ts";

const numbers = (v: string, flag: string): [number, number, number, number] => {
  const n = v.split(",").map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x)) || n[0]! >= n[2]! || n[1]! >= n[3]!) throw new Error(`${flag} wants min1,min2,max1,max2, got "${v}"`);
  return n as [number, number, number, number];
};

const valueOf = (argv: readonly string[], flag: string): string | undefined => {
  const i = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (i < 0) return undefined;
  const a = argv[i]!;
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[i + 1];
};

/** The world rectangle of the arguments, `undefined` for the whole city. */
export const parseBbox = (argv: readonly string[]): Rect | undefined => {
  const game = valueOf(argv, "--bbox");
  if (game !== undefined) {
    const [minX, minZ, maxX, maxZ] = numbers(game, "--bbox");
    return { minX, minZ, maxX, maxZ };
  }
  const grid = valueOf(argv, "--bbox-2180");
  if (grid === undefined) return undefined;
  const [minE, minN, maxE, maxN] = numbers(grid, "--bbox-2180");
  // The grid is turned by the meridian convergence against the world: take the corners' hull.
  const c = [puwgToWorld(minE, minN), puwgToWorld(maxE, minN), puwgToWorld(minE, maxN), puwgToWorld(maxE, maxN)];
  return { minX: Math.min(...c.map((p) => p.x)), minZ: Math.min(...c.map((p) => p.z)), maxX: Math.max(...c.map((p) => p.x)), maxZ: Math.max(...c.map((p) => p.z)) };
};

export const outDir = (argv: readonly string[]): string | undefined => valueOf(argv, "--out");
