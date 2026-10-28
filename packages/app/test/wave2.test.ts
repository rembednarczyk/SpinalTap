import { describe, expect, it, vi } from "vitest";
import { type AudioCue, type DomainEvents, EMPTY_INPUT, EventBus, type GameCommand, createDomainState } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import type { Entity, Simulation } from "@seki/sim";
import { type UiState, createUiStore } from "@seki/ui";
import { MetroController } from "../src/controllers/metro-controller";
import { RadioController } from "../src/controllers/radio-controller";
import { ShopController } from "../src/controllers/shop-controller";
import { TouchController } from "../src/controllers/touch-controller";
import { debriefVm } from "../src/contract-hud";
import { METRO_GUARDED, metroFare, metroMapVm, stationOfDistrict } from "../src/metro";
import { MAP_ZOOM_DASH, MAP_ZOOM_RUN, TARGET_AREA_RADIUS, createMinimapTracker } from "../src/minimap";
import { createKnotLines, createKnotPool, createKnotRenderer } from "../src/phone";
import { DASH_COOLDOWN_SECONDS } from "../src/presenters/body-hud";
import { sanitizeSettings } from "../src/settings";
import { Wave2Hud } from "../src/wave2-hud";

const fakeSim = (eddies = 500) => {
  const commands: GameCommand[] = [];
  const domain = { ...createDomainState(), wallet: { eddies } };
  const sim = { domain, tick: 0, district: "kanal", enqueue: (c: GameCommand) => commands.push(c) } as unknown as Simulation;
  return { sim: () => sim, commands, raw: sim };
};

const fakeFocus = () => {
  const calls: string[] = [];
  return { focus: { panel: () => calls.push("panel"), settle: () => calls.push("settle") }, calls };
};

const fakeAudio = (cues: AudioCue[]) => ({ play: (c: AudioCue) => cues.push(c), stopAll() {} });

const lines = createKnotLines(STORY_SOURCE);
const domain = () => createDomainState();

describe("knot pools (ADR-0035)", () => {
  it("finds the numbered knots of the story and skips a missing pool", () => {
    const ride = createKnotPool(lines, "metro_ride_", domain);
    expect(ride.size).toBe(10);
    expect(ride.next()?.length).toBeGreaterThan(0);
    const none = createKnotPool(lines, "no_such_knot_", domain);
    expect(none.size).toBe(0);
    expect(none.next()).toBeNull();
    expect(lines("no_such_knot", createDomainState())).toBeNull();
    // The phone keeps its fallback for a missing knot.
    expect(createKnotRenderer(lines)("no_such_knot", createDomainState())).toEqual([{ speaker: null, text: "Nowa wiadomość." }]);
  });

  it("has five inserts per radio station", () => {
    for (const id of ["drift", "yoru", "tessen"]) expect(createKnotPool(lines, `radio_${id}_`, domain).size).toBe(5);
  });
});

describe("metro data", () => {
  it("prices a ride by stops and maps kiosks and districts to platforms", () => {
    expect(metroMapVm("shinsekai", false).stops[0]?.fare).toBe(0);
    expect(metroFare("shinsekai", "kanal")).toBe(20);
    expect(metroFare("doki", "shinsekai")).toBe(30);
    expect(stationOfDistrict("shinsekai-7")).toBe("shinsekai");
    expect(stationOfDistrict("doki")).toBe("doki");
    expect(stationOfDistrict(null)).toBeNull();
    const map = metroMapVm("kanal", true);
    expect(map.stops.map((s) => s.id)).toEqual(["shinsekai", "kanal", "targ", "doki"]);
    expect(map.stops.find((s) => s.here)?.id).toBe("kanal");
    expect(map.refusal).toBe(METRO_GUARDED);
  });
});

describe("MetroController without a session", () => {
  const setup = (opts: { eddies?: number; guarded?: boolean } = {}) => {
    const bus = new EventBus<DomainEvents>();
    const ui = createUiStore({ screen: "playing", prompt: "Bilet" });
    const { sim, commands } = fakeSim(opts.eddies);
    const cues: AudioCue[] = [];
    const { focus, calls } = fakeFocus();
    const metro = new MetroController({ bus, sim, ui, audio: fakeAudio(cues), focus, canOpen: () => true, guarded: () => opts.guarded ?? false, rideLines: createKnotPool(lines, "metro_ride_", domain) });
    return { bus, ui, metro, commands, cues, calls };
  };

  it("opens the line map at a kiosk and buys a ticket with travel-metro, then frees the player", () => {
    const { ui, metro, commands, calls } = setup();
    metro.open("kanal");
    expect(metro.isOpen).toBe(true);
    expect(ui.getState().metroMap?.from).toBe("kanal");
    expect(ui.getState().prompt).toBeNull();
    metro.travelMetro("kanal");
    expect(commands).toEqual([]);
    metro.travelMetro("doki");
    expect(commands).toEqual([{ type: "travel-metro", to: "doki" }, { type: "end-dialogue" }]);
    expect(ui.getState().metroMap).toBeNull();
    expect(calls).toEqual(["panel", "settle"]);
  });

  it("refuses a ticket without money or with the platform watched", () => {
    const poor = setup({ eddies: 10 });
    poor.metro.open("kanal");
    poor.metro.travelMetro("doki");
    expect(poor.commands).toEqual([]);
    expect(poor.cues).toEqual(["denied"]);
    const hot = setup({ guarded: true });
    hot.metro.open("kanal");
    expect(hot.ui.getState().metroMap?.refusal).toBe(METRO_GUARDED);
    hot.metro.travelMetro("doki");
    expect(hot.commands).toEqual([]);
    hot.metro.closeMetro();
    expect(hot.commands).toEqual([{ type: "end-dialogue" }]);
  });

  it("says why the kiosk refused a ticket", () => {
    const toasts: string[] = [];
    const bus = new EventBus<DomainEvents>();
    const cues: AudioCue[] = [];
    new MetroController({ bus, sim: fakeSim().sim, ui: createUiStore(), audio: fakeAudio(cues), focus: fakeFocus().focus, canOpen: () => true, guarded: () => false, rideLines: createKnotPool(lines, "metro_ride_", domain), toast: (_t, text) => toasts.push(text) });
    bus.emit("MetroRefused", { reason: "watched", to: "doki" });
    expect(toasts).toEqual([METRO_GUARDED]);
    expect(cues).toEqual(["denied"]);
  });

  it("shows the ride with ink subtitles from MetroDeparted to MetroArrived", () => {
    const { bus, ui, metro } = setup();
    bus.emit("MetroDeparted", { from: "kanal", to: "doki", seconds: 4 });
    expect(metro.riding).toBe(true);
    const start = ui.getState().metroRide;
    expect(start).toMatchObject({ fromName: "Ulica Kanałowa", toName: "Doki Tessen", progress: 0 });
    expect(start?.caption?.text.length).toBeGreaterThan(0);
    metro.tick(2);
    expect(ui.getState().metroRide?.progress).toBeCloseTo(0.5);
    // Opening a kiosk mid-ride does nothing.
    metro.open("doki");
    expect(metro.isOpen).toBe(false);
    bus.emit("MetroArrived", { station: "doki" });
    expect(ui.getState().metroRide).toBeNull();
    expect(metro.riding).toBe(false);
  });

  it("forgets the ride on a load", () => {
    const { bus, ui, metro } = setup();
    bus.emit("MetroDeparted", { from: "kanal", to: "doki", seconds: 4 });
    metro.reset();
    expect(ui.getState().metroRide).toBeNull();
    expect(metro.riding).toBe(false);
  });
});

describe("RadioController without a session", () => {
  const setup = (radioStation: UiState["settings"]["radioStation"] = null) => {
    const ui = createUiStore();
    ui.setState({ settings: { ...ui.getState().settings, radioStation } });
    const toasts: [string, string][] = [];
    const tuned: (string | null)[] = [];
    const audio = { play() {}, stopAll() {}, setRadioStation: (id: string | null) => tuned.push(id) };
    const pools = new Map<string, ReturnType<typeof createKnotPool>>();
    const radio = new RadioController({
      ui,
      audio,
      changeSettings: (patch) => ui.setState({ settings: { ...ui.getState().settings, ...patch } }),
      inserts: (s) => pools.get(s) ?? pools.set(s, createKnotPool(lines, `radio_${s}_`, domain)).get(s)!,
      toast: (title, text) => toasts.push([title, text]),
      insertSeconds: 10,
    });
    return { ui, radio, toasts, tuned };
  };

  it("walks the dial with B, saves the station and tunes the audio adapter", () => {
    const { ui, radio, toasts, tuned } = setup();
    expect(tuned).toEqual([null]);
    radio.nextRadioStation();
    expect(ui.getState().settings.radioStation).toBe("drift");
    expect(toasts[0]?.[0]).toBe("Neon Drift 88.1");
    radio.nextRadioStation();
    radio.nextRadioStation();
    radio.nextRadioStation();
    expect(radio.station).toBeNull();
    expect(tuned).toEqual([null, "drift", "yoru", "tessen", null]);
    expect(toasts.at(-1)?.[0]).toBe("Radio wyłączone");
  });

  it("plays a saved station from the start and puts inserts up as subtitles", () => {
    const { radio, toasts, tuned } = setup("yoru");
    expect(tuned).toEqual(["yoru"]);
    radio.tick(9);
    expect(toasts).toEqual([]);
    radio.tick(1);
    expect(toasts[0]?.[0]).toBe("Yoru FM 76.5");
    expect(toasts[0]?.[1].length).toBeGreaterThan(0);
    radio.setRadioStation(null);
    radio.tick(60);
    expect(toasts).toHaveLength(2);
  });

  it("works with an audio adapter that has no radio", () => {
    const ui = createUiStore();
    const radio = new RadioController({ ui, audio: { play() {}, stopAll() {} }, changeSettings: () => {}, inserts: () => createKnotPool(lines, "x_", domain), toast: () => {} });
    expect(() => radio.setRadioStation("drift")).not.toThrow();
  });

  it("keeps a saved station through the settings sanitiser", () => {
    expect(sanitizeSettings({ radioStation: "tessen" }).radioStation).toBe("tessen");
    expect(sanitizeSettings({ radioStation: "koi" }).radioStation).toBeNull();
    expect(sanitizeSettings({ mapMarkers: false, highlights: false })).toMatchObject({ mapMarkers: false, highlights: false });
  });
});

describe("TouchController", () => {
  it("merges one dash into the next frame only", () => {
    const touch = new TouchController();
    expect(touch.withTouch(EMPTY_INPUT)).toBe(EMPTY_INPUT);
    touch.touchDash();
    expect(touch.withTouch(EMPTY_INPUT).dash).toBe(true);
    expect(touch.withTouch(EMPTY_INPUT).dash).toBe(false);
  });
});

describe("ShopController and cyberware capacity", () => {
  it("refuses an implant over the capacity with a message", () => {
    const ui = createUiStore({ capacity: { used: 7, max: 8 } });
    const { sim, commands } = fakeSim();
    const shop = new ShopController({ sim, ui, focus: fakeFocus().focus, talk: () => {} });
    shop.open("clinic", "mori");
    shop.buyCyberware("subdermal_weave");
    expect(commands).toEqual([]);
    expect(ui.getState().toasts.at(-1)?.text).toContain("Za mało pojemności");
    ui.setState({ capacity: { used: 2, max: 12 } });
    shop.buyCyberware("subdermal_weave");
    expect(commands).toEqual([{ type: "buy-cyberware", cyberwareId: "subdermal_weave" }]);
  });
});

describe("Wave2Hud presenters", () => {
  const setup = () => {
    const bus = new EventBus<DomainEvents>();
    const ui = createUiStore({ screen: "playing" });
    let tick = 0;
    const hud = new Wave2Hud(bus, ui, {
      playerId: () => 1,
      domain: () => createDomainState(),
      clock: () => "22:00",
      tick: () => tick,
      ticksPerSecond: 10,
      damageMode: () => "off",
      renderKnot: () => [],
      toastMs: 1,
    });
    return { bus, ui, hud, at: (t: number) => (tick = t) };
  };

  it("shows capacity, buffs with time left and the dash cooldown", () => {
    const { bus, ui, hud, at } = setup();
    bus.emit("CyberwareCapacityChanged", { used: 6, max: 10 });
    expect(ui.getState().capacity).toEqual({ used: 6, max: 10 });
    bus.emit("BuffApplied", { buffId: "regen", duration: 30 });
    bus.emit("Dashed", { entityId: 1, air: false, at: { x: 0, y: 0, z: 0 } });
    expect(hud.sync(undefined, false, true)).toMatchObject({ buffs: [{ id: "regen", name: "Regeneracja", left: 30, total: 30 }], dash: { cooldown: DASH_COOLDOWN_SECONDS } });
    expect(hud.dashing).toBe(true);
    at(100);
    const later = hud.sync(undefined, false, true);
    expect(later.buffs?.[0]?.left).toBe(20);
    expect(later.dash?.cooldown).toBe(0);
    expect(hud.dashing).toBe(false);
    bus.emit("BuffEnded", { buffId: "regen" });
    expect(hud.sync(undefined, false, true).buffs).toEqual([]);
  });

  it("toasts a reflected bullet of the player only", () => {
    vi.useFakeTimers();
    const { bus, ui } = setup();
    bus.emit("ProjectileReflected", { defenderId: 2, attackerId: 1, at: { x: 0, y: 0, z: 0 } });
    expect(ui.getState().toasts).toEqual([]);
    bus.emit("ProjectileReflected", { defenderId: 1, attackerId: 3, at: { x: 0, y: 0, z: 0 } });
    expect(ui.getState().toasts.at(-1)?.title).toBe("Pocisk odbity");
    vi.useRealTimers();
  });

  it("shows the disguise, marks who saw through it and warns when it is blown", () => {
    const { bus, ui, hud } = setup();
    bus.emit("DisguiseChanged", { role: "tessen_guard" });
    expect(hud.sync(undefined, false, true).disguise).toEqual({ role: "tessen_guard", label: "Przebranie: ochrona Tessen", blown: false });
    bus.emit("DisguiseBlown", { observerId: 9, role: "tessen_guard" });
    expect(hud.sync(undefined, false, true).disguise?.blown).toBe(true);
    expect(ui.getState().toasts.at(-1)?.title).toBe("Przykrywka spalona");
    expect([...hud.enforcers]).toEqual([9]);
    bus.emit("DisguiseChanged", { role: null });
    expect(hud.sync(undefined, false, true).disguise).toBeNull();
    expect(hud.enforcers.size).toBe(0);
  });

  it("lists hooks of the running contract and clears them with the contract", () => {
    const { bus, ui } = setup();
    bus.emit("ContractHookFound", { contractId: "c1", hookId: "h1", text: "Strażnik pali o 23:00 za magazynem." });
    bus.emit("ContractHookFound", { contractId: "c1", hookId: "h1", text: "Strażnik pali o 23:00 za magazynem." });
    expect(ui.getState().contractHooks).toEqual([{ id: "h1", text: "Strażnik pali o 23:00 za magazynem." }]);
    bus.emit("ContractFailed", { contractId: "c1" } as never);
    expect(ui.getState().contractHooks).toEqual([]);
  });
});

describe("debrief variation", () => {
  it("lists the variation when the contract carries one", () => {
    const e = { contractId: "c1", badges: [], rank: "B", reward: 100, bonus: 0, styleBonus: 0, seconds: 10 } as const;
    const contract = { id: "c1", kind: "eliminate", siteId: "koi_back", targets: 1, reward: 100, status: "cleared", variation: { modifiers: ["night_only", "bodyguards"], security: "lockdown", trait: "drinker", twist: "setup" } };
    expect(debriefVm(e, contract as never).variation).toEqual({ labels: ["tylko nocą", "ochroniarze", "blokada", "cel pije"], twist: "wystawka" });
    expect(debriefVm(e, null).variation).toBeUndefined();
  });
});

describe("minimap of wave 2", () => {
  const contracts = { active: { id: "c1", siteId: "koi_back", targets: 1, reward: 1, status: "active" }, completed: 0 } as const;
  const player = (x: number, prevX: number, sprinting = false) =>
    ({ id: 1, player: true, position: { x, y: 0, z: 0 }, prevPosition: { x: prevX, y: 0, z: 0 }, yaw: 0, posture: { sprinting } }) as unknown as Entity;

  it("shows a target as an area, terminals only with a contract, and enforcers only in disguise", () => {
    const track = createMinimapTracker();
    const hired = { id: 5, key: "c1-g0", tag: "contract:c1", health: { current: 80, max: 80 }, position: { x: 3, y: 0, z: 13 } } as unknown as Entity;
    const terminal = { id: 6, key: "term", position: { x: 9, y: 0, z: 9 }, interactable: { kind: "terminal", dialogueId: "t" } } as unknown as Entity;
    const guard = { id: 7, key: "guard", health: { current: 50, max: 50 }, position: { x: 4, y: 0, z: 4 } } as unknown as Entity;
    const a = track([player(0, 0), hired, terminal, guard], [], contracts, { ticksPerSecond: 60, disguised: true, enforcers: new Set([7]) });
    expect(a.mapMarkers.find((m) => m.id === "c1-g0")).toEqual({ id: "c1-g0", kind: "target", x: 0, z: 16, radius: TARGET_AREA_RADIUS });
    expect(a.mapMarkers.map((m) => m.kind)).toEqual(["target", "target", "enforcer"]);
    const b = track([player(0, 0), hired, terminal, guard], [], { active: null, completed: 1 }, { ticksPerSecond: 60 });
    expect(b.mapMarkers).toEqual([]);
  });

  it("zooms out with speed and after a dash, looks ahead while moving, and keeps still on the metro", () => {
    const track = createMinimapTracker();
    const still = track([player(0, 0)], [], contracts, { ticksPerSecond: 60 });
    expect(still.mapZoom).toBe(1);
    expect(still.mapPlayer?.moving).toBeUndefined();
    let run = still;
    for (let i = 0; i < 30; i++) run = track([player(0.1, 0, true)], [], contracts, { ticksPerSecond: 60 });
    expect(run.mapZoom).toBe(MAP_ZOOM_RUN);
    expect(run.mapPlayer?.moving).toBe(true);
    let dash = run;
    for (let i = 0; i < 30; i++) dash = track([player(0.1, 0)], [], contracts, { ticksPerSecond: 60, dashing: true });
    expect(dash.mapZoom).toBe(MAP_ZOOM_DASH);
    let ride = dash;
    for (let i = 0; i < 30; i++) ride = track([player(0.5, 0)], [], contracts, { ticksPerSecond: 60, riding: true });
    expect(ride.mapZoom).toBe(1);
    expect(ride.mapPlayer?.moving).toBeUndefined();
  });
});
