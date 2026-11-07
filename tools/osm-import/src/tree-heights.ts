/**
 * Measured heights of the city's trees (G-422, T-195), metres from the ground to the crown's top,
 * by OSM node id. OSM `height` where the map has it (the two oaks of Plac Litewski, pomniki
 * przyrody); else NMPT GUGiK 0.5 m (WCS, 6.11.2026, PL-KRON86-NH): the highest surface within 3 m
 * of the tree, off the buildings' outlines, less the NMT under it (`data/terrain`). The surface
 * model was fetched for Plac Litewski and its edges only; a tree not in the table keeps the random
 * size of its seed. Where the surface model shows no crown (under 3 m: a young tree or one planted
 * since) the tree takes the smallest size of `TREE_SCALE`.
 */
import { TREE_CROWN, measuredTreeVariant, plainTreeVariant, treeHeight, treeScale, treeSpecies, withTreeSpecies } from "../../../packages/core/src/world/trees.ts";
import type { Pt } from "./geometry.ts";
import type { Site } from "./props-site.ts";

export const TREE_HEIGHTS: Readonly<Record<string, number>> = {
  // plac-litewski.tree
  n4934057667: 6.3, n4934057668: 6.2, n4934057669: 6, n4934057670: 5.6, n4934057671: 6.8, n4934057672: 10.1, n4934057673: 10.5, n4934057674: 6.3,
  n4934057675: 8.4, n4934057676: 7.5, n4934057677: 8.1, n4934057678: 8.5, n4934057679: 8.6, n4934057680: 9.7, n4934057681: 9, n4934057682: 8.9,
  n4934057683: 16.9, n4934090622: 13.1, n4934090623: 20, n4934090624: 22, n4934090625: 18.9, n4934090634: 20.6, n4935401586: 17.5, n5095226282: 5.6,
  n5095226287: 5.5, n5196773146: 10.3, n5959783384: 15.9, n5961045137: 19.7, n5961146053: 16.7, n5961157701: 18.2, n5961157721: 10, n5961157827: 13.1,
  n5961157861: 6.4, n5961157893: 15.4, n5975804374: 18.2, n5975804375: 15.9, n5975804376: 16.6, n5975804377: 18.9, n5975804378: 20.4, n5975804379: 23,
  n5975804380: 19, n5975804381: 18.1, n5975804382: 18.7, n5975804383: 11, n5975804384: 12.3, n5975804985: 10.1, n5975804986: 7.4, n5975804987: 13.9,
  n5975804988: 14.5, n5975804989: 17.3, n5975804990: 20.6, n5975804991: 12.1, n5975804992: 9, n5975804993: 13.5, n5975804997: 14.5, n5975804998: 10.2,
  n5975804999: 16.7, n5975805000: 8.6, n5975805001: 17, n5975805002: 20.7, n5975805003: 20.5, n5975805004: 21.8, n5975805005: 21.7, n5975805006: 20.6,
  n5975805007: 17, n5975805008: 17.1, n5975805009: 20.2, n5975805010: 21.3, n5975805011: 20.2, n5975805012: 17.4, n5975805013: 20.6, n5975805014: 15.3,
  n5975805015: 21, n5975805016: 19.7, n5975805017: 20.3, n7088942255: 8.7, n7088942256: 2.1, n7088942257: 4.3, n7088942258: 10.5, n7088942259: 8.4,
  n7088942260: 8.1, n7088942261: 18.4, n7088942262: 12.5, n7088942263: 17.5, n9254114394: 10.9, n9254114407: 10.1, n9254114408: 10, n9254114409: 10.8,
  n9254114410: 10.8, n9254114411: 13.7, n9254114412: 5.5, n9254114413: 6.6, n9254189463: 4.8, n9254189470: 4.3, n9281344375: 6.4, n9281344376: 15.4,
  // kp-zachod.tree
  n8278999752: 3.2,
  // krakowskie-reszta.tree
  n4934057665: 1, n4934057666: 7.2, n5939812678: 15.3, n5959783343: 14.9, n5959783344: 16.8, n8221232794: 17.1, n8278999745: 8, n8278999746: 9.8,
  n8278999747: 14.7, n8278999748: 6.6, n8278999749: 14.5, n9254081934: 14, n9254081935: 14, n9254081936: 14, n9254081937: 14.1, n9254189434: 0.5,
  n9443510353: 17.5, n9443510354: 17.5, n9443510355: 17.6, n10704862460: 5.3, n10704862461: 5.3, n10704862462: 5.3, n10704862463: 4.2, n10704862464: 3.7,
  n10704862465: 3.5, n10704862466: 13.4,
  // ogrod-saski-okolice.tree
  n2410102233: 16.2, n2410102242: 16.4, n2410102245: 15.9, n2410102339: 17.3, n9254189436: 12.1, n9281344374: 6.4, n9331221701: 10.8, n9331221702: 12,
  n9331221703: 0.4,
};

/** Directions the crown's reach is tried in, at its full reach and at half of it. */
const AROUND = 16;

/** Whether a crown reaching `r` from the trunk at p stays off every building's outline. */
const clearOfWalls = (site: Site, p: Pt, r: number): boolean => {
  for (let i = 0; i < AROUND; i++) {
    const a = (2 * Math.PI * i) / AROUND;
    for (const d of [r, r / 2]) if (site.surfaceAt({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d }) === "building") return false;
  }
  return true;
};

/**
 * A tree's variant from its seed: of `species` where OSM names it (`tree-species.ts`, G-423), else
 * the seed's, grown to its measured height where the table has one. A crown grown past its seed's
 * size stops short of the walls it would reach into (the renderer's crown would hang through the
 * facade), and one that cannot grow at all clear of them keeps its seed's.
 */
export const treeVariant = (site: Site, key: string, p: Pt, seed: number, species?: number): number => {
  const plain = species === undefined ? plainTreeVariant(seed) : withTreeSpecies(plainTreeVariant(seed), species);
  const s = treeSpecies(plain);
  const h = TREE_HEIGHTS[key];
  if (h === undefined) return plain;
  const reach = TREE_CROWN[s]!;
  const from = treeScale(plain);
  let v = measuredTreeVariant(seed, h, s);
  if (treeScale(v) <= from) return v;
  while (!clearOfWalls(site, p, reach * treeScale(v))) {
    v = measuredTreeVariant(seed, treeHeight(v) - 0.1, s);
    if (treeScale(v) <= from) return plain;
  }
  return v;
};
