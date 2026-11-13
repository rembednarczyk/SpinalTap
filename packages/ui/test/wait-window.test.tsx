// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, type UiState, createUiStore } from "../src";
import { clampWaitHours, waitEnd } from "../src/wait/wait-end";

/** Waiting: the window's slider, the time it ends (past midnight), its keys, and the pause menu's entry. */

const intents = () => {
  const fns = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy({}, { get: (_, k) => fns.get(k) ?? fns.set(k, vi.fn()).get(k) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const H = 3600;
/** 22:30 of day 2. */
const LATE = 86_400 + 22 * H + 30 * 60;
const CONTROLS = [{ action: "wait", label: "Wait", codes: ["KeyL"] }];

const mount = (state: Partial<UiState> = {}) => {
  const store = createUiStore({ screen: "playing", controls: CONTROLS, ...state });
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  return { store, i };
};

const slider = () => screen.getByRole("slider", { name: "Hours to wait" }) as HTMLInputElement;
const until = () => screen.getByTestId("wait-until").textContent;
const key = (code: string) => fireEvent.keyDown(window, { code });

afterEach(cleanup);

describe("the end of the wait", () => {
  it("adds whole hours, past midnight onto the next day", () => {
    expect(waitEnd(LATE, 1)).toEqual({ time: "23:30", day: 2 });
    expect(waitEnd(LATE, 2)).toEqual({ time: "00:30", day: 3 });
    expect(waitEnd(LATE, 24)).toEqual({ time: "22:30", day: 3 });
    expect(waitEnd(0, 5)).toEqual({ time: "05:00", day: 1 });
  });

  it("keeps the hours whole and within 1 to 24", () => {
    expect([0, 1, 2.6, 24, 99, -3, Number.NaN].map(clampWaitHours)).toEqual([1, 1, 3, 24, 24, 1, 1]);
  });
});

describe("the wait window", () => {
  it("opens on one hour and shows the end as the slider moves", () => {
    mount({ wait: { clockSeconds: LATE } });
    expect(screen.getByTestId("wait-window")).toBeTruthy();
    expect(screen.getByText("Now 22:30, day 2")).toBeTruthy();
    expect(slider().value).toBe("1");
    expect(slider().min).toBe("1");
    expect(slider().max).toBe("24");
    expect(until()).toBe("You will be done at 23:30, day 2");
    fireEvent.change(slider(), { target: { value: "3" } });
    expect(screen.getByTestId("wait-hours").textContent).toBe("3 hours");
    expect(until()).toBe("You will be done at 01:30, day 3");
  });

  it("the touch buttons step an hour and stop at the ends", () => {
    mount({ wait: { clockSeconds: LATE } });
    const less = screen.getByRole("button", { name: "One hour less" }) as HTMLButtonElement;
    const more = screen.getByRole("button", { name: "One hour more" }) as HTMLButtonElement;
    expect(less.disabled).toBe(true);
    fireEvent.click(more);
    expect(slider().value).toBe("2");
    fireEvent.change(slider(), { target: { value: "24" } });
    expect(more.disabled).toBe(true);
    fireEvent.click(less);
    expect(slider().value).toBe("23");
  });

  it("Wait asks for the chosen hours, Cancel closes", () => {
    const { i } = mount({ wait: { clockSeconds: LATE } });
    fireEvent.change(slider(), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Wait" }));
    expect(i.waitHours).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(i.closeWait).toHaveBeenCalledTimes(1);
  });

  it("arrows change the hours, Enter waits once, Esc closes", () => {
    const { i } = mount({ wait: { clockSeconds: LATE } });
    key("ArrowRight");
    key("ArrowUp");
    key("ArrowRight");
    key("ArrowLeft");
    expect(slider().value).toBe("3");
    key("ArrowDown");
    key("ArrowDown");
    key("ArrowDown");
    expect(slider().value).toBe("1");
    key("ArrowRight");
    key("Enter");
    expect(i.waitHours).toHaveBeenCalledTimes(1);
    expect(i.waitHours).toHaveBeenCalledWith(2);
    key("Escape");
    expect(i.closeWait).toHaveBeenCalledTimes(1);
  });

  it("starts from one hour again at every opening", () => {
    const { store } = mount({ wait: { clockSeconds: LATE } });
    key("ArrowRight");
    expect(slider().value).toBe("2");
    act(() => store.setState({ wait: null }));
    expect(screen.queryByTestId("wait-window")).toBeNull();
    act(() => store.setState({ wait: { clockSeconds: 0 } }));
    expect(slider().value).toBe("1");
    expect(until()).toBe("You will be done at 01:00, day 1");
  });

  it("the bound key opens it and closes it; a rebound key moves with the binding", () => {
    const { i, store } = mount();
    key("KeyL");
    expect(i.openWait).toHaveBeenCalledTimes(1);
    act(() => store.setState({ wait: { clockSeconds: LATE } }));
    key("KeyL");
    expect(i.closeWait).toHaveBeenCalledTimes(1);
    act(() => store.setState({ wait: null, controls: [{ action: "wait", label: "Wait", codes: ["KeyU"] }] }));
    key("KeyL");
    expect(i.openWait).toHaveBeenCalledTimes(1);
    key("KeyU");
    expect(i.openWait).toHaveBeenCalledTimes(2);
  });

  it("in Polish: the hours' plural and the end", () => {
    mount({ wait: { clockSeconds: LATE }, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    fireEvent.change(sliderPl(), { target: { value: "5" } });
    expect(screen.getByTestId("wait-hours").textContent).toBe("5 godzin");
    expect(until()).toBe("Skończysz o 03:30, dzień 3");
    fireEvent.change(sliderPl(), { target: { value: "2" } });
    expect(screen.getByTestId("wait-hours").textContent).toBe("2 godziny");
    expect(screen.getByRole("button", { name: "Czekaj" })).toBeTruthy();
  });
});

const sliderPl = () => screen.getByRole("slider", { name: "Ile godzin czekać" }) as HTMLInputElement;

describe("the pause menu's Wait", () => {
  it("opens the window when waiting is allowed", () => {
    const { i } = mount({ screen: "paused" });
    const wait = screen.getByRole("button", { name: "Wait" }) as HTMLButtonElement;
    expect(wait.disabled).toBe(false);
    expect(screen.queryByTestId("wait-reason")).toBeNull();
    fireEvent.click(wait);
    expect(i.openWait).toHaveBeenCalledTimes(1);
  });

  it("is off with a short reason in a fight, an alarm or a pursuit", () => {
    const { i, store } = mount({ screen: "paused", waitBlocked: "combat" });
    const wait = screen.getByRole("button", { name: "Wait" }) as HTMLButtonElement;
    expect(wait.disabled).toBe(true);
    expect(screen.getByTestId("wait-reason").textContent).toBe("Not in a fight.");
    expect(wait.getAttribute("aria-describedby")).toBe("pause-wait-reason");
    fireEvent.click(wait);
    expect(i.openWait).not.toHaveBeenCalled();
    act(() => store.setState({ waitBlocked: "wanted" }));
    expect(screen.getByTestId("wait-reason").textContent).toBe("Not while you are hunted.");
    act(() => store.setState({ waitBlocked: "alarm" }));
    expect(screen.getByTestId("wait-reason").textContent).toBe("Not with the alarm raised.");
  });

  it("the window's key does nothing in the pause menu", () => {
    const { i } = mount({ screen: "paused" });
    key("KeyL");
    expect(i.openWait).not.toHaveBeenCalled();
  });
});
