// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import { BrowserInput } from "../src/input/browser-input";

const key = (type: "keydown" | "keyup", code: string, repeat = false) =>
  window.dispatchEvent(new KeyboardEvent(type, { code, repeat }));

let input: BrowserInput | null = null;
afterEach(() => input?.dispose());

const make = () => {
  input = new BrowserInput(document.createElement("canvas"));
  input.enabled = true;
  return input;
};

describe("BrowserInput (InputPort contract)", () => {
  it("returns an empty frame while disabled", () => {
    const i = make();
    i.enabled = false;
    key("keydown", "KeyW");
    expect(i.poll()).toEqual(EMPTY_INPUT);
  });

  it("maps held keys and reports interact only on the first poll after the press", () => {
    const i = make();
    key("keydown", "KeyW");
    key("keydown", "KeyE");
    expect(i.poll()).toMatchObject({ moveZ: 1, interact: true });
    expect(i.poll()).toMatchObject({ moveZ: 1, interact: false });
    key("keyup", "KeyW");
    expect(i.poll().moveZ).toBe(0);
  });

  it("ignores key auto-repeat for edges", () => {
    const i = make();
    key("keydown", "KeyV");
    i.poll();
    key("keydown", "KeyV", true);
    expect(i.poll().toggleCamera).toBe(false);
  });

  it("drops a buffered press when re-enabled, so closing a dialogue with E does not reopen it", () => {
    const i = make();
    i.enabled = false;
    key("keydown", "KeyE");
    i.enabled = true;
    expect(i.poll().interact).toBe(false);
  });

  it("ignores mouse buttons and movement without pointer lock", () => {
    const i = make();
    window.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    expect(i.poll().fire).toBe(false);
  });

  it("releases held keys when the window loses focus", () => {
    const i = make();
    key("keydown", "KeyD");
    window.dispatchEvent(new Event("blur"));
    expect(i.poll().moveX).toBe(0);
  });
});
