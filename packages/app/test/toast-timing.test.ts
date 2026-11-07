import { createUiStore } from "@seki/ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_MS, pushToastTimed } from "../src/controllers/shared";

describe("a counted toast keeps its full time from the last push (G-286)", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("an identical toast shortly before the first runs out stays its own full time", () => {
    const ui = createUiStore();
    pushToastTimed(ui, "system", "Saved");
    vi.advanceTimersByTime(TOAST_MS - 100);
    pushToastTimed(ui, "system", "Saved");
    expect(ui.getState().toasts.map((t) => t.count ?? 1)).toEqual([2]);
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(ui.getState().toasts.map((t) => t.title)).toEqual(["Saved"]);
    vi.advanceTimersByTime(1);
    expect(ui.getState().toasts).toEqual([]);
  });
});
