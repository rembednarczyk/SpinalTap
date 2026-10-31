import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Locale } from "@seki/core";
import { METRO_STATIONS } from "@seki/sim";
import { isMessageKey, patchUi, translate } from "@seki/ui";
import { metroMapVm } from "../src/metro";
import { type Ui, nearKaito, setup, steps, teleport } from "./story-helpers";

/**
 * Game content in both languages (ADR-0056, stage 4): the simulation and the narrative hold keys,
 * the session writes them in the player's language. English by default; Polish word for word
 * what the game said before.
 */

const speak = (ui: Ui, locale: Locale) => patchUi(ui, { settings: { ...ui.getState().settings, locale } });

const SIM_SRC = join(__dirname, "..", "..", "sim", "src");
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.ts$/.test(name) && !name.endsWith(".generated.ts") ? [readFileSync(path, "utf8")] : [];
  });

/** Both languages have the key, with a text of their own (not the key itself). */
const expectWritten = (key: string) => {
  expect(isMessageKey(key), key).toBe(true);
  if (!isMessageKey(key)) return;
  for (const locale of ["en", "pl"] as const) expect(translate(locale, key), `${locale} ${key}`).not.toBe(key);
};

describe("interaction prompts", () => {
  it("are catalog keys in the simulation's sources, every one written in both languages", () => {
    const src = sources(SIM_SRC).join("\n");
    // A prompt given as a literal is a key; a ternary's both sides are keys too.
    expect(src.match(/prompt: "(?!prompt\.)[^"]*"/g) ?? []).toEqual([]);
    const keys = new Set(src.match(/"prompt\.[\w.]+"/g)?.map((k) => k.slice(1, -1)));
    expect(keys.size).toBeGreaterThan(25);
    for (const key of keys) expectWritten(key);
  });

  it("show in the player's language and change with it at once, while the prompt is up", () => {
    const { session, ui } = setup();
    session.newGame();
    teleport(session, ...nearKaito(session));
    steps(session, 1);
    expect(ui.getState().prompt).toBe("Talk to Kaito");
    speak(ui, "pl");
    expect(ui.getState().prompt).toBe("Rozmawiaj z Kaito");
    steps(session, 2);
    expect(ui.getState().prompt).toBe("Rozmawiaj z Kaito");
    speak(ui, "en");
    expect(ui.getState().prompt).toBe("Talk to Kaito");
  });

  it("a prompt a panel hid stays hidden through a language change", () => {
    const { session, ui } = setup();
    session.newGame();
    teleport(session, ...nearKaito(session));
    steps(session, 1);
    patchUi(ui, { prompt: null });
    speak(ui, "pl");
    expect(ui.getState().prompt).toBeNull();
  });

  it("the metro kiosk offers a ticket in both languages; the station names stay Lublin's", () => {
    const { session, ui } = setup();
    session.newGame();
    speak(ui, "pl");
    const kiosk = METRO_STATIONS.find((s) => s.id === "targ")!;
    teleport(session, kiosk.kiosk.x + Math.sin(kiosk.yaw), kiosk.kiosk.z + Math.cos(kiosk.yaw), kiosk.yaw + Math.PI);
    steps(session, 1);
    expect(ui.getState().prompt).toBe("Bilet");
    speak(ui, "en");
    expect(ui.getState().prompt).toBe("Ticket");
    const names = ["Plac Litewski", "Brama Krakowska", "Plac Zamkowy", "Nabrzeże Bystrzycy"];
    expect(metroMapVm("targ", false, "en").stops.map((s) => s.name)).toEqual(names);
    expect(metroMapVm("targ", false, "pl").stops.map((s) => s.name)).toEqual(names);
  });
});
