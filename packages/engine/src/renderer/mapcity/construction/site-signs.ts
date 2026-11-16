import { SITE_BOARD, SITE_CRANE, type StreetPropItem, siteCraneLayout } from "@seki/core";
import { groundY } from "@seki/sim";
import { LUBLIN_CONSTRUCTION_SITES, type LublinConstructionSiteData, sitePieces } from "@seki/sim/lublin";
import { letters } from "../../metro/pavilion-signs";
import type { MeshSink, Vec } from "../../mesh-sink";
import type { Box2 } from "../polygon";
import { MAP_SIGN_KIND, signTint } from "../sign-plan";
import { quadUv } from "../sink-ops";
import { glyphCell } from "../venue-plan";

/**
 * The building sites' lights and letters in the map city's signs' mesh (ADR-0087 stage 2), so no
 * draw call more: the crane's beacon on its tower head, blinking at its phase (steady on the
 * phones: `low` has no animation), and the board's three lines in the glyph atlas's letters. The
 * engine knows no catalogs (ADR-0056): the texts come in from the app as they read in the
 * player's language (`setSiteTexts` of the renderer), by the keys the sites' table holds; a key
 * with no text yet draws nothing.
 */

/** The texts by catalog key (`site.board.*`), as the app hands them over. */
export type SiteTextMap = Readonly<Record<string, string>>;

/** The board texts the renderer holds, and a version that moves when they change: the map city builds its boards' cells again. */
export class SiteTexts {
  texts: SiteTextMap = {};
  version = 0;

  /** New texts; the same ones again change nothing. */
  set(texts: SiteTextMap): void {
    const keys = Object.keys(texts);
    if (keys.length === Object.keys(this.texts).length && keys.every((k) => this.texts[k] === texts[k])) return;
    this.texts = { ...texts };
    this.version++;
  }
}

/** The board's lines (m over its foot): the middle and the letters' height of the name, the developer, the term. */
export const BOARD_LINES = [
  { y: SITE_BOARD.top - 0.27, h: 0.17 },
  { y: SITE_BOARD.top - 0.56, h: 0.11 },
  { y: SITE_BOARD.top - 0.8, h: 0.11 },
] as const;
/** How far in from the board's sides the lines keep (m), and off its face. */
const MARGIN = 0.18;
const FACE = 0.04;
/** The beacon's half size (m) and its colour; the lines' colours by the board's design. */
const BEACON = 0.35;
const BEACON_RED = "#ff2a1a";
const BOARD_TINTS = ["#bff6ff", "#ffd0f2", "#ffe6b0", "#d0ffd8"] as const;

const UV = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

/** A piece's local point (along, up, across) in the world, its foot on the game's ground. */
const at = (p: StreetPropItem, x: number, y: number, z: number, foot: number): Vec => ({
  x: p.x + x * Math.cos(p.yaw) + z * Math.sin(p.yaw),
  y: foot + y,
  z: p.z - x * Math.sin(p.yaw) + z * Math.cos(p.yaw),
});

/** A text as the atlas can draw it: upper case, a letter it lacks a space, spaces single. */
export const boardText = (text: string): string =>
  [...text.toUpperCase()]
    .map((c) => (glyphCell(c) === null ? " " : c))
    .join("")
    .replace(/ +/g, " ")
    .trim();

const inBox = (p: StreetPropItem, b: Box2): boolean => p.x >= b.minX && p.x < b.maxX && p.z >= b.minZ && p.z < b.maxZ;

/** The beacon: two crossed quads on the tower head, each both ways (the signs cull their backs), seen from every side. */
const beacon = (sink: MeshSink, p: StreetPropItem, foot: number, lite: boolean): void => {
  const c = siteCraneLayout(p.variant);
  const top = foot + c.height + 0.25;
  const uv2 = [c.phase / SITE_CRANE.phases, lite ? MAP_SIGN_KIND.tube : MAP_SIGN_KIND.strobe] as const;
  const color = signTint(BEACON_RED, 1.4);
  for (const [dx, dz] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const) {
    const q = (s: number, h: number): Vec => ({ x: p.x + dx * s * BEACON, y: top + h * BEACON, z: p.z + dz * s * BEACON });
    quadUv(sink, [q(-1, -1), q(1, -1), q(1, 1), q(-1, 1)], { x: dz, y: 0, z: -dx }, color, UV, uv2);
  }
};

/** The board's lines on its face (local +z), each squeezed to the board's width. */
const boardLines = (sink: MeshSink, p: StreetPropItem, foot: number, keys: readonly string[], texts: SiteTextMap): void => {
  const n: Vec = { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) };
  const tint = BOARD_TINTS[p.variant % BOARD_TINTS.length]!;
  keys.forEach((key, k) => {
    const text = boardText(texts[key] ?? "");
    const line = BOARD_LINES[k]!;
    if (text) letters(sink, text, at(p, 0, line.y, FACE, foot), n, line.h, SITE_BOARD.width - 2 * MARGIN, tint);
  });
};

/**
 * The sites' beacons and boards' letters standing in a cell (half-open bounds); how many pieces
 * it lit. The cell builder calls it only for a cell that has signs already.
 */
export const planSiteSigns = (
  sink: MeshSink,
  bounds: Box2,
  texts: SiteTextMap,
  lite: boolean,
  sites: readonly LublinConstructionSiteData[] = LUBLIN_CONSTRUCTION_SITES,
  groundAt: (x: number, z: number) => number = groundY,
): number => {
  let n = 0;
  for (const s of sites) {
    for (const p of sitePieces([s])) {
      if (!inBox(p, bounds)) continue;
      if (p.prop === "site-crane") beacon(sink, p, groundAt(p.x, p.z), lite);
      else if (p.prop === "site-board" && s.board) boardLines(sink, p, groundAt(p.x, p.z), [s.board.name, s.board.developer, s.board.term], texts);
      else continue;
      n++;
    }
  }
  return n;
};

/** Where the sites' boards stand: the cells to build again when the texts change. */
export const siteBoardSpots = (sites: readonly LublinConstructionSiteData[] = LUBLIN_CONSTRUCTION_SITES): Box2[] =>
  sitePieces(sites)
    .filter((p) => p.prop === "site-board")
    .map((p) => ({ minX: p.x - 1, maxX: p.x + 1, minZ: p.z - 1, maxZ: p.z + 1 }));
