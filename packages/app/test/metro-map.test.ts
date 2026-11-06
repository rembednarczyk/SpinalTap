import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, METRO_STATION_IDS } from "@seki/core";
import { METRO_PLANNED, METRO_STATIONS, PAVILION } from "@seki/sim";
import { NEAR_MAX, NEAR_RADIUS } from "@seki/ui";
import { buildCityMap } from "../src/city-map";
import { metroLayerVm, metroMapVm, metroNear } from "../src/presenters/metro-map";
import { frame, setup, steps, teleport } from "./story-helpers";

type Entrance = (typeof METRO_STATIONS)[number]["entrances"][number];
const flat = (p: { x: number; z: number }, q: { x: number; z: number }) => Math.hypot(p.x - q.x, p.z - q.z);

/** A point of an entrance's frame (u inwards from its opening, w across). */
const frameAt = (e: Entrance, u: number, w: number): { x: number; z: number } => {
  const mouth = (e.spot.along === "x" ? e.spot.x : e.spot.z) + (e.spot.opens * PAVILION.length) / 2;
  const side = e.spot.along === "x" ? e.spot.z : e.spot.x;
  return e.spot.along === "x" ? { x: mouth - e.spot.opens * u, z: side + w } : { x: side + w, z: mouth - e.spot.opens * u };
};

/** Sprints to (x, z), turning towards it every step, for up to `seconds`; the distance left. */
const walkTo = (session: ReturnType<typeof setup>["session"], q: { x: number; z: number }, seconds = 8): number => {
  for (let i = 0; i < seconds * 60; i++) {
    const p = session.sim.player()!;
    if (flat(p.position, q) < 0.4) break;
    const want = Math.atan2(q.x - p.position.x, q.z - p.position.z);
    steps(session, 1, frame({ moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) }));
  }
  return flat(session.sim.player()!.position, q);
};

/** From the car's door on a platform to the stairs' foot, up both flights and out of the pavilion. */
const walkUp = (session: ReturnType<typeof setup>["session"], e: Entrance): void => {
  const p = e.platform!;
  for (const q of [frameAt(e, p.u.back + 1, 0), frameAt(e, p.u.stepsTop - 0.6, 0), e.hallSpot, e.door]) walkTo(session, q);
};

/**
 * The metro line as a layer (ADR-0071 stages 1 and 2), without a renderer (ADR-0046): the layer
 * the app builds from the simulation's content, the ticket machine's route and preview, and a
 * ticket in two steps at a real machine, in a pavilion's hall (B) or on the platform under it (A, stage 4).
 */
describe("the metro layer", () => {
  it("goes out with the city map: four stations on the tunnel, six pavilions as entrances, three possible stations", () => {
    const metro = buildCityMap().metro!;
    expect(metro.stations.map((s) => s.id)).toEqual([...METRO_STATION_IDS]);
    expect(metro.stations.map((s) => s.district)).toEqual(["Krakowskie Przedmieście", "Stare Miasto", "Podzamcze", "Nabrzeże Bystrzycy"]);
    expect(metro.stations.map((s) => s.entrances.map((e) => `${e.label} ${e.name}`))).toEqual([
      ["A Plac Litewski"],
      ["A Plac Łokietka", "B Alchemia"],
      ["A Plac Zamkowy", "B Dworzec Autobusowy"],
      ["A Nabrzeże"],
    ]);
    for (const s of metro.stations) {
      const def = METRO_STATIONS.find((m) => m.id === s.id)!;
      expect([s.x, s.z]).toEqual([def.node.x, def.node.z]);
      expect(s.entrances.map((e) => [e.x, e.z])).toEqual(def.entrances.map((e) => [e.spot.x, e.spot.z]));
    }
    // Brama Krakowska and Plac Zamkowy sit between their entrances, on Lubartowska and Aleja Tysiąclecia (T-149).
    expect(metro.stations.map((s) => [s.x, s.z])).toEqual([
      [74, 16.9],
      [442, -40],
      [740, 335],
      [2527, 388],
    ]);
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
    // Brama Krakowska from its node on Lubartowska (stage 2): Mori's clinic and Kaito down Krakowskie;
    // Plac Litewski has nothing within 150 m.
    expect(metroNear("kanal")).toEqual([
      expect.objectContaining({ kind: "shop", label: "prompt.shop.mori", distance: 120 }),
      expect.objectContaining({ kind: "contract", name: "Kaito", distance: 140 }),
    ]);
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
    // At the ticket machine on the platform under its entrance A (ADR-0071 stage 4).
    const machine = from.entrances[0];
    teleport(session, machine.ticket.x, machine.ticket.z, machine.ticketYaw, 0, machine.ticket.y);
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

  it("walks down from the street to the machine, rides and walks up onto the destination's street (ADR-0071 stage 2)", () => {
    const { session, ui } = setup();
    session.newGame();
    const from = METRO_STATIONS.find((s) => s.id === "kanal")!.entrances[1]!;
    // From the car park before Alchemia, facing the opening, down the stairs into the hall of B, which keeps its machine.
    teleport(session, from.door.x, from.door.z, from.arrivalYaw + Math.PI, 0, from.door.y);
    steps(session, 1);
    expect(ui.getState().prompt).toBeNull();
    for (let i = 0; i < 6 * 30 && !ui.getState().prompt; i++) steps(session, 1, frame({ moveZ: 1 }));
    expect(ui.getState().prompt).toContain("Ticket");
    expect(session.sim.player()!.position.y).toBeCloseTo(from.floor, 1);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().metroMap?.from).toBe("kanal");
    session.intents.selectMetroStop("targ");
    session.intents.buyMetroTicket();
    steps(session, 1);
    expect(session.sim.player()).toBeUndefined();
    for (let i = 0; i < 60 * 30 && session.sim.domain.metro.ride !== null; i++) steps(session, 1);
    // Off the train on the platform under Plac Zamkowy A, then up both flights and out through the opening.
    const to = METRO_STATIONS.find((s) => s.id === "targ")!.entrances[0];
    expect(flat(session.sim.player()!.position, to.arrival)).toBeLessThan(0.5);
    expect(ui.getState().metroRide).toBeNull();
    walkUp(session, to);
    const out = session.sim.player()!.position;
    expect(flat(out, to.door)).toBeLessThan(0.8);
    expect(out.y).toBeCloseTo(to.door.y, 0);
    expect(session.sim.district).toBe("targ");
  });

  it("walks down both flights to the platform's machine, rides from the platform and gets off on the destination's (ADR-0071 stage 4)", () => {
    const { session, ui } = setup();
    session.newGame();
    const from = METRO_STATIONS.find((s) => s.id === "shinsekai")!.entrances[0];
    const p = from.platform!;
    teleport(session, from.door.x, from.door.z, from.hallYaw + Math.PI, 0, from.door.y);
    steps(session, 1);
    // Down into the hall: no machine there any more, the doorway in its end wall leads on down.
    for (const q of [from.hallSpot, frameAt(from, p.u.wallEnd + 0.2, 0), frameAt(from, p.u.back + 0.8, 0)]) expect(walkTo(session, q)).toBeLessThan(0.6);
    expect(ui.getState().prompt).toBeNull();
    expect(session.sim.player()!.position.y).toBeCloseTo(p.floor, 1);
    for (let i = 0; i < 4 * 30 && !ui.getState().prompt; i++) walkTo(session, from.ticket, 1 / 30);
    expect(ui.getState().prompt).toContain("Ticket");
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().metroMap?.from).toBe("shinsekai");
    session.intents.selectMetroStop("kanal");
    session.intents.buyMetroTicket();
    steps(session, 1);
    expect(ui.getState().metroRide).not.toBeNull();
    expect(session.sim.domain.metro.ride).toMatchObject({ from: "shinsekai", to: "kanal" });
    for (let i = 0; i < 60 * 30 && session.sim.domain.metro.ride !== null; i++) steps(session, 1);
    const to = METRO_STATIONS.find((s) => s.id === "kanal")!.entrances[0];
    const at = session.sim.player()!.position;
    expect(flat(at, to.arrival)).toBeLessThan(0.5);
    expect(at.y).toBeCloseTo(to.platform!.floor, 1);
    expect(session.sim.session.interior).toBe("metro-kanal");
    walkUp(session, to);
    expect(flat(session.sim.player()!.position, to.door)).toBeLessThan(0.8);
    expect(session.sim.session.interior).toBeNull();
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
