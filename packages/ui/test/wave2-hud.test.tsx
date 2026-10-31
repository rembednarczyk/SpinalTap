// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type MapVm, type UiIntents, type UiState, capacityCost, capacityFit, createUiStore, patchUi } from "../src";
import { RESERVED_KEYS } from "../src/menus/key-label";
import { mapView, markerOffset } from "../src/hud/minimap";
import { nextWeaponKey } from "../src/touch/action-arc";
import { itemActions } from "../src/inventory/actions";
import { EMPTY_EQUIPMENT, EMPTY_INVENTORY } from "@seki/core";

const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const mount = (state: Partial<UiState> = {}, touch = false) => {
  const store = createUiStore({ screen: "playing", ...state });
  const i = intents();
  const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
  render(<GameUi store={store} intents={i} touch={touch ? pad : undefined} />);
  return { store, i, pad };
};

afterEach(() => cleanup());

const metroMap: UiState["metroMap"] = {
  line: "Linia Kanjō",
  from: "kanal",
  refusal: null,
  stops: [
    { id: "shinsekai", name: "Plac Litewski", fare: 25, here: false },
    { id: "kanal", name: "Brama Krakowska", fare: 0, here: true },
    { id: "targ", name: "Plac Zamkowy", fare: 25, here: false },
    { id: "doki", name: "Nabrzeże Bystrzycy", fare: 35, here: false },
  ],
};

describe("metro", () => {
  it("lists the stops with fares and buys a ticket", () => {
    const { i } = mount({ metroMap, eddies: 30 });
    expect(screen.getByTestId("metro-stop-kanal").textContent).toContain("You are here");
    fireEvent.click(screen.getByRole("button", { name: /Ticket to: Plac Zamkowy/ }));
    expect(i.travelMetro).toHaveBeenCalledWith("targ");
    // 35 €$ is more than the wallet.
    expect((screen.getByRole("button", { name: /Ticket to: Nabrzeże/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(window, { code: "Escape" });
    expect(i.closeMetro).toHaveBeenCalled();
  });

  it("shows the refusal and blocks tickets on a watched platform", () => {
    mount({ metroMap: { ...metroMap, refusal: "Ochrona pilnuje peronu." }, eddies: 500 });
    expect(screen.getByTestId("metro-refusal").textContent).toContain("Ochrona");
    expect((screen.getByRole("button", { name: /Ticket to: Plac Zamkowy/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the ride with progress and the subtitle, and hides the touch pad", () => {
    mount({ metroRide: { line: "Linia Kanjō", fromName: "Brama Krakowska", toName: "Nabrzeże Bystrzycy", progress: 0.4, caption: { speaker: "Staruszka", text: "Następna stacja, doki." } } }, true);
    expect(screen.getByTestId("metro-ride-to").textContent).toBe("Nabrzeże Bystrzycy");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByTestId("metro-caption").textContent).toBe("Staruszka: Następna stacja, doki.");
    expect(screen.queryByTestId("touch-controls")).toBeNull();
  });
});

describe("radio", () => {
  it("switches stations with B and in the phone", () => {
    const { i } = mount({ phoneOpen: true, settings: { ...DEFAULT_SETTINGS, radioStation: "yoru" } });
    expect(screen.getByTestId("radio-yoru").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByTestId("radio-off"));
    expect(i.setRadioStation).toHaveBeenCalledWith(null);
    cleanup();
    const free = mount();
    fireEvent.keyDown(window, { code: "KeyB" });
    expect(free.i.nextRadioStation).toHaveBeenCalledTimes(1);
    expect(RESERVED_KEYS.has("KeyB")).toBe(true);
  });

  it("does not react to B under a panel", () => {
    const { i } = mount({ shopOpen: true });
    fireEvent.keyDown(window, { code: "KeyB" });
    expect(i.nextRadioStation).not.toHaveBeenCalled();
  });
});

describe("body HUD", () => {
  it("shows buffs, the dash cooldown and the disguise by the health bar", () => {
    const { store } = mount({
      buffs: [{ id: "regen", name: "Regeneracja", left: 12, total: 30 }],
      dash: { cooldown: 0.6, total: 1.2 },
      disguise: { role: "hebi", label: "Przebranie: Hebi", blown: false },
    });
    expect(screen.getByTestId("buff-regen").textContent).toContain("12 s");
    expect(screen.getByTestId("dash").getAttribute("aria-label")).toBe("Zryw za 0.6 s");
    // A disguise keeps the identity block on screen.
    expect(screen.getByTestId("identity").classList.contains("hud__identity--calm")).toBe(false);
    act(() => patchUi(store, { disguise: { role: "hebi", label: "Przebranie: Hebi", blown: true }, dash: { cooldown: 0, total: 1.2 } }));
    expect(screen.getByTestId("disguise").textContent).toContain("Cover blown");
    expect(screen.getByTestId("dash").getAttribute("aria-label")).toBe("Zryw gotowy");
  });

  it("lists hooks under the objective and the variation on the debrief", () => {
    mount({
      objective: "Wyeliminuj cel",
      questTitle: "Zlecenie",
      contractHooks: [{ id: "h1", text: "Strażnik pali o 23:00 za magazynem." }],
      debrief: { contractId: "c1", title: "Eliminacja", fixer: "Kaito", badges: [], rank: "B", reward: 100, bonus: 0, styleBonus: 0, seconds: 30, variation: { labels: ["tylko nocą", "blokada"], twist: "wystawka" } },
    });
    expect(screen.getByTestId("contract-hooks").textContent).toContain("Strażnik pali");
    expect(screen.getByTestId("debrief-variation").textContent).toBe("tylko nocą · blokada · wystawka");
  });
});

describe("ripperdoc capacity", () => {
  it("costs each implant 2 to 8 and blocks one over the limit", () => {
    expect(capacityCost("subdermal_weave")).toBeGreaterThanOrEqual(2);
    expect(capacityCost("subdermal_weave")).toBeLessThanOrEqual(8);
    expect(capacityFit("subdermal_weave", {}, null).over).toBe(false);
    expect(capacityFit("subdermal_weave", {}, { used: 0, max: 1 }).over).toBe(true);
    mount({ shopOpen: true, shopId: "clinic", eddies: 9999, capacity: { used: 0, max: 1 } });
    expect(screen.getByTestId("capacity-value").textContent).toBe("0 / 1");
    const offer = screen.getByTestId("implant-subdermal_weave");
    expect(offer.textContent).toContain("Capacity 4");
    expect(offer.textContent).toContain("Not enough capacity: 4 / 1");
    expect((offer.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("minimap of wave 2", () => {
  const map: MapVm = { bounds: { x: 0, z: 0, w: 100, d: 100 }, blocks: [], streets: [] };

  it("looks ahead while moving, so the arrow sits in the lower third", () => {
    const view = mapView({ x: 0, z: 0, yaw: 0, moving: true });
    const me = markerOffset({ x: 0, z: 0 }, view);
    expect(me.y).toBeCloseTo(32 / 3);
    expect(mapView({ x: 0, z: 0, yaw: 0 }).z).toBe(0);
    // Zoomed out, the world shrinks and markers keep their size.
    expect(markerOffset({ x: 10, z: 0 }, mapView({ x: 0, z: 0, yaw: 0 }, 2)).x).toBeCloseTo(5);
  });

  it("draws a target as an area, enforcers, and nothing in the no-markers mode", () => {
    const { store } = mount({
      map,
      mapPlayer: { x: 0, z: 0, yaw: 0 },
      mapMarkers: [
        { id: "t", kind: "target", x: 8, z: 8, radius: 10 },
        { id: "g", kind: "enforcer", x: -4, z: 2 },
      ],
    });
    expect(screen.getByTestId("minimap-area").getAttribute("r")).toBe("10");
    expect(screen.getByTestId("minimap-marker-enforcer")).toBeTruthy();
    act(() => patchUi(store, { settings: { ...DEFAULT_SETTINGS, mapMarkers: false } }));
    expect(screen.queryByTestId("minimap-marker-target")).toBeNull();
    expect(screen.queryByTestId("minimap-marker-enforcer")).toBeNull();
  });

  it("rings the quest step's target, round a fixer's dot, on the edge when far, and hides it in the no-markers mode", () => {
    const { store } = mount({
      map,
      mapPlayer: { x: 0, z: 0, yaw: 0 },
      mapMarkers: [
        { id: "fixer", kind: "fixer", x: 4, z: 4 },
        { id: "quest:fixer", kind: "quest", x: 4, z: 4 },
      ],
    });
    const ring = screen.getByTestId("minimap-marker-quest");
    expect(ring.getAttribute("class")).toContain("minimap__marker--quest");
    expect(ring.querySelector("title")?.textContent).toBe("Quest target");
    expect(ring.querySelector("circle")?.getAttribute("r")).toBe("3.4");
    expect(screen.getByTestId("minimap-marker-fixer")).toBeTruthy();
    act(() => patchUi(store, { mapMarkers: [{ id: "quest:ume", kind: "quest", x: 900, z: 0 }] }));
    expect(screen.getByTestId("minimap-marker-quest").getAttribute("class")).toContain("minimap__marker--edge");
    act(() => patchUi(store, { settings: { ...DEFAULT_SETTINGS, mapMarkers: false } }));
    expect(screen.queryByTestId("minimap-marker-quest")).toBeNull();
  });
});

describe("touch of wave 2", () => {
  it("has the action arc around fire and a Use button that names the prompt", () => {
    const { pad, store } = mount({ prompt: "Kup bilet" }, true);
    const use = screen.getByTestId("touch-use");
    expect(use.textContent).toBe("UseKup bilet");
    expect(use.getAttribute("aria-label")).toBe("Interact: Kup bilet");
    // The pad in Polish, word for word as before (ADR-0056).
    act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "pl" } }));
    expect(screen.getByTestId("touch-use").textContent).toBe("UżyjKup bilet");
    expect(screen.getByTestId("touch-use").getAttribute("aria-label")).toBe("Interakcja: Kup bilet");
    expect(screen.getByRole("button", { name: "Postać" })).toBeTruthy();
    act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "en" } }));
    expect(use.classList.contains("touch__btn--hot")).toBe(true);
    fireEvent.pointerDown(use);
    expect(pad.press).toHaveBeenCalledWith("interact");
    fireEvent.pointerDown(screen.getByTestId("touch-dash"));
    expect(pad.press).toHaveBeenCalledWith("dash");
    fireEvent.pointerDown(screen.getByTestId("touch-reload"));
    expect(pad.press).toHaveBeenCalledWith("reload");
    act(() =>
      patchUi(store, {
        weapons: {
          slots: [
            { slot: "primary", key: 1, name: "Pistolet", rarity: "common" },
            { slot: "secondary", key: 2, name: null, rarity: null },
            { slot: "melee", key: 3, name: "Pałka", rarity: "common" },
          ],
          active: "primary",
          loaded: 8,
          magazine: 12,
          reserve: 20,
          ammoName: "9 mm",
          reloading: false,
          holstered: false,
        },
      }),
    );
    fireEvent.pointerDown(screen.getByTestId("touch-more"));
    fireEvent.pointerDown(screen.getByTestId("touch-weapon"));
    expect(pad.selectWeaponSlot).toHaveBeenCalledWith(3);
  });

  it("picks the next slot that holds a weapon", () => {
    expect(nextWeaponKey(null)).toBeNull();
  });
});

describe("settings of wave 2", () => {
  it("has the no-markers mode and the highlights switch", () => {
    const { i } = mount({ screen: "paused" });
    fireEvent.click(screen.getByText("Settings"));
    const markers = screen.getByRole("radiogroup", { name: "Minimap markers" });
    fireEvent.click(markers.querySelector('[aria-checked="false"]')!);
    expect(i.changeSettings).toHaveBeenCalledWith({ mapMarkers: false });
    const highlights = screen.getByRole("radiogroup", { name: "Object highlights" });
    fireEvent.click(highlights.querySelector('[aria-checked="false"]')!);
    expect(i.changeSettings).toHaveBeenCalledWith({ highlights: false });
  });
});

describe("wave 2 consumables", () => {
  it("lets coffee and a capacity shard be used at full health, a medkit not", () => {
    const ctx = { inventory: EMPTY_INVENTORY, equipment: EMPTY_EQUIPMENT, hp: 100, maxHp: 100 };
    const use = (stack: string) => itemActions({ stack } as never, ctx).find((a) => a.id === "use")?.blocked;
    expect(use("medkit")).toBe("inventory.blocked.fullHealth");
    expect(use("synth_coffee")).toBeNull();
    expect(use("capacity_shard")).toBeNull();
  });
});
