// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type MapMetroVm, type MapVm, type UiIntents, createUiStore } from "../src";
import { CityMapPanel } from "../src/citymap/city-map-panel";
import { fitChart } from "../src/metro/metro-kiosk";
import { MetroMap } from "../src/metro/metro-panel";
import { UiContext } from "../src/use-ui";
import { METRO_LAYER, kioskVm } from "./metro-fixture";

/**
 * Where the metro layer puts its rings, tags and names on the kiosk's chart and the map tab
 * (ADR-0071), read back from the SVG: a pinned station on its own branch, entrance letters as big
 * as the names, the names off the lines.
 */

const intents = () => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

const MAP: MapVm = { bounds: { x: 1200, z: 150, w: 3000, d: 800 }, blocks: [], streets: [], metro: METRO_LAYER };

const kiosk = (metro: MapMetroVm = METRO_LAYER) => {
  const store = createUiStore({ screen: "playing", map: { ...MAP, metro }, metroMap: kioskVm("kanal", "doki"), eddies: 100 });
  render(
    <UiContext.Provider value={{ store, intents: intents() }}>
      <MetroMap />
    </UiContext.Provider>,
  );
  // The chart's size where nothing is laid out (`useChartSize`).
  return fitChart(metro, 640, 360).k;
};

const chart = () => screen.getByTestId("metro-chart");

/** The `translate(x y)` of an element, SVG space (y = −z). */
const at = (el: Element): [number, number] => {
  const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el.getAttribute("transform") ?? "");
  return [Number(m?.[1]), Number(m?.[2])];
};

const pointsOf = (el: Element): [number, number][] =>
  (el.getAttribute("points") ?? "")
    .trim()
    .split(" ")
    .map((p) => p.split(",").map(Number) as [number, number]);

/** The names on the chart as boxes in SVG space, the layer's monospace letters 0.66 em wide. */
const nameBoxes = () =>
  [...chart().querySelectorAll(".metro-layer__name")].map((t) => {
    const [x, y0] = at(t.parentElement!);
    const size = Number(t.getAttribute("font-size"));
    const y = y0 + Number(t.getAttribute("y"));
    const half = (t.textContent!.length * 0.66 * size) / 2;
    return { name: t.textContent!, minX: x - half, maxX: x + half, minY: y - size / 2, maxY: y + size / 2 };
  });

/** Whether a polyline runs through a box, sampled every 1/200 of each segment. */
const crosses = (line: [number, number][], b: { minX: number; maxX: number; minY: number; maxY: number }) =>
  line.slice(1).some(([bx, by], i) => {
    const [ax, ay] = line[i]!;
    for (let s = 0; s <= 200; s++) {
      const x = ax + ((bx - ax) * s) / 200;
      const y = ay + ((by - ay) * s) / 200;
      if (x > b.minX && x < b.maxX && y > b.minY && y < b.maxY) return true;
    }
    return false;
  });

const namesOnLines = () => {
  const lines = [...chart().querySelectorAll(".metro-layer__leg, .metro-layer__dash")].map(pointsOf);
  return nameBoxes()
    .filter((b) => lines.some((l) => crosses(l, b)))
    .map((b) => b.name);
};

afterEach(cleanup);

describe("a possible station beyond the kiosk's chart", () => {
  it("sits where its branch leaves the view, the branch ending at its ring", () => {
    kiosk();
    const glowny = screen.getByTestId("metro-planned-lublin-glowny");
    const [x, y] = at(glowny.querySelector("g")!);
    // On the branch from Brama Krakowska (490; −76) to (590; −1840), in SVG space.
    const along = (y - 76) / (1840 - 76);
    expect(along).toBeGreaterThan(0);
    expect(along).toBeLessThan(1);
    expect(Math.abs(x - (490 + along * 100))).toBeLessThan(0.5);
    const dash = pointsOf(glowny.querySelector(".metro-layer__dash")!);
    const end = dash[dash.length - 1]!;
    expect(Math.hypot(end[0] - x, end[1] - y)).toBeLessThan(0.5);
  });
});

describe("the entrances' letters", () => {
  it("are as big on the kiosk's chart as the names, about 11 px", () => {
    const k = kiosk();
    const letter = chart().querySelector(".metro-layer__entrance text")!;
    const name = chart().querySelector(".metro-layer__name")!;
    expect(Number(letter.getAttribute("font-size")) / k).toBeGreaterThanOrEqual(10);
    expect(Number(letter.getAttribute("font-size"))).toBeCloseTo(Number(name.getAttribute("font-size")), 5);
  });

  it("are as big on the map tab as the names", () => {
    const store = createUiStore({ screen: "playing", map: MAP, mapPlayer: { x: 490, z: -70, yaw: 0 } });
    render(
      <UiContext.Provider value={{ store, intents: intents() }}>
        <CityMapPanel />
      </UiContext.Provider>,
    );
    const layer = screen.getByTestId("metro-layer");
    const letter = Number(layer.querySelector(".metro-layer__entrance text")!.getAttribute("font-size"));
    const name = Number(layer.querySelector(".metro-layer__name")!.getAttribute("font-size"));
    expect(letter).toBeCloseTo(name, 5);
  });
});

describe("the names on the kiosk's chart, where there is room off the lines", () => {
  it("keep a possible station's name off its own branch", () => {
    kiosk();
    expect(screen.getByTestId("metro-planned-lublin-glowny").querySelector(".metro-layer__name")).toBeTruthy();
    expect(namesOnLines()).not.toContain("Lublin Główny");
  });

  it("move off a line that turns at a possible station", () => {
    // The tunnel turns north at Kalinowszczyzna and comes back to Nabrzeże from the east: the
    // name over the ring would sit on the line, under it there is room (and no other name near).
    const legs = [...METRO_LAYER.legs.slice(0, 2), [717, 297, 1500, 297, 1500, 1100, 3200, 1100, 3200, 0, 2527, 392]];
    const bent: MapMetroVm = { ...METRO_LAYER, legs, planned: METRO_LAYER.planned.map((p) => (p.id === "kalinowszczyzna" ? { ...p, x: 1500, z: 297 } : p)) };
    kiosk(bent);
    expect(screen.getByTestId("metro-planned-kalinowszczyzna").querySelector(".metro-layer__name")).toBeTruthy();
    expect(namesOnLines()).not.toContain("Kalinowszczyzna");
  });
});
