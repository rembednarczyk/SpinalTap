import type { Screen } from "@seki/ui";
import { describe, expect, it } from "vitest";
import { pointerFocus } from "../src/pointer-focus";

/** The pointer lock round the loading screen (ADR-0057), without a browser. */

const setup = (touch = false) => {
  const log = { screen: "title" as Screen, gesture: false as boolean | undefined, locks: 0, releases: 0, enabled: false };
  const focus = pointerFocus({
    screen: () => log.screen,
    setEnabled: (on) => (log.enabled = on),
    lock: () => log.locks++,
    release: () => log.releases++,
    touch,
    gesture: () => log.gesture,
  });
  return { log, focus };
};

describe("pointer focus", () => {
  it("leaving the loading screen without a gesture waits for the next click", () => {
    const { log, focus } = setup();
    log.screen = "loading";
    focus(false);
    log.screen = "playing";
    focus(true);
    expect(log.enabled).toBe(true);
    expect(log.locks).toBe(0);
  });

  it("leaving the loading screen on a gesture locks at once", () => {
    const { log, focus } = setup();
    log.screen = "loading";
    focus(false);
    log.screen = "playing";
    log.gesture = true;
    focus(true);
    expect(log.locks).toBe(1);
  });

  it("a panel closed with Esc locks again at once, gesture or not", () => {
    const { log, focus } = setup();
    log.screen = "playing";
    focus(true);
    focus(false);
    // Esc closes the panel: the key is no user activation for the lock check.
    log.gesture = false;
    focus(true);
    expect(log.releases).toBe(1);
    expect(log.locks).toBe(2);
    // The pause menu closed with Esc too.
    log.screen = "paused";
    focus(false);
    log.screen = "playing";
    focus(true);
    expect(log.locks).toBe(3);
  });

  it("never locks on a touch device", () => {
    const { log, focus } = setup(true);
    log.screen = "playing";
    focus(true);
    expect(log.enabled).toBe(true);
    expect(log.locks).toBe(0);
  });
});
