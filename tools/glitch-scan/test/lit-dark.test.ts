import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src";
import { LUBLIN_STREET_PROPS } from "../../../packages/sim/src/content/lublin";
import { DISTRICTS } from "../../osm-import/src/config.ts";
import { loadLitWays } from "../../osm-import/src/props-osm.ts";
import { darkMetres, litStreetDark } from "./lit-dark";

const lamp = (prop: string, x: number, z: number) => ({ prop, x, y: 0, z, yaw: 0, variant: 0 }) as unknown as StreetPropItem;
const way = (tags: Record<string, string>, x1: number) => ({ id: 7, tags: { highway: "residential", lit: "yes", ...tags }, pts: [{ x: 0, z: 0 }, { x: x1, z: 0 }] });
const everywhere = () => true;

describe("lit ways far from every lamp (G-798)", () => {
  it("finds the samples of a lit way more than 30 m from every lamp, 5 m each", () => {
    const found = litStreetDark([way({ name: "Cicha" }, 100)], [lamp("lamp-road", 0, 6), lamp("bench", 100, 0)], everywhere);
    expect(found.map((f) => f.at)).toEqual(["32.5,0.0", "37.5,0.0", "42.5,0.0", "47.5,0.0", "52.5,0.0", "57.5,0.0", "62.5,0.0", "67.5,0.0", "72.5,0.0", "77.5,0.0", "82.5,0.0", "87.5,0.0", "92.5,0.0", "97.5,0.0"]);
    expect(found[0]!.what).toBe("w7 Cicha 5.0 m dark");
    expect(darkMetres(found)).toBe(70);
  });

  it("counts any lamp, a wall lantern too, and no way OSM does not light or off the map", () => {
    expect(litStreetDark([way({}, 60)], [lamp("lamp-wall-lantern", 30, 4)], everywhere)).toHaveLength(0);
    expect(litStreetDark([way({ lit: "no" }, 100), way({ tunnel: "yes" }, 100), way({ highway: "construction" }, 100)], [], everywhere)).toHaveLength(0);
    expect(litStreetDark([way({}, 100)], [], (x) => x < 50)).toHaveLength(10);
  });

  it("finds the city's lit streets the plan of 29.10 left dark lit (G-798, T-293)", () => {
    // Narutowicza 107 m, Peowiaków 93 m and Bernardyńska 74 m dark in the strip south of z = −200, Dziedziniec Zamkowy 226 m.
    const ways = loadLitWays().filter((w) => [215824205, 40049337, 93760059, 383162808].includes(w.id));
    expect(ways).toHaveLength(4);
    const onMap = (x: number, z: number) => DISTRICTS.some(({ rect: r }) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
    expect(darkMetres(litStreetDark(ways, Object.values(LUBLIN_STREET_PROPS).flat(), onMap))).toBe(0);
  });
});
