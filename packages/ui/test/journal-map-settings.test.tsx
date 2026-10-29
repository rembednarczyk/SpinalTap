// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type JournalVm, type MapVm, type UiIntents, type UiState, createUiStore, patchUi } from "../src";
import { MINIMAP_RANGE, markerOffset } from "../src/hud/minimap";

/** Every intent is a spy, including ones added later. */
const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const mount = (state: Partial<UiState> = {}, touch = false) => {
  const store = createUiStore(state);
  const i = intents();
  const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
  render(<GameUi store={store} intents={i} touch={touch ? pad : undefined} />);
  return { store, i };
};

afterEach(cleanup);

const journal: JournalVm = {
  quests: [
    {
      id: "m0_first_contract",
      title: "Pierwsze zlecenie",
      kind: "main",
      status: "completed",
      steps: [
        { objective: "Znajdź fixera", done: true },
        { objective: "Wróć do Kaito po zapłatę", done: true },
      ],
    },
    {
      id: "contract-c2",
      title: "Kontrakt 2 · Kaito",
      kind: "contract",
      status: "active",
      steps: [{ objective: "Zneutralizuj gangerów Hebi (3): podwórko za myjnią", done: false }],
    },
  ],
  memories: [{ id: "combat_reflex", title: "Wspomnienie: odruch", description: "Ręce wiedzą, gdzie celować." }],
};

describe("journal", () => {
  it("toggles with J and closes the character sheet", () => {
    const { store } = mount({ screen: "playing", journal });
    expect(screen.queryByTestId("journal")).toBeNull();
    fireEvent.keyDown(window, { code: "Tab" });
    expect(screen.getByTestId("character-panel")).toBeTruthy();
    fireEvent.keyDown(window, { code: "KeyJ" });
    expect(screen.getByTestId("journal")).toBeTruthy();
    expect(screen.queryByTestId("character-panel")).toBeNull();
    fireEvent.keyDown(window, { code: "KeyJ", repeat: true });
    expect(store.getState().journalOpen).toBe(true);
    fireEvent.keyDown(window, { code: "KeyJ" });
    expect(screen.queryByTestId("journal")).toBeNull();
  });

  it("lists active jobs, finished ones with their steps, and memories", () => {
    mount({ screen: "playing", journal, journalOpen: true });
    const active = screen.getByTestId("journal-quest-contract-c2");
    expect(active.textContent).toContain("Kontrakt");
    expect(active.textContent).toContain("podwórko za myjnią");
    expect(screen.queryByTestId("journal-quest-m0_first_contract")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Ukończone/ }));
    const done = screen.getByTestId("journal-quest-m0_first_contract");
    expect(done.textContent).toContain("Wątek główny");
    expect(done.querySelectorAll(".journal__step--done")).toHaveLength(2);

    fireEvent.click(screen.getByRole("tab", { name: /Wspomnienia/ }));
    expect(screen.getByTestId("journal-memory-combat_reflex").textContent).toContain("Ręce wiedzą");
  });

  it("follows an entry on the HUD from the journal, and stops following it", () => {
    const tracked: JournalVm = {
      ...journal,
      quests: journal.quests.map((q) => (q.id === "contract-c2" ? { ...q, tracked: true, pinned: false } : q)),
    };
    const { i, store } = mount({ screen: "playing", journal: tracked, journalOpen: true });
    fireEvent.click(screen.getByTestId("journal-track-contract-c2"));
    expect(i.trackQuest).toHaveBeenCalledWith("contract-c2");
    act(() => patchUi(store, { journal: { ...tracked, quests: tracked.quests.map((q) => (q.id === "contract-c2" ? { ...q, pinned: true } : q)) } }));
    fireEvent.click(screen.getByTestId("journal-untrack-contract-c2"));
    expect(i.trackQuest).toHaveBeenLastCalledWith(null);
  });

  it("says so when a tab is empty", () => {
    mount({ screen: "playing", journalOpen: true });
    expect(screen.getByText(/Nic na teraz/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Ukończone/ }));
    expect(screen.getByText("Jeszcze nic nie skończyłaś.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Wspomnienia/ }));
    expect(screen.getByText("Pustka. Na razie.")).toBeTruthy();
  });

  it("opens from the touch top bar through the character screen", () => {
    mount({ screen: "playing" }, true);
    fireEvent.click(screen.getByRole("button", { name: "Postać" }));
    fireEvent.click(screen.getByRole("tab", { name: /Dziennik/ }));
    expect(screen.getByTestId("journal")).toBeTruthy();
  });
});

const map: MapVm = {
  bounds: { x: 0, z: 7, w: 46, d: 88 },
  blocks: [{ x: -14, z: 8, w: 14, d: 14 }],
  streets: [{ x: -7.8, z: -2, w: 1.6, d: 66 }],
};

describe("minimap", () => {
  it("stays hidden until the district and the player are known", () => {
    const { store } = mount({ screen: "playing", map });
    expect(screen.queryByTestId("minimap")).toBeNull();
    act(() => patchUi(store, { mapPlayer: { x: 0, z: 0, yaw: 0 } }));
    expect(screen.getByTestId("minimap")).toBeTruthy();
  });

  it("draws the district, the view direction and the NPC markers", () => {
    const { store } = mount({
      screen: "playing",
      map,
      mapPlayer: { x: 0, z: -28, yaw: Math.PI / 2 },
      mapMarkers: [
        { id: "fixer", kind: "fixer", x: 6.2, z: 1.5 },
        { id: "mori", kind: "ripperdoc", x: -6.2, z: 2.4 },
        { id: "courier", kind: "target", x: 1, z: -20 },
      ],
    });
    const root = screen.getByTestId("minimap");
    expect(root.querySelectorAll(".minimap__block")).toHaveLength(1);
    expect(root.querySelectorAll(".minimap__street")).toHaveLength(1);
    expect(screen.getByTestId("minimap-player").getAttribute("transform")).toBe("rotate(90.0)");
    // Kaito is ~30 m away, just past the edge; the courier is close.
    expect(screen.getByTestId("minimap-marker-fixer").classList.contains("minimap__marker--edge")).toBe(true);
    expect(screen.getByTestId("minimap-marker-target").classList.contains("minimap__marker--edge")).toBe(false);
    expect(screen.getByTestId("minimap-marker-target").getAttribute("transform")).toBe("translate(1.00 -8.00)");
    act(() => patchUi(store, { mapMarkers: [] }));
    expect(screen.queryByTestId("minimap-marker-target")).toBeNull();
  });

  it("shows stairs, lifts and ladders, and the player's height up on a level (ADR-0021)", () => {
    const levels: MapVm = {
      ...map,
      decks: [{ x: 10, z: 0, w: 20, d: 6 }],
      links: [
        { kind: "stairs", x: 2, z: 1 },
        { kind: "lift", x: 4, z: 1 },
        { kind: "ladder", x: 6, z: 1 },
      ],
    };
    const { store } = mount({ screen: "playing", map: levels, mapPlayer: { x: 0, z: 0, yaw: 0 } });
    const root = screen.getByTestId("minimap");
    expect(root.querySelectorAll(".minimap__deck")).toHaveLength(1);
    expect(screen.getByTestId("minimap-link-stairs").getAttribute("transform")).toBe("translate(2.00 -1.00)");
    expect(screen.getByTestId("minimap-link-lift")).toBeTruthy();
    expect(screen.getByTestId("minimap-link-ladder")).toBeTruthy();
    expect(screen.queryByTestId("minimap-level")).toBeNull();
    expect(root.classList.contains("minimap--upper")).toBe(false);
    act(() => patchUi(store, { mapPlayer: { x: 0, z: 0, yaw: 0, level: 10 } }));
    expect(screen.getByTestId("minimap-level").textContent).toContain("10 m");
    expect(screen.getByTestId("minimap").classList.contains("minimap--upper")).toBe(true);
  });

  it("pins far markers to the edge in their direction", () => {
    const near = markerOffset({ x: 3, z: 4 }, { x: 0, z: 0 });
    expect(near).toEqual({ x: 3, y: -4, edge: false });
    const far = markerOffset({ x: 0, z: 100 }, { x: 0, z: 0 });
    expect(far.edge).toBe(true);
    expect(far.x).toBeCloseTo(0);
    expect(far.y).toBeLessThan(0);
    expect(Math.hypot(far.x, far.y)).toBeLessThan(MINIMAP_RANGE);
  });
});

/** A piece of Lublin (ADR-0045): a street with its name, a building by it, one far away. */
const city: MapVm = {
  ...map,
  ground: [{ x: 0, z: 0, w: 400, d: 400 }],
  areas: [{ kind: "road", points: [-50, -2, 50, -2, 50, 2, -50, 2] }],
  buildings: [
    [5, 5, 15, 5, 15, 15, 5, 15],
    [300, 300, 310, 300, 310, 310, 300, 310],
  ],
  labels: [
    { kind: "street", text: "Grodzka", x: 0, z: 0, angle: 0.5 },
    { kind: "district", text: "Stare Miasto", x: 0, z: 40, angle: 0 },
  ],
  places: [{ name: "Stare Miasto", x: 0, z: 40 }],
};

describe("Lublin on the minimap and the map tab (ADR-0045)", () => {
  it("draws the surfaces, the buildings near the player and the street names", () => {
    mount({ screen: "playing", map: city, mapPlayer: { x: 0, z: 0, yaw: 0 } });
    const root = screen.getByTestId("minimap");
    expect(root.querySelectorAll(".minimap__area--road")).toHaveLength(1);
    // The far building is out of the window round the player.
    expect(root.querySelectorAll(".minimap__building")).toHaveLength(1);
    const names = [...root.querySelectorAll(".minimap__label")].map((t) => t.textContent);
    expect(names).toEqual(["Grodzka"]);
    expect(root.querySelector(".minimap__label")?.getAttribute("transform")).toBe("rotate(-28.6 0.0 0.0)");
  });

  it("M opens the map tab with the whole city, the names, the player and the credit", () => {
    const { store } = mount({ screen: "playing", map: city, mapPlayer: { x: 0, z: 0, yaw: 0 } });
    fireEvent.keyDown(window, { code: "KeyM" });
    expect(store.getState().characterTab).toBe("map");
    const tab = screen.getByTestId("city-map");
    expect(tab.querySelectorAll(".citymap__building")).toHaveLength(2);
    expect([...tab.querySelectorAll(".citymap__label")].map((t) => t.textContent)).toEqual(["Grodzka", "Stare Miasto"]);
    expect(screen.getByTestId("citymap-player")).toBeTruthy();
    expect(screen.getByTestId("map-attribution").textContent).toContain("OpenStreetMap");
    // The district button moves the view there.
    const svg = tab.querySelector("svg")!;
    const before = svg.getAttribute("viewBox");
    fireEvent.click(within(tab).getByText("Stare Miasto", { selector: "button" }));
    expect(svg.getAttribute("viewBox")).not.toBe(before);
    fireEvent.click(within(tab).getByLabelText("Oddal"));
    expect(svg.getAttribute("viewBox")).toContain("630.0");
    fireEvent.keyDown(window, { code: "KeyM" });
    expect(store.getState().characterTab).toBeNull();
  });

  it("credits the map data on the title screen, small, and in full under Autorzy", () => {
    mount({ screen: "title" });
    expect(screen.getByTestId("title-attribution").textContent).toBe("Dane mapy © OpenStreetMap contributors (ODbL) · teren: GUGiK NMT");
    fireEvent.click(screen.getByRole("button", { name: "Autorzy" }));
    const credits = screen.getByTestId("credits");
    expect(credits.textContent).toContain("Open Database License");
    expect(credits.textContent).toContain("GUGiK");
    fireEvent.click(within(credits).getByRole("button", { name: "Wróć" }));
    expect(screen.queryByTestId("credits")).toBeNull();
  });
});

describe("settings", () => {
  const openSettings = (state: Partial<UiState> = {}) => {
    const r = mount({ screen: "paused", ...state });
    fireEvent.click(screen.getByText("Ustawienia"));
    return r;
  };

  it("shows the current values and sends changes as intents", () => {
    const { i } = openSettings({ settings: { ...DEFAULT_SETTINGS, quality: "high", aimMode: "hold", mouseSensitivity: 1.5, touchSensitivity: 0.8, volume: 0.4 } });
    // General: graphics, sound, hints, touch.
    expect(screen.getByRole("radio", { name: "Wysoka" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("settings").textContent).toContain("40%");
    expect(screen.getByTestId("settings").textContent).toContain("0,8×");
    fireEvent.click(screen.getByRole("radio", { name: "Niska" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ quality: "low" });
    fireEvent.change(screen.getByLabelText(/Czułość dotyku/), { target: { value: "1.2" } });
    expect(i.changeSettings).toHaveBeenCalledWith({ touchSensitivity: 1.2 });
    fireEvent.change(screen.getByLabelText(/Głośność/), { target: { value: "0.25" } });
    expect(i.changeSettings).toHaveBeenCalledWith({ volume: 0.25 });
    // Mouse and camera.
    fireEvent.click(screen.getByRole("tab", { name: "Mysz i kamera" }));
    expect(screen.getByLabelText(/Czułość myszy/)).toHaveProperty("value", "1.5");
    fireEvent.change(screen.getByLabelText(/Czułość myszy/), { target: { value: "2" } });
    expect(i.changeSettings).toHaveBeenCalledWith({ mouseSensitivity: 2 });
    const aim = screen.getByRole("radiogroup", { name: "Celowanie (PPM)" });
    fireEvent.click(within(aim).getByRole("radio", { name: "Przełącz" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ aimMode: "toggle" });
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Kucanie" })).getByRole("radio", { name: "Przytrzymaj" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ crouchMode: "hold" });
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Odwróć oś Y" })).getByRole("radio", { name: "Tak" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ invertY: true });
    fireEvent.change(screen.getByLabelText(/Pole widzenia/), { target: { value: "70" } });
    expect(i.changeSettings).toHaveBeenCalledWith({ fov: 70 });
    expect(screen.queryByTestId("settings-reload")).toBeNull();
  });

  it("rebinds a key by pressing it, refuses menu keys and resets to defaults", () => {
    const controls = [
      { action: "jump", label: "Skok", codes: ["Space"] },
      { action: "fire", label: "Strzał / cios", codes: ["Mouse0"] },
    ];
    const { i } = openSettings({ controls });
    fireEvent.click(screen.getByRole("tab", { name: "Klawisze" }));
    expect(screen.getByTestId("key-bindings").textContent).toContain("Spacja");
    expect(screen.getByTestId("key-bindings").textContent).toContain("LPM");
    fireEvent.click(screen.getByRole("button", { name: "Zmień klawisz: Skok" }));
    expect(screen.getByTestId("key-bindings").textContent).toContain("Naciśnij klawisz");
    fireEvent.keyDown(window, { code: "KeyP" });
    expect(i.bindKey).not.toHaveBeenCalled();
    expect(screen.getByTestId("key-bindings").textContent).toContain("zajęty przez menu");
    fireEvent.keyDown(window, { code: "KeyG" });
    expect(i.bindKey).toHaveBeenCalledWith("jump", "KeyG");
    fireEvent.click(screen.getByText("Przywróć domyślne klawisze"));
    expect(i.resetControls).toHaveBeenCalled();
  });

  it("offers a reload when a change needs one, and goes back to the menu", () => {
    const { i } = openSettings({ reloadNeeded: true });
    expect(screen.getByTestId("settings-reload").textContent).toContain("po przeładowaniu");
    fireEvent.click(screen.getByText("Przeładuj teraz"));
    expect(i.reload).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Wróć"));
    expect(screen.queryByTestId("settings")).toBeNull();
  });
});
