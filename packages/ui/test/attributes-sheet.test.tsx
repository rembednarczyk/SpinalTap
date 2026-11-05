// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { START_ATTRIBUTES } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, type UiState, createUiStore } from "../src";

/** Every intent is a spy. */
const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

/** The sheet tab open on a game with `state`. */
const sheet = (state: Partial<UiState>) => {
  const store = createUiStore({ screen: "playing", ...state });
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  fireEvent.keyDown(window, { code: "Tab" });
  return { i, section: screen.getByTestId("attributes") };
};

afterEach(cleanup);

describe("attributes on the sheet (ADR-0059, stage 2)", () => {
  it("lists the five with their values and the level; no buttons without a point", () => {
    const { section } = sheet({ level: 4, attributes: { ...START_ATTRIBUTES, net: 5 } });
    expect(section.textContent).toContain("Level 4");
    expect(within(screen.getByTestId("attribute-net")).getByText("Net")).toBeTruthy();
    expect(screen.getByTestId("attribute-net").textContent).toContain("5");
    expect(screen.queryByTestId("attribute-points")).toBeNull();
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
  });

  it("with points left a button raises an attribute through the intent; none at 15", () => {
    const { i } = sheet({ level: 3, attributePoints: 2, attributes: { ...START_ATTRIBUTES, shadow: 15 } });
    expect(screen.getByTestId("attribute-points").textContent).toContain("2 points to spend");
    fireEvent.click(screen.getByRole("button", { name: "Raise Tech" }));
    expect(i.spendAttributePoint).toHaveBeenCalledWith("tech");
    expect(within(screen.getByTestId("attribute-shadow")).queryByRole("button")).toBeNull();
  });

  it("speaks Polish with the Polish setting, plural forms included", () => {
    sheet({ attributePoints: 2, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    expect(screen.getByTestId("attribute-points").textContent).toContain("2 punkty do rozdania");
    expect(screen.getByRole("button", { name: "Podnieś: Krzepa" })).toBeTruthy();
  });
});
