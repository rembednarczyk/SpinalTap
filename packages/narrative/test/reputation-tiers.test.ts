import { describe, expect, it } from "vitest";
import { type DomainState, createDomainState } from "@seki/core";
import { NarrativeRuntime, storySource } from "../src";

/**
 * ADR-0070: the street's regulars refuse to talk only at the hostile tier (-50 or worse). From
 * -11 to -49 (wary) they say one cold line and then talk as usual; at -10 nothing changes.
 */
const domain = (civilians: number, hour: number): DomainState => {
  const d = createDomainState();
  return {
    ...d,
    quests: { m0_first_contract: { status: "completed" } },
    character: { ...d.character, alias: "Seki Senshi" },
    clock: { seconds: hour * 3600 },
    flags: ["met_tetsu", "met_fumiko"],
    reputation: { ...d.reputation, civilians },
  };
};

/** Knot, an hour it is reachable at, the refusal and the cold line in Polish and English. */
const REGULARS: readonly (readonly [string, number, string, string, string, string])[] = [
  ["hideo", 12, "Nie mam przy sobie pieniędzy", "daj mi iść", "I don't have any money", "let me go"],
  ["tetsu", 12, "Roleta w dół", "Uśmiechać się", "Shutter's down", "I won't smile"],
  ["mei", 21, "Szukaj towarzystwa", "ręce trzymaj na widoku", "Go find company", "keep your hands where I can see them"],
  ["sachiko", 12, "dla ciebie niczego nie ma", "Żadnej dobrej", "nothing for you", "None of them good"],
  ["goro", 12, "Moknij", "Przyjaźń już nie", "Get wet", "Friendship, not so much"],
  ["kenta", 12, "Lepiej idź", "Ludzie patrzą", "Better move along", "People are watching"],
  ["fumiko", 20, "Zjesz gdzie indziej", "bez hałasu", "Eat somewhere else", "keep it quiet"],
  ["fumiko_closed", 12, "I wieczorem też nie wracaj", "tak czy inaczej", "don't come back this evening", "Closed, either way"],
  ["oyaji_closed", 23, "Dla ciebie zawsze zamknięte", "specjalnie dla ciebie", "For you, always closed", "not opening up just for you"],
  ["ume", 12, "Nie podchodź do mnie", "Nie wiem, w co wierzyć", "Don't come near me", "I don't know what to believe"],
  ["koi_regular", 21, "Odsuń się", "byle nie koło mnie", "Back off", "just not next to me"],
];

/** One runtime per language: building one is the slow part, and `start` begins each talk afresh. */
const runtimes = new Map<"pl" | "en", NarrativeRuntime>();
const runtime = (lang: "pl" | "en"): NarrativeRuntime => {
  const known = runtimes.get(lang) ?? new NarrativeRuntime(storySource(lang), () => {});
  runtimes.set(lang, known);
  return known;
};

const say = (lang: "pl" | "en", knot: string, civilians: number, hour: number) => {
  const view = runtime(lang).start(knot, domain(civilians, hour));
  return { text: view.lines.map((l) => l.text).join("\n"), lines: view.lines.length, ended: view.ended };
};

describe("refusals by tier (ADR-0070)", () => {
  for (const [knot, hour, refusePl, coldPl, refuseEn, coldEn] of REGULARS) {
    it(`${knot}: refuses at -50, is cold at -11 and -49, as usual at -10`, () => {
      for (const [lang, refuse, cold] of [
        ["pl", refusePl, coldPl],
        ["en", refuseEn, coldEn],
      ] as const) {
        const hostile = say(lang, knot, -50, hour);
        expect(hostile).toMatchObject({ lines: 1, ended: true });
        expect(hostile.text).toContain(refuse);
        for (const value of [-49, -11]) {
          const wary = say(lang, knot, value, hour);
          expect(wary.text).toContain(cold);
          expect(wary.text).not.toContain(refuse);
          expect(wary.lines).toBeGreaterThan(1);
        }
        const neutral = say(lang, knot, -10, hour);
        expect(neutral.text).not.toContain(cold);
        expect(neutral.text).not.toContain(refuse);
      }
    });
  }
});
