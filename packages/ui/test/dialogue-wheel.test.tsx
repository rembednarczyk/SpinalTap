// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type DialogueVm, GameUi, type UiIntents, createUiStore, patchUi } from "../src";
import { arcLayout, slotAtAngle, stepSlot, wheelSlots } from "../src/dialogue/wheel-layout";
import { swallowNextClick } from "../src/touch/ghost-click";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const dialogue: DialogueVm = {
  lines: [{ speaker: "Kaito", text: "Robota czeka." }],
  history: [{ speaker: "Kaito", text: "No proszę." }],
  choices: [
    { index: 0, text: "Biorę robotę.", tone: "main" },
    { index: 1, text: "Nie dziś.", tone: "leave" },
    { index: 2, text: "Gdzie tu się można podrasować?", tone: "optional" },
    { index: 3, text: "Co wiesz o Kagami Biotech?", tone: "lifepath" },
  ],
  ended: false,
};

const mount = (d: DialogueVm | null = dialogue) => {
  const store = createUiStore({ screen: "playing", dialogue: d });
  const choose = vi.fn();
  const closeDialogue = vi.fn();
  const intents = new Proxy({} as UiIntents, { get: (_t, k) => (k === "choose" ? choose : k === "closeDialogue" ? closeDialogue : vi.fn()) });
  render(<GameUi store={store} intents={intents} />);
  const options = () => within(screen.getByRole("group", { name: "Reply" })).getAllByRole("button");
  const hot = () => options().findIndex((b) => b.getAttribute("aria-current") === "true");
  return { store, choose, closeDialogue, options, hot };
};

describe("wheel layout", () => {
  it("puts the way out at the bottom and numbers the slots top to bottom", () => {
    const slots = wheelSlots(dialogue, "End conversation");
    expect(slots.map((s) => s.text)).toEqual(["Biorę robotę.", "Gdzie tu się można podrasować?", "Co wiesz o Kagami Biotech?", "Nie dziś."]);
    expect(slots.map((s) => s.hint)).toEqual(["1", "2", "3", "4"]);
    expect(slots.at(-1)?.action).toEqual({ kind: "choose", index: 1 });
    expect(wheelSlots({ lines: [], choices: [{ index: 0, text: "A" }], ended: false }, "x")[0]?.tone).toBe("optional");
    expect(wheelSlots({ lines: [], choices: [], ended: true }, "Zakończ rozmowę")).toEqual([{ key: "end", text: "Zakończ rozmowę", tone: "leave", hint: "E", action: { kind: "close" } }]);
  });

  it("lays out an arc without empty slots: one slot level with the hub, symmetric, curving back at the ends", () => {
    expect(arcLayout(1)).toEqual([{ x: 2.6, y: 0, angle: 0 }]);
    const two = arcLayout(2);
    expect(two).toHaveLength(2);
    expect(two[0]?.y).toBe(-0.5);
    expect(two[1]?.y).toBe(0.5);
    const six = arcLayout(6);
    expect(six.map((p) => p.y)).toEqual([-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]);
    expect(six[0]?.x).toBeCloseTo(six[5]?.x ?? 0);
    expect(six[0]?.x ?? 0).toBeLessThan(six[2]?.x ?? 0);
    expect(six[0]?.angle).toBeCloseTo(-(six[5]?.angle ?? 0));
  });

  it("points a stick direction at the nearest slot and steps round the ends", () => {
    const six = arcLayout(6);
    expect(slotAtAngle(six, -90)).toBe(0);
    expect(slotAtAngle(six, 5)).toBe(3);
    expect(slotAtAngle(six, 90)).toBe(5);
    expect(slotAtAngle(six, 180)).toBeNull();
    expect(slotAtAngle([], 0)).toBeNull();
    expect(stepSlot(0, -1, 4)).toBe(3);
    expect(stepSlot(3, 1, 4)).toBe(0);
    expect(stepSlot(0, 1, 0)).toBe(0);
  });
});

describe("dialogue wheel", () => {
  it("shows every option as a button with its tone, icon and colour class; history and lines below", () => {
    const { options } = mount();
    const buttons = options();
    expect(buttons.map((b) => b.dataset.tone)).toEqual(["main", "optional", "lifepath", "leave"]);
    expect(buttons[0]?.className).toContain("wheel__opt--main");
    expect(buttons[0]?.textContent).toContain("◆");
    expect(buttons[3]?.className).toContain("wheel__opt--leave");
    expect(screen.getByRole("button", { name: /Co wiesz o Kagami Biotech\?.*from the past/ })).toBeTruthy();
    const log = screen.getByRole("log", { name: "Conversation" });
    expect(within(log).getByText("No proszę.").className).toContain("subs__line--past");
    expect(within(log).getByText("Robota czeka.").className).not.toContain("subs__line--past");
  });

  it("keyboard: arrows move the highlight round the arc, Enter, Space and E pick it, digits pick at once", () => {
    const { choose, hot } = mount();
    expect(hot()).toBe(0);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(hot()).toBe(2);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(choose).toHaveBeenLastCalledWith(3);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: " " });
    expect(choose).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(hot()).toBe(3);
    fireEvent.keyDown(window, { key: "e" });
    expect(choose).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(window, { key: "e", repeat: true });
    expect(choose).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(window, { key: "4" });
    expect(choose).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(window, { key: "9" });
    expect(choose).toHaveBeenCalledTimes(4);
  });

  it("mouse: hovering highlights, a click picks, the wheel scrolls the highlight but not over the log", () => {
    const { choose, options, hot } = mount();
    fireEvent.pointerEnter(options()[2] as HTMLElement);
    expect(hot()).toBe(2);
    fireEvent.click(options()[3] as HTMLElement);
    expect(choose).toHaveBeenCalledWith(1);
    fireEvent.wheel(window, { deltaY: 100 });
    expect(hot()).toBe(3);
    fireEvent.wheel(window, { deltaY: 20 });
    fireEvent.wheel(window, { deltaY: 20 });
    expect(hot()).toBe(0);
    fireEvent.wheel(window, { deltaY: -3, deltaMode: 1 });
    expect(hot()).toBe(3);
    fireEvent.wheel(screen.getByRole("log"), { deltaY: 200 });
    expect(hot()).toBe(3);
  });

  it("starts each step of the talk on the top slot; an ended talk offers only the way out", () => {
    const { store, hot, options, closeDialogue } = mount();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    act(() => patchUi(store, { dialogue: { ...dialogue, choices: [{ index: 0, text: "Dalej", tone: "main" }] } }));
    expect(hot()).toBe(0);
    act(() => patchUi(store, { dialogue: { lines: [], choices: [], ended: true } }));
    expect(options().map((b) => b.dataset.tone)).toEqual(["leave"]);
    fireEvent.keyDown(window, { key: "E" });
    fireEvent.click(screen.getByRole("button", { name: /End conversation/ }));
    expect(closeDialogue).toHaveBeenCalledTimes(2);
  });

  it("touch: a tap picks, and the ghost click of the tap that opened the talk is eaten", () => {
    vi.useFakeTimers();
    const { choose } = mount();
    swallowNextClick(window);
    const option = screen.getByRole("button", { name: /Gdzie tu się można podrasować/ });
    fireEvent.pointerEnter(option, { pointerType: "touch" });
    fireEvent.click(option);
    expect(choose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(800));
    fireEvent.click(option);
    expect(choose).toHaveBeenCalledWith(2);
  });

  it("leaves the screen with the talk", () => {
    const { store } = mount();
    act(() => patchUi(store, { dialogue: null }));
    expect(screen.queryByTestId("dialogue")).toBeNull();
  });
});
