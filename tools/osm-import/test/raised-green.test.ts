import { describe, expect, it } from "vitest";
import { ALL_CHUNKS, DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";
import { loadInputs } from "../src/load.ts";
import { parseOsmXml } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";
import { type ChunkOut } from "../src/model.ts";

/** Lawns the map lays above the ground (G-647): a roof's or a deck's green, on the ground only where it is. */

type Area = { readonly ring: readonly [number, number][]; readonly tags: Record<string, string> };

/** A map of closed ways, one per area, and open ways, one per line. */
const mapOf = (areas: readonly Area[], lines: readonly Area[] = []) => {
  let id = 0;
  const nodes: string[] = [];
  const ways: string[] = [];
  const way = (pts: readonly [number, number][], tags: Record<string, string>, closed: boolean) => {
    const refs = pts.map(([x, z]) => {
      const g = worldToGeo({ x, z });
      nodes.push(` <node id="${++id}" lat="${g.lat}" lon="${g.lon}"/>`);
      return id;
    });
    if (closed) refs.push(refs[0]!);
    ways.push(` <way id="${1000 + ways.length}">${refs.map((r) => `<nd ref="${r}"/>`).join("")}${Object.entries(tags).map(([k, v]) => `<tag k="${k}" v="${v}"/>`).join("")}</way>`);
  };
  for (const a of areas) way(a.ring, a.tags, true);
  for (const l of lines) way(l.ring, l.tags, false);
  return parseOsmXml(["<osm>", ...nodes, ...ways, "</osm>"].join("\n"));
};

const rect = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const chunk = [{ id: "test-0-0", district: DISTRICTS[0]!, rect: { minX: -50, minZ: -50, maxX: 150, maxZ: 150 } }];
const flat = () => 190;

const grassAt = (chunks: readonly ChunkOut[], p: Pt): boolean =>
  chunks.some((c) => c.ground.some((g) => g.surface === "grass" && pointInRing(p, Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! })))));

describe("a lawn mapped above the ground (G-647)", () => {
  it("lies on the roof of the garage under it, not under the building on it nor past the garage's edge", () => {
    const map = mapOf([
      { ring: rect(0, 0, 60, 40), tags: { landuse: "grass", layer: "4" } },
      { ring: rect(0, 0, 30, 30), tags: { building: "retail", layer: "2" } },
      { ring: rect(0, 0, 50, 30), tags: { building: "yes", layer: "2", level: "-2" } },
    ]);
    const { chunks } = generate(map, flat, chunk, []);
    expect(grassAt(chunks, { x: 40, z: 15 })).toBe(true);
    expect(grassAt(chunks, { x: 15, z: 15 })).toBe(false);
    expect(grassAt(chunks, { x: 40, z: 35 })).toBe(false);
    expect(grassAt(chunks, { x: 55, z: 15 })).toBe(false);
  });

  it("over no garage, lies on the ground off the buildings and carriageways under it", () => {
    const map = mapOf(
      [
        { ring: rect(0, 0, 60, 40), tags: { landuse: "grass", location: "roof" } },
        { ring: rect(40, 25, 55, 38), tags: { building: "yes" } },
      ],
      [{ ring: [[-10, 10], [70, 10]], tags: { highway: "service" } }],
    );
    const { chunks } = generate(map, flat, chunk, []);
    expect(grassAt(chunks, { x: 30, z: 25 })).toBe(true);
    expect(grassAt(chunks, { x: 30, z: 10 })).toBe(false);
    expect(grassAt(chunks, { x: 47, z: 30 })).toBe(false);
  });

  it("leaves a lawn on the ground as it is mapped, under a building too", () => {
    const map = mapOf([
      { ring: rect(0, 0, 60, 40), tags: { landuse: "grass" } },
      { ring: rect(0, 0, 30, 30), tags: { building: "retail" } },
      { ring: rect(0, 0, 50, 30), tags: { building: "yes", level: "-2" } },
    ]);
    const { chunks } = generate(map, flat, chunk, []);
    for (const p of [{ x: 40, z: 15 }, { x: 15, z: 15 }, { x: 40, z: 35 }]) expect(grassAt(chunks, p)).toBe(true);
  });

  it("lays none of VIVO's roof garden (r11978659) on the ground: off the mall it is the roof of the garage's solid (G-662)", () => {
    const inputs = loadInputs();
    const at = ALL_CHUNKS.filter((c) => c.rect.maxX === 1120 && c.rect.minZ <= 240 && c.rect.maxZ >= 240);
    expect(at).toHaveLength(1);
    const vivo = generate(inputs.osm, inputs.src, at).chunks;
    // The garage's part past the mall's north-east wall stands 11 m over the street (T-261): its
    // roof is the lawn's, the ground under it has none. With G-647 alone it lay there on the ground.
    expect(vivo[0]!.buildings.some((b) => b.id === "T-261/garaz-vivo")).toBe(true);
    expect(grassAt(vivo, { x: 1118.5, z: 234 })).toBe(false);
    expect(grassAt(vivo, { x: 1112, z: 237.5 })).toBe(false);
    // In VIVO, and on the asphalt north of it.
    expect(grassAt(vivo, { x: 1110, z: 200 })).toBe(false);
    expect(grassAt(vivo, { x: 1112, z: 242 })).toBe(false);
  });
});
