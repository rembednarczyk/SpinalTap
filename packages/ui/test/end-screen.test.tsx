// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type EndScreenVm, GameUi, type UiIntents, type UiState, createUiStore } from "../src";

/** The end screen after the main thread's epilogue (ADR-0095 stage 2): endings, choices, numbers and the way back. */

const intents = () => {
  const fns = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy({}, { get: (_, k) => fns.get(k) ?? fns.set(k, vi.fn()).get(k) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const VM: EndScreenVm = {
  acts: [
    { act: "endScreen.act1", ending: "ending.aya.title" },
    { act: "endScreen.act2", ending: "ending.hebi.title" },
    { act: "endScreen.act3", ending: "ending.release.title" },
  ],
  choices: ["story.choice.case.opened", "story.choice.archive.hebi", "story.choice.core.release"],
  level: 12,
  contracts: 1,
  memories: 7,
};

const mount = (state: Partial<UiState> = {}) => {
  const store = createUiStore({ screen: "playing", ...state });
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  return { store, i };
};

afterEach(cleanup);

describe("the end screen", () => {
  it("is not there until the app shows it", () => {
    mount();
    expect(screen.queryByTestId("end-screen")).toBeNull();
  });

  it("names each act's ending, the choices and the run's numbers", () => {
    mount({ endScreen: VM });
    const end = screen.getByRole("dialog", { name: "The end of the main thread" });
    expect(within(end).getByText("Act II: Lustro")).toBeTruthy();
    expect(within(end).getByText("Partners")).toBeTruthy();
    expect(within(end).getByText("The city's echo")).toBeTruthy();
    const choices = within(screen.getByTestId("end-choices")).getAllByRole("listitem").map((li) => li.textContent);
    expect(choices).toEqual(["You opened the Kagami case.", "You gave the archive to Ren and Hebi.", "You let the archive out on the city's net."]);
    expect(end.textContent).toContain("Level 12 · 1 contract done · 7 memories recovered");
  });

  it("speaks Polish with the Polish setting", () => {
    mount({ endScreen: VM, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    const end = screen.getByRole("dialog", { name: "Koniec wątku głównego" });
    expect(within(end).getByText("Echo miasta")).toBeTruthy();
    expect(end.textContent).toContain("Oddałaś archiwum Renowi i Hebi.");
    expect(end.textContent).toContain("Poziom 12 · 1 wykonane zlecenie · 7 odzyskanych wspomnień");
    expect(within(end).getByRole("button", { name: "Wróć do miasta" })).toBeTruthy();
  });

  it("goes back to the city by its button, Esc or Enter", () => {
    const { i } = mount({ endScreen: VM });
    fireEvent.click(screen.getByRole("button", { name: "Back to the city" }));
    fireEvent.keyDown(window, { code: "Escape" });
    fireEvent.keyDown(window, { code: "Enter" });
    expect(i.closeEndScreen).toHaveBeenCalledTimes(3);
  });

  it("hides the touch controls while it is up", () => {
    const pad = { press: vi.fn(), release: vi.fn(), move: vi.fn(), look: vi.fn() };
    const store = createUiStore({ screen: "playing", endScreen: VM });
    render(<GameUi store={store} intents={intents()} touch={pad as never} />);
    expect(screen.queryByTestId("touch-stick")).toBeNull();
  });
});
