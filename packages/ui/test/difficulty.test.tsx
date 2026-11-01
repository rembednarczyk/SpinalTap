// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DIFFICULTY_PRESETS, type DifficultyProfile, NORMAL_DIFFICULTY } from "@seki/core";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, type UiState, createUiStore } from "../src";

/** The difficulty of ADR-0066, stage 2: the new game's setup, the pause menu's tab and the slot label. */

const intents = () => {
  const fns = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy({}, { get: (_, k) => fns.get(k) ?? fns.set(k, vi.fn()).get(k) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const mount = (state: Partial<UiState> = {}) => {
  const store = createUiStore(state);
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  return { store, i };
};

const slider = (name: string) => screen.getByRole("slider", { name }) as HTMLInputElement;
const radio = (name: string) => screen.getByRole("radio", { name });
const openSetup = () => fireEvent.click(screen.getByRole("button", { name: "New Game" }));

afterEach(cleanup);

describe("new game setup", () => {
  it("comes before the loading, on Normal, its sliders folded away", () => {
    const { i } = mount();
    openSetup();
    expect(screen.getByTestId("new-game-setup")).toBeTruthy();
    expect(i.newGame).not.toHaveBeenCalled();
    expect(radio("Normal").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("difficulty-desc").textContent).toBe("The game as it is balanced, the way it is meant to be played.");
    expect(screen.queryByTestId("difficulty-custom")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByTestId("new-game-setup")).toBeNull();
  });

  it("a preset sets the sliders and starts the game on its profile", () => {
    const { i } = mount();
    openSetup();
    fireEvent.click(radio("Hard"));
    expect(screen.getByTestId("difficulty-desc").textContent).toContain("sharper numbers");
    fireEvent.click(radio("Custom"));
    expect(slider("Damage taken").value).toBe("1.4");
    expect(slider("Sniper warning").value).toBe("0.8");
    expect(screen.getByText("1.40×")).toBeTruthy();
    fireEvent.click(radio("Story"));
    expect(screen.queryByTestId("difficulty-custom")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(i.newGame).toHaveBeenCalledWith(DIFFICULTY_PRESETS.story);
  });

  it("moving a slider switches to Custom and starts on the sliders' profile", () => {
    const { i } = mount();
    openSetup();
    fireEvent.click(radio("Hard"));
    fireEvent.click(radio("Custom"));
    fireEvent.change(slider("Enemy health"), { target: { value: "2.05" } });
    expect(radio("Custom").getAttribute("aria-checked")).toBe("true");
    expect(radio("Hard").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByTestId("difficulty-desc").textContent).toBe("Your own mix of the multipliers below.");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(i.newGame).toHaveBeenCalledWith({ ...DIFFICULTY_PRESETS.hard, npcHealth: 2.05 });
  });

  it("speaks Polish with the Polish setting, numbers with a comma", () => {
    mount({ settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    fireEvent.click(screen.getByRole("button", { name: "Nowa gra" }));
    expect(screen.getByRole("heading", { name: "Poziom trudności" })).toBeTruthy();
    expect(radio("Normalny").getAttribute("aria-checked")).toBe("true");
    for (const name of ["Opowieść", "Trudny", "Własny"]) expect(radio(name)).toBeTruthy();
    fireEvent.click(radio("Trudny"));
    expect(screen.getByTestId("difficulty-desc").textContent).toContain("ostrzejsze liczby");
    fireEvent.click(radio("Własny"));
    expect(slider("Otrzymywane obrażenia").value).toBe("1.4");
    expect(screen.getByText("1,40×")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rozpocznij" })).toBeTruthy();
  });
});

describe("pause menu difficulty", () => {
  const hard: DifficultyProfile = DIFFICULTY_PRESETS.hard;
  const openTab = (name = "Difficulty") => fireEvent.click(within(screen.getByTestId("pause-menu")).getByRole("button", { name }));

  it("shows the profile in force and asks for a preset's whole profile", () => {
    const { i } = mount({ screen: "paused", difficulty: { profile: hard, pending: null } });
    openTab();
    expect(radio("Hard").getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByTestId("difficulty-pending")).toBeNull();
    fireEvent.click(radio("Story"));
    expect(i.setDifficulty).toHaveBeenCalledWith(DIFFICULTY_PRESETS.story);
  });

  it("a slider asks for the custom profile", () => {
    const { i } = mount({ screen: "paused" });
    openTab();
    fireEvent.click(radio("Custom"));
    fireEvent.change(slider("Enemy awareness"), { target: { value: "0.5" } });
    expect(i.setDifficulty).toHaveBeenCalledWith({ ...NORMAL_DIFFICULTY, awareness: 0.5 });
  });

  it("a change asked for in a fight shows as waiting for its end, in either language", () => {
    mount({ screen: "paused", difficulty: { profile: NORMAL_DIFFICULTY, pending: hard } });
    openTab();
    expect(radio("Hard").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("difficulty-pending").textContent).toBe("Changes after the fight.");
    cleanup();
    mount({ screen: "paused", difficulty: { profile: NORMAL_DIFFICULTY, pending: hard }, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    openTab("Poziom trudności");
    expect(screen.getByTestId("difficulty-pending").textContent).toBe("Zmieni się po walce.");
  });

  it("starting over after death keeps the run's difficulty", () => {
    const { i } = mount({ screen: "dead", difficulty: { profile: NORMAL_DIFFICULTY, pending: hard } });
    fireEvent.click(screen.getByText("Start over"));
    expect(i.newGame).toHaveBeenCalledWith(hard);
  });
});

describe("save slot label", () => {
  const slots: UiState["slots"] = [
    { slot: "slot-1", savedAtLabel: "01.11, 20:00", objective: "x", difficulty: "hard" },
    { slot: "slot-2", savedAtLabel: "01.11, 21:00", objective: "y", difficulty: "custom" },
    { slot: "slot-3", savedAtLabel: "01.11, 22:00", objective: "z" },
  ];

  it("names the preset a slot was played on, small, and nothing when unknown", () => {
    mount({ screen: "paused", slots });
    fireEvent.click(within(screen.getByTestId("pause-menu")).getByRole("button", { name: "Load Game" }));
    expect(screen.getAllByTestId("slot-difficulty").map((e) => e.textContent)).toEqual(["Hard", "Custom"]);
    expect(screen.getByLabelText("Difficulty: Hard")).toBeTruthy();
  });

  it("in Polish too", () => {
    mount({ screen: "paused", slots, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    fireEvent.click(within(screen.getByTestId("pause-menu")).getByRole("button", { name: "Wczytaj" }));
    expect(screen.getAllByTestId("slot-difficulty").map((e) => e.textContent)).toEqual(["Trudny", "Własny"]);
  });
});
