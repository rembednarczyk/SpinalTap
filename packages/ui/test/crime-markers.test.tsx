// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CrimeMarkerVm, DEFAULT_SETTINGS, type MapVm, type UiIntents, type UiState, createUiStore, patchUi } from "../src";
import { CityMapPanel } from "../src/citymap/city-map-panel";
import { Minimap } from "../src/hud/minimap";
import { UiContext } from "../src/use-ui";

/*
 * The street's crimes on the maps (ADR-0091 stage 6): on the city map everywhere, a tap opens a card
 * with the kind and Tessen's pay only within 300 m, and following it; on the minimap only near or
 * followed; the no-markers setting hides them like the other markers.
 */

const MAP: MapVm = { bounds: { x: 0, z: 0, w: 2000, d: 2000 }, blocks: [], streets: [] };

const NEAR: CrimeMarkerVm = { id: "crime:3:krakowskie:0", x: 40, z: 60, kind: "mugging", near: true, reward: 180, tracked: false };
const FAR: CrimeMarkerVm = { id: "crime:3:podzamcze:0", x: 700, z: 400, kind: "kidnap", near: false, reward: null, tracked: false };

const mount = (node: ReactElement, state: Partial<UiState>) => {
  const store = createUiStore({ screen: "playing", map: MAP, mapPlayer: { x: 0, z: 0, yaw: 0 }, ...state });
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  const intents = new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as unknown as UiIntents & { trackCrime: ReturnType<typeof vi.fn> };
  render(<UiContext.Provider value={{ store, intents }}>{node}</UiContext.Provider>);
  return { store, intents };
};

afterEach(cleanup);

describe("street crimes on the city map (ADR-0091 stage 6)", () => {
  it("marks every crime of the board, near or far", () => {
    mount(<CityMapPanel />, { crimeMarkers: [NEAR, FAR] });
    expect(screen.getAllByTestId("citymap-crime")).toHaveLength(2);
  });

  it("shows the kind and Tessen's pay near, a hint to come closer far", () => {
    mount(<CityMapPanel />, { crimeMarkers: [NEAR, FAR] });
    const [near, far] = screen.getAllByTestId("citymap-crime");
    fireEvent.click(near!);
    expect(screen.getByTestId("crime-card").textContent).toContain("Mugging");
    expect(screen.getByTestId("crime-card").textContent).toContain("180");
    fireEvent.click(far!);
    const card = screen.getByTestId("crime-card").textContent ?? "";
    expect(card).toContain("Crime in progress");
    expect(card).toContain("300 m");
    expect(card).not.toContain("Kidnapping");
  });

  it("follows the picked crime, and stops following it", () => {
    const { store, intents } = mount(<CityMapPanel />, { crimeMarkers: [NEAR] });
    fireEvent.click(screen.getByTestId("citymap-crime"));
    fireEvent.click(screen.getByTestId("crime-track"));
    expect(intents.trackCrime).toHaveBeenLastCalledWith(NEAR.id);
    act(() => patchUi(store, { crimeMarkers: [{ ...NEAR, tracked: true }] }));
    expect(screen.getByTestId("crime-track").textContent).toBe("Stop tracking");
    fireEvent.click(screen.getByTestId("crime-track"));
    expect(intents.trackCrime).toHaveBeenLastCalledWith(null);
  });

  it("closes the card once its crime is off the board", () => {
    const { store } = mount(<CityMapPanel />, { crimeMarkers: [NEAR] });
    fireEvent.click(screen.getByTestId("citymap-crime"));
    act(() => patchUi(store, { crimeMarkers: [] }));
    expect(screen.queryByTestId("crime-card")).toBeNull();
  });

  it("hides them with the other markers", () => {
    mount(<CityMapPanel />, { crimeMarkers: [NEAR], settings: { ...DEFAULT_SETTINGS, mapMarkers: false } });
    expect(screen.queryByTestId("citymap-crime")).toBeNull();
  });
});

describe("street crimes on the minimap (ADR-0091 stage 6)", () => {
  it("shows only the near ones and the followed one, not the whole board", () => {
    const { store } = mount(<Minimap />, { crimeMarkers: [NEAR, FAR] });
    expect(screen.getAllByTestId("minimap-crime")).toHaveLength(1);
    act(() => patchUi(store, { crimeMarkers: [NEAR, { ...FAR, tracked: true }] }));
    const both = screen.getAllByTestId("minimap-crime");
    expect(both).toHaveLength(2);
    // The followed one far away sticks to the edge.
    expect(both[1]!.classList.contains("minimap__marker--edge")).toBe(true);
  });
});
