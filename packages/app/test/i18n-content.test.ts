import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type ContractModifier, type ContractVariation, type DomainState, type Locale, type TargetTrait, createDomainState } from "@seki/core";
import { describeVariation, variationKeys } from "@seki/narrative";
import { CONTRACT_HOOKS, METRO_STATIONS } from "@seki/sim";
import { isMessageKey, patchUi, translate } from "@seki/ui";
import { narrativeText } from "../src/content-text";
import { metroMapVm } from "../src/metro";
import { describeObjective } from "../src/objective";
import { type Ui, nearKaito, setup, steps, talkTo, teleport } from "./story-helpers";

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

describe("observation hooks", () => {
  it("name their tracker line by key, written in both languages", () => {
    for (const hook of CONTRACT_HOOKS) {
      expect(hook.text, hook.id).toBe(`hook.${hook.id.replace(/^hook_/, "")}`);
      expectWritten(hook.text);
    }
    expect(translate("pl", "hook.retrieve_1")).toBe("Po północy drugi strażnik skrytki idzie na kwadrans po ramen");
    expect(translate("en", "hook.retrieve_1")).toBe("After midnight the stash's second guard goes out for ramen for a quarter of an hour");
  });
});

describe("the scanner's names", () => {
  it("are written in both languages for each key the simulation names a thing by", () => {
    for (const key of ["camera", "vending", "speaker", "neon", "enemy", "passerBy"]) expectWritten(`scan.name.${key}`);
    expect(translate("pl", "scan.name.vending")).toBe("Automat z napojami");
  });
});

describe("the narrative's own words", () => {
  it("call a speaker who is a role by the player's language, and names as they are", () => {
    const { session, ui } = setup();
    session.newGame();
    talkTo(session, "ume");
    expect(ui.getState().dialogue?.lines.find((l) => l.speaker)?.speaker).toBe("Grandma Ume");
    session.intents.closeDialogue();
    speak(ui, "pl");
    talkTo(session, "ume");
    expect(ui.getState().dialogue?.lines.find((l) => l.speaker)?.speaker).toBe("Babcia Ume");
    session.intents.closeDialogue();
    talkTo(session, "fixer");
    expect(ui.getState().dialogue?.lines.find((l) => l.speaker && l.speaker !== "Ty")?.speaker).toBe("Kaito");
  });

  it("say a contract's variation in either language, Polish as the fixers always said it", () => {
    const v: ContractVariation = { modifiers: ["time_limit", "twin"], security: "light", trait: "armored" };
    expect(describeVariation(v, narrativeText(() => "pl"))).toBe(
      "Klient liczy czas, więc nie zwlekaj. Mówią, że jest ich dwóch i wyglądają tak samo. Ochrona jest cienka. Cel nosi pancerz, zwykłe kule się od niego odbiją.",
    );
    expect(describeVariation(v, narrativeText(() => "en"))).toBe(
      "The client is counting the hours, so don't drag your feet. They say there are two of them and they look the same. Security is thin. The target wears armour; ordinary bullets will bounce off.",
    );
    const modifiers: ContractModifier[] = ["night_only", "time_limit", "bodyguards", "ambush", "twin"];
    const traits: TargetTrait[] = ["paranoid", "drinker", "creature_of_habit", "armored"];
    for (const trait of traits) for (const security of ["light", "lockdown"] as const) for (const key of variationKeys({ modifiers, security, trait })) expectWritten(key);
  });
});

describe("the HUD's own objective", () => {
  const between = (flags: string[]): DomainState => ({ ...createDomainState(), quests: { m0_first_contract: { status: "completed" } }, flags });

  it("says who has work between jobs, in Polish word for word as before", () => {
    expect(describeObjective(between([]), "pl")).toEqual({ title: "Wolna ręka", objective: "Kaito ma kolejne kontrakty. Mori sprzedaje cyberware." });
    expect(describeObjective(between(["met_hana", "met_genzo"]), "pl").objective).toBe(
      "Kaito ma kolejne kontrakty, Hana z targu na Podzamczu i Genzō na Nabrzeżu też. Mori sprzedaje cyberware.",
    );
    expect(describeObjective(between(["met_genzo"]), "pl").objective).toBe("Kaito ma kolejne kontrakty, Genzō na Nabrzeżu też. Mori sprzedaje cyberware.");
  });

  it("and in English", () => {
    expect(describeObjective(between([]), "en")).toEqual({ title: "Free hand", objective: "Kaito has more contracts. Mori sells cyberware." });
    expect(describeObjective(between(["met_hana", "met_genzo"]), "en").objective).toBe(
      "More contracts from Kaito, and from Hana at the Podzamcze market and Genzō on the Nabrzeże too. Mori sells cyberware.",
    );
  });
});
