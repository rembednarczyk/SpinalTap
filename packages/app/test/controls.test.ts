import { describe, expect, it } from "vitest";
import { DEFAULT_KEYMAP } from "@seki/engine";
import { CONTROL_LABELS, bindKey, controlsVm, keymapFor } from "../src/controls";

describe("key bindings", () => {
  it("lists every remappable control with its default keys", () => {
    const rows = controlsVm({});
    expect(rows.map((r) => r.action)).toEqual(CONTROL_LABELS.map(([a]) => a));
    expect(rows.find((r) => r.action === "jump")?.codes).toEqual(["Space"]);
    expect(keymapFor({})).toEqual(DEFAULT_KEYMAP);
  });

  it("binds a key to one control only and keeps just the changes", () => {
    const b = bindKey({}, "jump", "KeyF");
    // F leaves interact (E stays), jump is F alone.
    expect(b).toEqual({ jump: ["KeyF"], interact: ["KeyE"] });
    expect(keymapFor(b).jump).toEqual(["KeyF"]);
    // Binding a default back drops the override.
    expect(bindKey(b, "jump", "Space")).toEqual({ interact: ["KeyE"] });
    expect(bindKey({}, "notAnAction", "KeyZ")).toEqual({});
  });
});
