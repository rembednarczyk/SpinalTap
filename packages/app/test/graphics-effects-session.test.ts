import { describe, expect, it } from "vitest";
import type { AudioPort } from "@seki/core";
import type { GraphicsEffects } from "@seki/engine";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { DEFAULT_SETTINGS, type SettingsVm, createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { SETTINGS_KEY, loadSettings, saveSettings } from "../src/settings";
import { FakeRender } from "./story-helpers";

/** The fake renderer with the engine's graphics switches: it records what reaches it. */
class SwitchingRender extends FakeRender {
  readonly graphics: GraphicsEffects[] = [];
  setGraphicsEffects(effects: GraphicsEffects) {
    this.graphics.push(effects);
  }
}

const audio: AudioPort = { play() {}, stopAll() {} };

/** A session whose settings live in a fake storage, as in the browser. */
const start = (saved: Partial<SettingsVm> | null = null) => {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  if (saved) saveSettings(storage, { ...DEFAULT_SETTINGS, ...saved });
  const applied = loadSettings(storage);
  const render = new SwitchingRender();
  const ui = createUiStore();
  const session = new GameSession({
    render,
    audio,
    persistence: new SavePersistence(new MemorySaveStore()),
    ui,
    story: STORY_SOURCE,
    seed: () => 77,
    now: () => new Date(2026, 10, 14),
    settings: { applied, save: (next) => saveSettings(storage, next), reload: () => {} },
  });
  const stored = () => JSON.parse(data.get(SETTINGS_KEY) ?? "{}") as Partial<SettingsVm>;
  return { session, ui, render, stored };
};

describe("graphics switches in the session (graphics toggles 14.11)", () => {
  it("hands both High effects to the renderer at the start, on by default", () => {
    const { ui, render } = start();
    expect(render.graphics).toEqual([{ contactShade: true, bloom: true }]);
    expect(ui.getState().graphicsEffects).toEqual({ contactShade: { available: true, on: true }, bloom: { available: true, on: true } });
  });

  it("switches each effect at once, without a reload, and saves the choice", () => {
    const { session, ui, render, stored } = start();
    session.intents.setGraphicsEffect("bloom", false);
    expect(render.graphics.at(-1)).toEqual({ contactShade: true, bloom: false });
    expect(ui.getState().graphicsEffects.bloom).toEqual({ available: true, on: false });
    expect(ui.getState().reloadNeeded).toBe(false);
    expect(stored().bloom).toBe(false);
    session.intents.setGraphicsEffect("contactShade", false);
    expect(render.graphics.at(-1)).toEqual({ contactShade: false, bloom: false });
    expect(stored().contactShade).toBe(false);
    session.intents.setGraphicsEffect("bloom", true);
    expect(render.graphics.at(-1)).toEqual({ contactShade: false, bloom: true });
    expect(render.graphics).toHaveLength(4);
  });

  it("keeps a saved off from the first frame", () => {
    const { ui, render } = start({ contactShade: false });
    expect(render.graphics).toEqual([{ contactShade: false, bloom: true }]);
    expect(ui.getState().graphicsEffects.contactShade).toEqual({ available: true, on: false });
  });

  it("shows both switches off and inactive on a quality without the effects", () => {
    const { session, ui, render } = start();
    session.intents.changeSettings({ quality: "medium" });
    expect(ui.getState().graphicsEffects).toEqual({ contactShade: { available: false, on: false }, bloom: { available: false, on: false } });
    // The choice itself stays, for when High comes back; the renderer heard nothing new.
    expect(ui.getState().settings.bloom).toBe(true);
    expect(render.graphics).toHaveLength(1);
    session.intents.changeSettings({ quality: "high" });
    expect(ui.getState().graphicsEffects.bloom).toEqual({ available: true, on: true });
  });

  it("resends nothing when another setting changes", () => {
    const { session, render } = start();
    session.intents.changeSettings({ volume: 0.3, mouseSensitivity: 1.4 });
    expect(render.graphics).toHaveLength(1);
  });

  it("leaves a renderer without the switches alone", () => {
    const ui = createUiStore();
    const session = new GameSession({ render: new FakeRender(), audio, persistence: new SavePersistence(new MemorySaveStore()), ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 10, 14) });
    expect(() => session.intents.setGraphicsEffect("bloom", false)).not.toThrow();
    expect(ui.getState().graphicsEffects.bloom.on).toBe(false);
  });

  it("gives entries saved before the switches both effects on", () => {
    const data = new Map([[SETTINGS_KEY, JSON.stringify({ quality: "high", volume: 0.4, rev: 2 })]]);
    const s = loadSettings({ getItem: (k) => data.get(k) ?? null, setItem: () => {} });
    expect(s.contactShade).toBe(true);
    expect(s.bloom).toBe(true);
    expect(loadSettings({ getItem: () => JSON.stringify({ bloom: "nope", contactShade: false }), setItem: () => {} })).toMatchObject({ bloom: true, contactShade: false });
  });
});
