import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { DISTRICTS } from "../src/config.ts";
import { type Tags, mergeOsm, parseExtract } from "../src/osm.ts";
import { REPO } from "../src/paths.ts";
import { artShape } from "../src/props-art.ts";
import { type PropsPlan, generateProps } from "../src/props-gen.ts";
import { SHAPES } from "../src/props-kinds.ts";

const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const PLAN = JSON.parse(readFileSync(join(REPO, "docs/world/lublin-props.todo.json"), "utf8")) as PropsPlan;
const OSM = mergeOsm(DISTRICTS.map((d) => parseExtract(readFileSync(join(REPO, "data/osm", `${d.slug}.json`), "utf8"))));
const TAGS = new Map<string, Tags>([...OSM.nodes.values()].flatMap((n) => (n.tags ? [[`n${n.id}`, n.tags] as const] : [])));

/** The renderer's monument shapes, by the low bits of `variant`. */
const NAMES = ["obelisk", "figure", "koziolek", "abstract", "stele", "shrine"];
const ART = [...generateProps(PLAN, CHUNKS, TAGS).byChunk.values()].flat().filter((i) => i.prop === "monument" || i.prop === "artwork");
const shapeAt = (x: number, z: number): string | null => {
  const i = ART.find((p) => Math.hypot(p.x - x, p.z - z) < 2.5);
  return i ? (NAMES[i.variant % (SHAPES[i.prop] ?? 1)] ?? "?") : null;
};

describe("monuments and artworks by their tags (G-149)", () => {
  it("gives Lublin's monuments the shape of the real thing, not one from the hash of their id", () => {
    const cases: [string, number, number, string][] = [
      ["Pomnik Unii Lubelskiej", 47.8, -25.7, "obelisk"],
      ["Grób Nieznanego Żołnierza (war_memorial)", -57.5, -21.4, "stele"],
      ["Pomnik Konstytucji 3 Maja (stone block)", -87.1, -22.6, "stele"],
      ["Pomnik AK-WiN (war_memorial)", 744.4, 183.4, "stele"],
      ["Pomnik Wyszyńskiego (statue)", 656.5, -227.2, "figure"],
      ["Figura Matki Bożej (statue)", 599.5, -197.9, "figure"],
      ["Koziołek Kazik", 481.8, -83.3, "koziolek"],
      ["Koziołek Onufry", 411.2, -88.6, "koziolek"],
      ["Koziołek Władek (tagged sculpture)", 379.1, -181.3, "koziolek"],
      ["Kapliczka Jezus Frasobliwy (wayside_shrine)", -102.6, -190.9, "shrine"],
      ["Ogniwa nieskończoności (sculpture)", 925.3, 218.6, "abstract"],
      ["Okno Czasu (installation)", 144.2, -42.9, "stele"],
    ];
    expect(cases.map(([name, x, z]) => [name, shapeAt(x, z)])).toEqual(cases.map(([name, , , shape]) => [name, shape]));
  });

  it("leaves out what is not free-standing: murals, mosaics, a facade's neon, the rope walker over Grodzka", () => {
    const gone: [string, number, number][] = [
      ['Mural "Izmus"', 234.1, 25.8],
      ["Mozaika Serce Miasta", 592, 54.6],
      ["Neon „Przypadek? Nie sądzę!”", 485.6, 11.4],
      ["Sztukmistrz z Lublina na linie", 617.1, 25.8],
      ["Mural (untagged in data/osm)", 569, 113],
    ];
    expect(gone.map(([name, x, z]) => [name, shapeAt(x, z)])).toEqual(gone.map(([name]) => [name, null]));
  });

  it("reads the shape from the tags, with the neutral stele when they name none", () => {
    expect(artShape("n1", { historic: "memorial", memorial: "bust" })).toEqual({ shape: "figure" });
    expect(artShape("n1", { historic: "wayside_cross" })).toEqual({ shape: "shrine" });
    expect(artShape("n1", { historic: "memorial", memorial: "plaque" })).toEqual({ skip: "plaque" });
    expect(artShape("n1", { tourism: "artwork", artwork_type: "relief" })).toEqual({ skip: "relief" });
    expect(artShape("n1", { tourism: "artwork", artwork_type: "sculpture", name: "Koziołek Ziutek" })).toEqual({ shape: "koziolek" });
    expect(artShape("n1", { tourism: "artwork", artwork_type: "sculpture" })).toEqual({ shape: "abstract" });
    expect(artShape("n1", { historic: "memorial", memorial: "war_memorial" })).toEqual({ shape: "stele" });
    expect(artShape("group#3", undefined)).toEqual({ shape: "stele" });
    expect(artShape("group#3", undefined, "shrine")).toEqual({ shape: "shrine" });
  });

  it("draws an abstract sculpture only for a node tagged artwork_type=sculpture", () => {
    const plan = PLAN.items.flatMap((item) => (item.position ? [item.position] : (item.points ?? []).map(([x, z]) => ({ x, z }))).map((p, k) => ({ p, osm: Array.isArray(item.osm) ? item.osm[k] : item.osm })));
    const wrong = ART.filter((i) => NAMES[i.variant % (SHAPES[i.prop] ?? 1)] === "abstract").flatMap((i) => {
      const from = plan.filter((q) => q.osm && Math.hypot(q.p.x - i.x, q.p.z - i.z) < 4).map((q) => TAGS.get(q.osm!));
      return from.some((t) => t?.artwork_type === "sculpture" && !/kozio/i.test(t.name ?? "")) ? [] : [`${i.x},${i.z}`];
    });
    expect(ART.length).toBeGreaterThan(30);
    expect(wrong).toEqual([]);
  });
});
