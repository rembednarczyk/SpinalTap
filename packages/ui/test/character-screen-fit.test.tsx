// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { AMMO_CATALOG, type AmmoId, starterKit } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type UiIntents, createUiStore, patchUi } from "../src";
import { MIN_FIT_SCALE, fitScale } from "../src/menus/use-fit-scale";

/** Every intent is a spy. */
const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

/**
 * jsdom lays nothing out, so the widths come from here: the frame is `room` px wide, and the top
 * bar needs 400 px for the tabs, wallet and close button plus 90 px per ammo kind shown.
 */
const layout = (room: number) => {
  const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("cscreen__frame") ? room : 0;
  });
  const scroll = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("cscreen__bar") ? 400 + 90 * this.querySelectorAll(".cscreen__round").length : 0;
  });
  return () => {
    width.mockRestore();
    scroll.mockRestore();
  };
};

const ALL_AMMO = Object.fromEntries((Object.keys(AMMO_CATALOG) as AmmoId[]).map((id) => [id, 5]));

const mount = (ammo: Readonly<Record<string, number>>) => {
  const { inventory, equipment } = starterKit();
  const store = createUiStore({ screen: "playing", inventory, equipment, ammo, characterTab: "inventory" });
  render(<GameUi store={store} intents={intents()} />);
  return { store, frame: () => screen.getByTestId("character-screen").querySelector<HTMLElement>(".cscreen__frame")! };
};

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
  cleanup();
});

describe("fitScale", () => {
  it("keeps 1 while the bar fits and shrinks to the room when it does not", () => {
    expect(fitScale(1280, 900)).toBe(1);
    expect(fitScale(800, 1000)).toBe(0.8);
    expect(fitScale(300, 1000)).toBe(MIN_FIT_SCALE);
    expect(fitScale(0, 1000)).toBe(1);
  });
});

describe("the character screen fits its top bar (long ammo rows)", () => {
  it("is not scaled when the bar fits", () => {
    restore = layout(1280);
    const { frame } = mount({ "9mm": 72 });
    expect(frame().style.getPropertyValue("zoom")).toBe("");
    expect(frame().dataset.scale).toBe("1");
  });

  it("scales the whole window down so the close button stays on the screen with every ammo kind", () => {
    restore = layout(844);
    const { frame } = mount(ALL_AMMO);
    const kinds = Object.keys(AMMO_CATALOG).length;
    const scale = Number(frame().style.getPropertyValue("zoom"));
    expect(scale).toBeLessThan(1);
    expect((400 + 90 * kinds) * scale).toBeLessThanOrEqual(844);
    expect(frame().hasAttribute("data-squeezed")).toBe(false);
    expect(frame().querySelector(".cscreen__bar .cscreen__close")).not.toBeNull();
  });

  it("grows back once the extra ammo kinds are gone", () => {
    restore = layout(844);
    const { store, frame } = mount(ALL_AMMO);
    expect(Number(frame().style.getPropertyValue("zoom"))).toBeLessThan(1);
    act(() => patchUi(store, { ammo: { "9mm": 72 } }));
    expect(frame().style.getPropertyValue("zoom")).toBe("");
  });

  it("clips the ammo row, not the close button, when even the smallest scale is too wide", () => {
    restore = layout(300);
    const { frame } = mount(ALL_AMMO);
    expect(Number(frame().style.getPropertyValue("zoom"))).toBe(MIN_FIT_SCALE);
    expect(frame().hasAttribute("data-squeezed")).toBe(true);
  });
});
