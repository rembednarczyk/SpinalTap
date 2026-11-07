/**
 * A building's walls from its map tags (G-244): `building:material` (brick, stone, plaster) and
 * `building:colour`. The renderer takes its wall colour from them before its palette by use, so
 * the Gothic brick of the keep and the bastion is not drawn in a church's plaster.
 */
import { type Tags } from "./osm.ts";

export type WallMaterial = "brick" | "stone" | "plaster";

const MATERIALS: Readonly<Record<string, WallMaterial>> = {
  brick: "brick",
  stone: "stone",
  sandstone: "stone",
  limestone: "stone",
  granite: "stone",
  plaster: "plaster",
  render: "plaster",
};

/** CSS colour names the map uses on walls (`building:colour`), as CSS has them. */
const NAMED: Readonly<Record<string, string>> = {
  beige: "#f5f5dc",
  white: "#ffffff",
  ivory: "#fffff0",
  cream: "#fffdd0",
  lightgrey: "#d3d3d3",
  lightgray: "#d3d3d3",
  silver: "#c0c0c0",
  grey: "#808080",
  gray: "#808080",
  darkgrey: "#a9a9a9",
  darkgray: "#a9a9a9",
  yellow: "#ffff00",
  lightyellow: "#ffffe0",
  orange: "#ffa500",
  tan: "#d2b48c",
  brown: "#a52a2a",
  maroon: "#800000",
  red: "#ff0000",
  pink: "#ffc0cb",
  green: "#008000",
  lightgreen: "#90ee90",
  blue: "#0000ff",
  lightblue: "#add8e6",
};

/** A wall colour of the map (`#rgb`, `#rrggbb` or a CSS name) as `#rrggbb`, or null. */
export const parseWallColour = (v: string | undefined): string | null => {
  if (!v) return null;
  const s = v.trim().toLowerCase().split(/[;,]/)[0]!.trim();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${[...s.slice(1)].map((c) => c + c).join("")}`;
  return NAMED[s.replace(/[\s_-]/g, "")] ?? null;
};

/** The walls' material and colour from a building's or a part's own tags; each only when the map has it. */
export const wallOf = (tags: Tags): { readonly material?: WallMaterial; readonly colour?: string } => {
  const material = MATERIALS[tags["building:material"]?.trim().toLowerCase() ?? ""];
  const colour = parseWallColour(tags["building:colour"]);
  return { ...(material ? { material } : {}), ...(colour ? { colour } : {}) };
};
