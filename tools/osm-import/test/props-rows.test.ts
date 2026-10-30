import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { crossingBand, crossingBands, inCrossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands.ts";
import { BOLLARD, POLE_SHAFT, alongSegment, anchors, bollardChains, chainSegments, chainThrough, distanceToPiece, furnitureRadius } from "../../../packages/sim/src/content/lublin/furniture.ts";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { REPO } from "../src/paths.ts";
import { type PropsPlan, generateProps } from "../src/props-gen.ts";
import { chainBetween, clearMouths, postRows, stringRows } from "../src/props-rows.ts";
import { Site } from "../src/props-site.ts";

const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const PLAN = JSON.parse(readFileSync(join(REPO, "docs/world/lublin-props.todo.json"), "utf8")) as PropsPlan;
const pieces = [...generateProps(PLAN, CHUNKS).byChunk.values()].flat();
const posts = pieces.filter((i) => i.prop === "bollard");
const BANDS = crossingBands(CHUNKS);
const site = new Site(CHUNKS);

/** The post's +x in the world (the renderer's frame), along which its first chain runs. */
const sideOf = (i: StreetPropItem) => ({ x: Math.cos(i.yaw), z: -Math.sin(i.yaw) });
const post = (x: number, z: number): StreetPropItem => ({ prop: "bollard", x, y: 0, z, yaw: 0, variant: 0 });
/** What a chain ending at `to` hangs on: a post's face or a pole's shaft. */
const holds = (o: StreetPropItem, to: { x: number; z: number }) => (o.prop === "bollard" ? distanceToPiece(o, to.x, to.z) <= 0.2 : anchors(o, to));

describe("rows of bollards and their chains (G-032)", () => {
  it("strings near, nearly collinear posts into rows, in order, and leaves the far ones alone", () => {
    const line = [0, 2, 4.5, 6.5, 12, 14].map((x) => ({ x, z: 0 }));
    // A corner: the post at (14, 2) turns 90° off the row's end, so it starts no chain from it.
    expect(postRows([...line, { x: 14, z: 2 }, { x: 40, z: 40 }])).toEqual([[0, 1, 2, 3], [4, 5], [6], [7]]);
    expect(postRows([...line].reverse())).toEqual([
      [5, 4, 3, 2],
      [1, 0],
    ]);
    // Something between two posts blocks the link, and the row breaks there.
    expect(postRows([0, 2, 4, 6].map((x) => ({ x, z: 0 })), (a, b) => Math.min(a, b) === 1)).toEqual([[0, 1], [2, 3]]);
  });

  it("turns a lone post along the kerb, with no chain", () => {
    const lone: StreetPropItem = { ...post(5, 5), yaw: 1 };
    const [p] = stringRows([lone], () => ({ x: 0, z: 1 }));
    expect(Math.abs(sideOf(p!).z)).toBeCloseTo(1, 3);
    expect(bollardChains(p!)).toEqual([]);
  });

  it("hangs the chain on a lamp standing in the row: up to its shaft and on from it (G-039)", () => {
    const lamp: StreetPropItem = { prop: "lamp-road", x: 1.5, y: 0, z: 0.2, yaw: 0, variant: 0 };
    const row = stringRows([post(0, 0), post(3, 0.1), post(5.5, 0)], () => null, undefined, (a, b) => (a.x === 0 && b.x === 3 ? lamp : undefined));
    const [a, b, c] = row.map(chainSegments);
    // The first post's chain ends on the lamp's shaft, the second holds one back to it and one on to the third.
    expect(a).toHaveLength(1);
    expect(Math.hypot(a![0]!.to.x - lamp.x, a![0]!.to.z - lamp.z)).toBeCloseTo(POLE_SHAFT["lamp-road"]!, 1);
    expect(b).toHaveLength(2);
    expect(b!.some((s) => Math.abs(Math.hypot(s.to.x - lamp.x, s.to.z - lamp.z) - POLE_SHAFT["lamp-road"]!) < 0.02)).toBe(true);
    expect(b!.some((s) => distanceToPiece(row[2]!, s.to.x, s.to.z) <= 0.02)).toBe(true);
    expect(c).toEqual([]);
  });

  it("moves a post out of a zebra's mouth along its row, or drops it with no room (G-032)", () => {
    // A zebra 3 m wide crossing a road northwards from the kerb at z = 0: its mouth is x -2..2, z -1.5..8.
    const band = crossingBand([-1.5, 0, 1.5, 0, 1.5, 6.5, -1.5, 6.5])!;
    expect(inCrossingBand(band, { x: 1.9, z: -1.4 })).toBe(true);
    expect(inCrossingBand(band, { x: 0, z: -1.7 })).toBe(false);
    const row = [-4, -1, 3].map((x) => post(x, -1));
    const [, moved] = clearMouths(row, [band], () => null, () => true);
    expect(moved!.x).toBeLessThan(-2 - BOLLARD.side / 2);
    expect(Math.abs(moved!.x + 4)).toBeGreaterThanOrEqual(1.2);
    // Closed in on both sides: it goes.
    expect(clearMouths([-3, 0, 3].map((x) => post(x, -1)), [band], () => null, () => true)[1]).toBeNull();
  });

  it("keeps Plac Łokietka's zebra mouth free: the post in it goes, the row ends at its edge", () => {
    const row = posts.filter((i) => Math.abs(i.x - 439) < 1 && i.z < -91 && i.z > -100).sort((a, b) => a.z - b.z);
    // 439,-94.4 stood in the mouth of the zebra from 439.2,-95 eastwards, with no room beside it.
    expect(row.map((i) => i.z)).toEqual([-99.5, -96.8, -91.9]);
    for (const i of row.slice(0, 2)) expect(Math.abs(sideOf(i).x), `${i.x},${i.z} yaw ${i.yaw}`).toBeLessThan(Math.sin((3 * Math.PI) / 180));
    const [first, second, third] = row.map(chainSegments);
    expect(first).toHaveLength(1);
    expect(distanceToPiece(row[1]!, first![0]!.to.x, first![0]!.to.z)).toBeLessThanOrEqual(0.02);
    expect(second).toEqual([]);
    expect(third).toEqual([]);
  });

  it("keeps every post and chain of the city out of the zebras' mouths, holds every chain at its end and runs none through anything", () => {
    expect(posts.length).toBeGreaterThan(250);
    expect(posts.filter((i) => bollardChains(i).length > 0).length).toBeGreaterThan(200);
    const solids = pieces.filter((i) => furnitureRadius(i) > 0);
    const wrong = posts.flatMap((i) => [
      ...(BANDS.some((b) => inCrossingBand(b, i, BOLLARD.side / 2)) ? [`${i.x},${i.z} in a mouth`] : []),
      ...chainSegments(i).flatMap(({ from, to }) => {
        const close = solids.filter((o) => o !== i && Math.hypot(o.x - i.x, o.z - i.z) < 6);
        const end = close.filter((o) => holds(o, to));
        return [
          ...(end.length === 0 ? [`${i.x},${i.z} loose`] : []),
          ...close.filter((o) => !end.includes(o) && chainThrough(from, to, o)).map((o) => `${i.x},${i.z} through ${o.prop} ${o.x},${o.z}`),
          ...(alongSegment(from, to, 0.1).some((p) => site.surfaceAt(p) === "building") ? [`${i.x},${i.z} through a wall`] : []),
          ...(alongSegment(from, to, 0.1).some((p) => BANDS.some((b) => inCrossingBand(b, p))) ? [`${i.x},${i.z} across a mouth`] : []),
        ];
      }),
    ]);
    expect(wrong).toEqual([]);
    // Some chains hang on lamps.
    expect(posts.some((i) => chainSegments(i).some(({ to }) => pieces.some((o) => o.prop !== "bollard" && anchors(o, to))))).toBe(true);
    expect(chainBetween(post(0, 0), post(2, 0))).toEqual({ from: { x: BOLLARD.side / 2, z: 0 }, to: { x: 2 - BOLLARD.side / 2, z: 0 } });
  });
});
