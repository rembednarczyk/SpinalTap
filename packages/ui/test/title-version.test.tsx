// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type UiIntents, createUiStore } from "../src";

/** The build on the title screen (gap audit: no visible version), for bug reports. */

const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

afterEach(cleanup);

describe("title screen version", () => {
  it("shows the build the app passes in", () => {
    render(<GameUi store={createUiStore({ screen: "title" })} intents={intents()} version="v0.1.0 · 1a2b3c4" />);
    expect(screen.getByTestId("title-version").textContent).toBe("v0.1.0 · 1a2b3c4");
  });

  it("shows nothing when the app gives no version", () => {
    render(<GameUi store={createUiStore({ screen: "title" })} intents={intents()} />);
    expect(screen.queryByTestId("title-version")).toBeNull();
  });
});
