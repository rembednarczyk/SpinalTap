import { describe, expect, it } from "vitest";
import { WORLD_CHUNKS, WORLD_SCENERY } from "../src/content/world-map";
import { LUBLIN_CHUNKS, RISE_STOREY, buildingView, isLandmark, verticalOf } from "../src/content/lublin";

const all = LUBLIN_CHUNKS.flatMap((c) => c.buildings.map((b) => ({ district: c.district, b })));
const rynek = { x: 582.4, z: -61.2 };

describe("vertical Lublin 2077 (ADR-0051)", () => {
  it("is a pure function of the building and its district", () => {
    for (const { district, b } of all) expect(verticalOf(b, district)).toEqual(verticalOf({ ...b }, district));
    // The look decides: the same outline with another seed may rise differently.
    const varied = all.filter(({ district }) => district === "shinsekai-7").map(({ b }) => verticalOf(b, "shinsekai-7")?.rise ?? 0);
    expect(new Set(varied).size).toBeGreaterThan(4);
  });

  it("leaves the landmarks as they are", () => {
    const named = ["Brama Krakowska", "Trybunał Koronny", "Wieża Trynitarska", "Zamek w Lublinie", "Brama Grodzka", "Teatr Stary"];
    for (const name of named) {
      const hit = all.find(({ b }) => b.name === name);
      expect(hit, name).toBeDefined();
      expect(verticalOf(hit!.b, hit!.district), name).toBeUndefined();
    }
    for (const { district, b } of all) {
      if (b.use === "church" || (b.name !== undefined && /Archikatedr|Kościół|Cerkiew/.test(b.name))) expect(verticalOf(b, district), b.name).toBeUndefined();
      if (isLandmark(b)) expect(buildingView(b, district)).not.toHaveProperty("vertical");
    }
  });

  it("keeps the district's rise next to a landmark and tells the renderer where the landmark stands (G-050)", () => {
    const grodzka = all.find(({ b }) => b.id === "w66293355")!;
    const gate = all.find(({ b }) => b.name === "Brama Grodzka")!.b;
    const view = buildingView(grodzka.b, grodzka.district);
    const vertical = view.kind === "building" ? view.vertical : undefined;
    // Grodzka 36a keeps the five storeys of the district's rule over the gate it adjoins.
    expect(vertical?.rise).toBe(15);
    expect(vertical?.rise).toBe(verticalOf(grodzka.b, grodzka.district)?.rise);
    // The gate's outline and top, relative to the house.
    const near = vertical?.landmarks?.find((l) => Math.abs(l.top - (gate.y + gate.height + (gate.roof ?? 0) - grodzka.b.y)) < 1e-6);
    expect(near?.outline).toHaveLength(gate.outline.length / 2);
    expect(near!.outline[0]!.x + grodzka.b.x).toBeCloseTo(gate.outline[0]! + gate.x, 6);
    expect(near!.outline[0]!.z + grodzka.b.z).toBeCloseTo(gate.outline[1]! + gate.z, 6);
    // Only landmarks lower than the superstructure's top, and none for a building with no rise.
    for (const { district, b } of all) {
      const v = buildingView(b, district);
      const vv = v.kind === "building" ? v.vertical : undefined;
      for (const l of vv?.landmarks ?? []) expect(l.top).toBeLessThan(b.height + vv!.rise);
      if (!vv?.rise) expect(vv?.landmarks).toBeUndefined();
    }
  });

  it("rises in whole storeys, most on Krakowskie and Podzamcze, not round the Rynek", () => {
    const rises: Record<string, number[]> = {};
    for (const { district, b } of all) {
      const rise = verticalOf(b, district)?.rise ?? 0;
      expect(rise % RISE_STOREY).toBe(0);
      (rises[district] ??= []).push(rise / RISE_STOREY);
      if (district === "kanal") {
        expect(rise).toBeLessThanOrEqual(RISE_STOREY);
        if (Math.hypot(b.x - rynek.x, b.z - rynek.z) < 80) expect(rise).toBe(0);
      }
    }
    for (const d of ["shinsekai-7", "targ"]) {
      const r = rises[d]!;
      expect(Math.max(...r)).toBe(8);
      expect(r.filter((n) => n > 0).length / r.length).toBeGreaterThan(0.45);
    }
    const mean = (d: string) => rises[d]!.reduce((s, n) => s + n, 0) / rises[d]!.length;
    expect(mean("shinsekai-7")).toBeGreaterThan(mean("kanal") * 5);
    expect(mean("targ")).toBeGreaterThan(mean("kanal") * 5);
  });

  it("hangs the most over the streets of Krakowskie and Podzamcze, the least on the Rynek", () => {
    const clutter = (pick: (d: string, x: number, z: number) => boolean) => {
      const v = all.filter(({ district, b }) => pick(district, b.x, b.z)).map(({ district, b }) => verticalOf(b, district)?.clutter ?? 0);
      return v.reduce((s, n) => s + n, 0) / v.length;
    };
    const rynekMean = clutter((d, x, z) => d === "kanal" && Math.hypot(x - rynek.x, z - rynek.z) < 80);
    expect(clutter((d) => d === "shinsekai-7")).toBeGreaterThan(0.4);
    expect(clutter((d) => d === "targ")).toBeGreaterThan(0.4);
    expect(rynekMean).toBeLessThan(0.15);
  });

  it("grows the solids upwards only: the same parts, bottoms unchanged, the top over the superstructure", () => {
    const views = new Map(WORLD_SCENERY.flatMap((s) => (s.view.kind === "building" ? [[`${s.at.x},${s.at.z}`, s.view] as const] : [])));
    let grown = 0;
    for (const chunk of WORLD_CHUNKS) {
      for (const p of chunk.props) {
        if (!p.scenery || p.view.kind !== "building") continue;
        const rise = p.view.vertical?.rise ?? 0;
        expect(views.get(`${p.center.x},${p.center.z}`)).toBe(p.view);
        for (const prism of p.prisms ?? []) expect(prism.top).toBeCloseTo(p.view.height + rise, 6);
        if (rise > 0) grown++;
      }
    }
    expect(grown).toBeGreaterThan(200);
  });
});
