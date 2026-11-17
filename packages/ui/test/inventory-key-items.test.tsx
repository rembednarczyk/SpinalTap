// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { addKeyItem, starterKit } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type UiIntents, createUiStore, patchUi } from "../src";

/** Every intent is a spy. */
const intents = (): UiIntents =>
  new Proxy({} as Record<string | symbol, ReturnType<typeof vi.fn>>, { get: (t, k) => (t[k] ??= vi.fn()) }) as unknown as UiIntents;

afterEach(cleanup);

describe("story items in the inventory (G-931)", () => {
  it("name the job's pendrive under the grid, in English and in Polish, and take no cell", () => {
    const kit = starterKit();
    const store = createUiStore({ screen: "playing", characterTab: "inventory", ...kit });
    render(<GameUi store={store} intents={intents()} />);
    // Nothing to show without one.
    expect(screen.queryByTestId("key-items")).toBeNull();
    const before = screen.getByTestId("inventory-count").textContent;
    act(() => patchUi(store, { inventory: addKeyItem(kit.inventory, "w3_virus") }));
    expect(screen.getByTestId("key-items").textContent).toBe("Key itemsGenzō's virus pendrive");
    expect(screen.getByTestId("inventory-count").textContent).toBe(before);
    act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "pl" } }));
    expect(screen.getByTestId("key-items").textContent).toBe("Przedmioty kluczowePendrive Genzō z wirusem");
  });
});
