// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type MapFloorVm, type MapVm, type UiIntents, type UiState, type UiStore, createUiStore, patchUi } from "../src";

/** ADR-0100 on the minimap and the map tab: the storey indoors (its rooms, name and level, the street dimmed), the venues, the traders. */

const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

const mount = (state: Partial<UiState> = {}) => {
  const store = createUiStore(state);
  render(<GameUi store={store} intents={intents()} />);
  return store;
};

const polish = (store: UiStore) => act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "pl" } }));

afterEach(cleanup);

const map: MapVm = {
  bounds: { x: 0, z: 0, w: 60, d: 60 },
  blocks: [{ x: -14, z: 8, w: 14, d: 14 }],
  streets: [{ x: -7.8, z: -2, w: 1.6, d: 66 }],
};

const p2: MapFloorVm = {
  name: "interior.alchemia-p2",
  level: -2,
  rooms: [
    { x: 0, z: 0, w: 20, d: 24 },
    { x: 12, z: 4, w: 2, d: 9 },
  ],
};

describe("the minimap indoors (ADR-0100)", () => {
  it("draws the storey's rooms and names the interior and its level instead of the height", () => {
    const store = mount({ screen: "playing", map, mapPlayer: { x: 0, z: 0, yaw: 0 } });
    const root = screen.getByTestId("minimap");
    expect(root.classList.contains("minimap--indoor")).toBe(false);
    expect(screen.queryByTestId("minimap-floor")).toBeNull();
    act(() => patchUi(store, { mapPlayer: { x: 0, z: 0, yaw: 0, floor: p2 } }));
    expect(screen.getByTestId("minimap").classList.contains("minimap--indoor")).toBe(true);
    expect(screen.getByTestId("minimap").querySelectorAll(".minimap__room")).toHaveLength(2);
    expect(screen.getByTestId("minimap-floor").textContent).toBe("Alchemia car park, level -2Level -2");
    expect(screen.queryByTestId("minimap-level")).toBeNull();
    polish(store);
    expect(screen.getByTestId("minimap-floor").textContent).toContain("Poziom -2");
  });

  it("gives a floor without a number its depth under the street, and nothing more on a numberless one above it", () => {
    const store = mount({ screen: "playing", map, mapPlayer: { x: 0, z: 0, yaw: 0, floor: { name: "interior.metro-kanal", depth: 8, rooms: [{ x: 0, z: 0, w: 26, d: 5 }] } } });
    expect(screen.getByTestId("minimap-floor").textContent).toBe("Brama Krakowska metro platform▼ 8 m");
    act(() => patchUi(store, { mapPlayer: { x: 0, z: 0, yaw: 0, floor: { name: "interior.clinic", rooms: [{ x: 0, z: 0, w: 6, d: 10 }] } } }));
    expect(screen.getByTestId("minimap-floor").textContent).toBe("Doctor Mori's clinic");
  });

  it("leaves the street as it was outdoors and on a deck", () => {
    mount({ screen: "playing", map, mapPlayer: { x: 0, z: 0, yaw: 0, level: 6 }, settings: DEFAULT_SETTINGS });
    expect(screen.getByTestId("minimap").classList.contains("minimap--indoor")).toBe(false);
    expect(screen.getByTestId("minimap").querySelectorAll(".minimap__room")).toHaveLength(0);
    expect(screen.getByTestId("minimap-level").textContent).toContain("6 m");
  });
});

describe("the venues on the map (ADR-0100)", () => {
  const venues: MapVm = {
    ...map,
    labels: [
      { kind: "street", text: "Grodzka", x: 0, z: 0, angle: 0 },
      { kind: "venue", text: "APTEKA GEMMA", x: 6, z: 4, angle: 0, venue: "pharmacy", color: "#ff2e88" },
      { kind: "venue", text: "interior.clinic", key: true, x: -8, z: 2, angle: 0, venue: "interior" },
      { kind: "venue", text: "LODOWY SALONIK", x: 400, z: 0, angle: 0, venue: "ice-cream", color: "#ff2e88" },
    ],
  };

  it("draws the venues near the player on the minimap, an icon in its neon and the name, an interior's name translated", () => {
    const store = mount({ screen: "playing", map: venues, mapPlayer: { x: 0, z: 0, yaw: 0 } });
    const shown = screen.getAllByTestId("minimap-venue");
    expect(shown.map((v) => v.querySelector("text")?.textContent)).toEqual(["APTEKA GEMMA", "Doctor Mori's clinic"]);
    expect(shown[0]!.querySelector("circle")?.getAttribute("fill")).toBe("#ff2e88");
    expect(shown[0]!.querySelector("title")?.textContent).toBe("Pharmacy");
    polish(store);
    expect(screen.getAllByTestId("minimap-venue")[1]!.textContent).toBe("Klinika doktora Mori");
  });

  it("shows them on the map tab only one step in from the default view", () => {
    const store = mount({ screen: "playing", map: venues, mapPlayer: { x: 0, z: 0, yaw: 0 } });
    act(() => patchUi(store, { characterTab: "map" }));
    const tab = screen.getByTestId("city-map");
    expect(tab.querySelectorAll("[data-testid=citymap-venue]")).toHaveLength(0);
    fireEvent.click(within(tab).getByLabelText("Zoom in"));
    expect(tab.querySelectorAll("[data-testid=citymap-venue]")).toHaveLength(3);
  });
});

describe("the traders on the map (ADR-0100)", () => {
  const traders = [
    { id: "mori", kind: "ripperdoc" as const, x: 4, z: 3 },
    { id: "oyaji", kind: "vendor" as const, x: -5, z: 2 },
  ];

  it("shows Mori's clinic and an open stall on the minimap and the map tab, and hides them with the markers", () => {
    const store = mount({ screen: "playing", map, mapPlayer: { x: 0, z: 0, yaw: 0 }, mapMarkers: traders });
    expect(screen.getByTestId("minimap-marker-ripperdoc").textContent).toBe("Mori's clinic");
    expect(screen.getByTestId("minimap-marker-vendor").textContent).toBe("Shop");
    act(() => patchUi(store, { characterTab: "map" }));
    expect(screen.getByTestId("citymap-marker-vendor")).toBeTruthy();
    act(() => patchUi(store, { settings: { ...store.getState().settings, mapMarkers: false } }));
    expect(screen.queryByTestId("minimap-marker-vendor")).toBeNull();
    expect(screen.queryByTestId("citymap-marker-vendor")).toBeNull();
    expect(screen.queryByTestId("minimap-marker-ripperdoc")).toBeNull();
  });
});
