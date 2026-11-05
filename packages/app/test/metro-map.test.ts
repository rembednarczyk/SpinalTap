import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, METRO_STATION_IDS } from "@seki/core";
import { METRO_PLANNED, METRO_STATIONS } from "@seki/sim";
import { NEAR_MAX, NEAR_RADIUS } from "@seki/ui";
import { buildCityMap } from "../src/city-map";
import { metroLayerVm, metroMapVm, metroNear } from "../src/presenters/metro-map";
import { frame, setup, steps, teleport } from "./story-helpers";

/**
 * The metro line as a layer (ADR-0071 stage 1), without a renderer (ADR-0046): the layer the app
 * builds from the simulation's content, the kiosk's route and preview, and a ticket in two steps
 * at a real kiosk.
 */
describe("the metro layer", () => {
  it("goes out with the city map: four stations on the tunnel, today's kiosks as entrances, two possible stations", () => {
    const metro = buildCityMap().metro!;
    expect(metro.stations.map((s) => s.id)).toEqual([...METRO_STATION_IDS]);
    expect(metro.stations.map((s) => s.district)).toEqual(["Krakowskie Przedmieście", "Stare Miasto", "Podzamcze", "Nabrzeże Bystrzycy"]);
    for (const s of metro.stations) {
      const kiosk = METRO_STATIONS.find((m) => m.id === s.id)!.kiosk;
      expect(s.entrances).toEqual([{ label: "A", name: s.name, x: Math.round(kiosk.x * 10) / 10, z: Math.round(kiosk.z * 10) / 10 }]);
    }
    // Each leg starts at its station and ends at the next one.
    metro.legs.forEach((leg, i) => {
      expect(leg.slice(0, 2)).toEqual([metro.stations[i]!.x, metro.stations[i]!.z]);
      expect(leg.slice(-2)).toEqual([metro.stations[i + 1]!.x, metro.stations[i + 1]!.z]);
    });
    expect(metro.planned.map((p) => [p.name, p.from])).toEqual([
      ["Ogród Saski", "shinsekai"],
      ["Lublin Główny", "kanal"],
      ["Kalinowszczyzna", "targ"],
    ]);
    // The curator's places (T-151…T-153): about 0.8 km west along Krakowskie and Racławickie, about
    // 1.9 km south to Plac Dworcowy, about 1.1 km along the tunnel east of Plac Zamkowy.
    const [saski, glowny, kalinowszczyzna] = metro.planned;
    expect(saski!.distance).toBeGreaterThan(700);
    expect(saski!.distance).toBeLessThan(900);
    expect(glowny!.distance).toBeGreaterThan(1800);
    expect(glowny!.distance).toBeLessThan(2000);
    expect(kalinowszczyzna).toMatchObject({ x: 1738, z: 386, path: [] });
    expect(kalinowszczyzna!.distance).toBeGreaterThan(1050);
    expect(kalinowszczyzna!.distance).toBeLessThan(1200);
    // A station on the line sits on a point of its leg.
    const leg = metro.legs[2]!;
    expect(leg.some((v, i) => i % 2 === 0 && v === 1738 && leg[i + 1] === 386)).toBe(true);
    expect(metroLayerVm()).toEqual(metro);
    expect(METRO_PLANNED).toHaveLength(3);
  });

  it("finds up to four marked things within 150 m of a station, the nearest first", () => {
    const targ = metroNear("targ");
    expect(targ).toHaveLength(NEAR_MAX);
    expect(targ.map((n) => n.distance)).toEqual([...targ.map((n) => n.distance)].sort((a, b) => a - b));
    expect(targ.every((n) => n.distance <= NEAR_RADIUS)).toBe(true);
    expect(targ.map((n) => n.kind)).toContain("shop");
    // Brama Krakowska: the capsule room is 120 m off; Plac Litewski has nothing within 150 m (Kaito is 164 m away).
    expect(metroNear("kanal")).toEqual([expect.objectContaining({ kind: "hideout", label: "metro.near.hideout", distance: 120 })]);
    expect(metroNear("shinsekai")).toEqual([]);
    expect(metroNear("doki")).toEqual([expect.objectContaining({ kind: "contract", name: "Genzō" })]);
  });

  it("prices every stop and keeps the fares and times of the rules", () => {
    const map = metroMapVm("shinsekai", false, "en", "doki");
    expect(map.stops.map((s) => [s.fare, s.stops, s.seconds])).toEqual([
      [0, 0, 0],
      [20, 1, 7],
      [25, 2, 9],
      [30, 3, 11],
    ]);
    expect(map.preview).toMatchObject({ id: "doki", fare: 30, stops: 3, seconds: 11, route: ["shinsekai", "kanal", "targ", "doki"] });
    // The platform itself is no destination.
    expect(metroMapVm("shinsekai", false, "en", "shinsekai")).toMatchObject({ selected: null, preview: null });
  });
});

describe("the kiosk in the session", () => {
  it("opens the line map at a real kiosk, shows the route first and rides only after the ticket", () => {
    const { session, ui } = setup();
    session.newGame();
    expect(ui.getState().map?.metro?.stations).toHaveLength(4);
    const from = METRO_STATIONS.find((s) => s.id === "kanal")!;
    teleport(session, from.kiosk.x + Math.sin(from.yaw), from.kiosk.z + Math.cos(from.yaw), from.yaw + Math.PI);
    steps(session, 1);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().metroMap?.from).toBe("kanal");
    const eddies = session.sim.domain.wallet.eddies;
    session.intents.selectMetroStop("targ");
    const preview = ui.getState().metroMap?.preview;
    expect(preview).toMatchObject({ name: "Plac Zamkowy", district: "Podzamcze", fare: 20, seconds: 7, route: ["kanal", "targ"] });
    expect(preview?.near.length).toBeGreaterThan(0);
    // The first step buys nothing: no ride, no money gone, the kiosk still open.
    steps(session, 30);
    expect(ui.getState().metroRide).toBeNull();
    expect(session.sim.domain.wallet.eddies).toBe(eddies);
    expect(ui.getState().metroMap?.selected).toBe("targ");
    // A second choice moves the route; the ticket is for the last one.
    session.intents.selectMetroStop("doki");
    expect(ui.getState().metroMap?.preview?.route).toEqual(["kanal", "targ", "doki"]);
    session.intents.buyMetroTicket();
    expect(ui.getState().metroMap).toBeNull();
    for (let i = 0; i < 60 * 30 && session.sim.district !== "doki"; i++) {
      session.step(EMPTY_INPUT);
      session.render(0);
    }
    expect(session.sim.district).toBe("doki");
    expect(session.sim.domain.wallet.eddies).toBe(eddies - 25);
  });

  it("writes the kiosk in Polish once chosen, the names of Lublin stay", () => {
    const { session, ui } = setup();
    session.newGame();
    session.intents.changeSettings({ locale: "pl" });
    session.debug.openMetro("targ");
    session.intents.selectMetroStop("shinsekai");
    expect(ui.getState().metroMap).toMatchObject({ line: "Linia Kanjō", selected: "shinsekai", preview: { name: "Plac Litewski", district: "Krakowskie Przedmieście", near: [] } });
  });
});
