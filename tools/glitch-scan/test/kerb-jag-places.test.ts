import { describe, expect, it } from "vitest";
import type { P2 } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { GroundIndex } from "./ground-index";
import { kerbLines, zigzags } from "./kerb-jag";

/**
 * G-837: the places where the kerbs of the widened carriageways (`kerbFills`) stepped or zigzagged,
 * read off the city's ground as generated. The kerb lines are walked with points 0.5 m apart at the
 * most, so a jag is found however far apart the outline's own vertices lie.
 */
const densified = (pts: readonly P2[]): [number, number][] => {
  const out: [number, number][] = pts.length ? [[pts[0]!.x, pts[0]!.z]] : [];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1]!, pts[i]!];
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5);
    for (let k = 1; k <= n; k++) out.push([a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n]);
  }
  return out;
};

let jags: [number, number, number][] | null = null;
/** The kerbs' zigzags in the city: where, and how far they stray (m). */
const cityJags = () =>
  (jags ??= kerbLines(new GroundIndex(MAP_CHUNKS)).flatMap((line) => {
    const pts = densified(line.pts);
    return zigzags(pts).map((z): [number, number, number] => [pts[z.k]![0], pts[z.k]![1], z.dev]);
  }));

describe("the kerbs of the widened carriageways run smooth (G-837)", () => {
  it.each<[string, number, number]>([
    // Where the gap to the paving closed under 1 m (`ROAD_GAP`), the widened kerb stepped back 1 m to the estimated edge.
    ["Kołłątaja's west kerb", -103.6, -168.4],
    ["Świętoduska's west kerb", 357.6, -18.9],
    ["Ruska's south kerb by Podwale", 692.1, 556.5],
    ["Ruska's north kerb", 840.4, 503.9],
    ["Mełgiewska's north kerb", 2681.9, 103.6],
    // The asphalt's new edge, each sample rounded to 0.1 m on its own, zigzagged into a zebra's end.
    ["Kapucyńska's kerb at its zebra", 154.4, -201.4],
    ["Łęczyńska's kerb at its zebra", 2663.1, 109.4],
  ])("%s", (_, x, z) => {
    expect(cityJags().filter(([px, pz]) => Math.hypot(px - x, pz - z) < 2).map(([, , dev]) => +dev.toFixed(2))).toEqual([]);
  });
});
