import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { METRO_ENTRANCES } from "../../../packages/sim/src/content/metro";
import { pavilion } from "../../../packages/sim/src/content/metro-pavilion";
import { mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { metroBlocked, metroExitBare, metroNearHeritage, metroShaftOpen } from "./metro-entrances";

const OSM_DIR = join(__dirname, "../../../data/osm");
const OSM = mergeOsm(
  readdirSync(OSM_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parseExtract(readFileSync(join(OSM_DIR, f), "utf8"))),
);

/** An entrance at a place of the old kiosks, built as the game builds the pavilions. */
const at = (x: number, z: number, along: "x" | "z" = "x"): (typeof METRO_ENTRANCES)[number] => {
  const spot = { x, z, along, opens: 1 as const };
  const p = pavilion(spot);
  return { ...p, label: "A", name: "test", spot, chunk: "test", station: "kanal", platform: null, ticket: p.arrival, ticketYaw: p.arrivalYaw, hallSpot: p.arrival, hallYaw: p.arrivalYaw };
};

describe("the metro entrances' checks (ADR-0071 stage 2)", () => {
  it("finds the old kiosks' neighbours of G-307: Struga's and Rogowski's tablets and the Brama Krakowska", () => {
    const struga = metroNearHeritage(OSM, () => false, [at(158.1, -57.9)]).map((f) => f.what);
    expect(struga.some((w) => w.includes("n12785177414"))).toBe(true);
    const brama = metroNearHeritage(OSM, () => false, [at(489.7, -76.3)]).map((f) => f.what);
    expect(brama.some((w) => w.includes("n13252649322"))).toBe(true);
    expect(brama.some((w) => w.includes("r7224409"))).toBe(true);
  });

  it("finds a car's lane by the curator's first Plac Łokietka (441; -107) and nothing by the one built", () => {
    expect(metroBlocked([], [], [{ id: "lane", points: [[443.3, -130], [443.3, -90]] } as never], [at(441, -107, "z")])).toHaveLength(1);
    expect(metroBlocked([], [], [{ id: "lane", points: [[443.3, -130], [443.3, -90]] } as never], [METRO_ENTRANCES[1]!])).toEqual([]);
  });

  it("finds a shaft with a wall left out", () => {
    const e = at(100, 100);
    expect(metroShaftOpen([e])).toEqual([]);
    // The end wall's plinth: 0.25 m thick along the long side (x here).
    const walls = e.props.filter((p) => !(p.view.kind === "block" && p.view.material === "concrete" && Math.abs(p.view.size.x - 0.25) < 1e-6 && p.view.size.y > 2));
    expect(metroShaftOpen([{ ...e, props: walls }]).map((f) => f.what)).toEqual([expect.stringContaining("no wall")]);
  });

  it("finds the Dworzec Autobusowy's opening onto bare terrain and none where the ground is paved (G-332)", () => {
    const dworzec = METRO_ENTRANCES.find((e) => e.station === "targ" && e.label === "B")!;
    expect(metroExitBare([dworzec])).toEqual([]);
    expect(metroExitBare([dworzec], [])).toHaveLength(30);
    const paved = [{ x: 700, z: 360 }, { x: 800, z: 360 }, { x: 800, z: 400 }, { x: 700, z: 400 }];
    expect(metroExitBare([dworzec], [paved])).toEqual([]);
  });

  it("finds every side walled where the shaft's edge and the wall's meet off by a rounding (G-333)", () => {
    // Along z at (489.7; -76.3) the shaft's end, at the opening, lands a rounding past the side walls' ends.
    expect(metroShaftOpen([at(489.7, -76.3, "z"), at(333.3, 77.7, "z")])).toEqual([]);
  });
});
