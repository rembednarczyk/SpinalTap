// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type JournalVm, type MapVm, type UiIntents, type UiState, createUiStore, patchUi } from "../src";
import { MINIMAP_RANGE, markerOffset } from "../src/hud/minimap";

/** Every intent is a spy, including ones added later. */
const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const mount = (state: Partial<UiState> = {}, touch = false) => {
  const store = createUiStore(state);
  const i = intents();
  const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn() };
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
      steps: [{ objective: "Zneutralizuj gangerów Hebi (3): zaułek za myjnią", done: false }],
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
    expect(active.textContent).toContain("zaułek za myjnią");
    expect(screen.queryByTestId("journal-quest-m0_first_contract")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Ukończone/ }));
    const done = screen.getByTestId("journal-quest-m0_first_contract");
    expect(done.textContent).toContain("Wątek główny");
    expect(done.querySelectorAll(".journal__step--done")).toHaveLength(2);

    fireEvent.click(screen.getByRole("tab", { name: /Wspomnienia/ }));
    expect(screen.getByTestId("journal-memory-combat_reflex").textContent).toContain("Ręce wiedzą");
  });

  it("says so when a tab is empty", () => {
    mount({ screen: "playing", journalOpen: true });
    expect(screen.getByText(/Nic na teraz/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Ukończone/ }));
    expect(screen.getByText("Jeszcze nic nie skończyłaś.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Wspomnienia/ }));
    expect(screen.getByText("Pustka. Na razie.")).toBeTruthy();
  });

  it("opens from the touch top bar", () => {
    mount({ screen: "playing" }, true);
    fireEvent.click(screen.getByRole("button", { name: "Dziennik" }));
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

describe("settings", () => {
  const openSettings = (state: Partial<UiState> = {}) => {
    const r = mount({ screen: "paused", ...state });
    fireEvent.click(screen.getByText("Ustawienia"));
    return r;
  };

  it("shows the current values and sends changes as intents", () => {
    const { i } = openSettings({ settings: { quality: "high", mouseSensitivity: 1.5, touchSensitivity: 0.8, volume: 0.4 } });
    expect(screen.getByRole("radio", { name: "Wysoka" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText(/Czułość myszy/)).toHaveProperty("value", "1.5");
    expect(screen.getByTestId("settings").textContent).toContain("40%");
    expect(screen.getByTestId("settings").textContent).toContain("0,8×");
    fireEvent.click(screen.getByRole("radio", { name: "Niska" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ quality: "low" });
    fireEvent.change(screen.getByLabelText(/Czułość myszy/), { target: { value: "2" } });
    expect(i.changeSettings).toHaveBeenCalledWith({ mouseSensitivity: 2 });
    fireEvent.change(screen.getByLabelText(/Czułość dotyku/), { target: { value: "1.2" } });
    expect(i.changeSettings).toHaveBeenCalledWith({ touchSensitivity: 1.2 });
    fireEvent.change(screen.getByLabelText(/Głośność/), { target: { value: "0.25" } });
    expect(i.changeSettings).toHaveBeenCalledWith({ volume: 0.25 });
    expect(screen.queryByTestId("settings-reload")).toBeNull();
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
