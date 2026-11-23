import { describe, expect, it } from "vitest";
import { type DomainState, type GameCommand, createDomainState } from "@seki/core";
import { type DialogueView, NarrativeRuntime, storySource } from "../src";

/*
 * Small talk with Alchemia's sellers (ADR-0101, `sellers.ink`), in both languages: every voice of
 * every scenario greets by the time of day, warmer for a regular (the flag its first talk sets),
 * offers three topics once each and a goodbye, and only the seller and Seki speak; the voices of a
 * scenario say different things; a seller the street is hostile to sends her off.
 */

/** The scenarios' knots and their voices, as the simulation counts them (`SELLER_VARIANTS`, checked against it in the app's tests). */
const SCENARIOS: Readonly<Record<string, number>> = {
  pharmacy: 4,
  tattoo: 4,
  pawn: 2,
  synth_food: 4,
  electronics: 3,
  florist: 2,
  repair: 4,
  implants: 3,
  crypto: 4,
  clothing: 4,
  vr: 3,
  arms: 3,
  coffee: 1,
  thai: 1,
  greek: 1,
  wok: 1,
};

const at = (hour: number, patch: Partial<DomainState> = {}): DomainState => ({ ...createDomainState(), clock: { seconds: hour * 3600 + 600 }, ...patch });

const voices = Object.entries(SCENARIOS).flatMap(([s, n]) => Array.from({ length: n }, (_, i) => ({ knot: `seller_${s}.v${i + 1}`, flag: `met_seller_${s}_${i + 1}` })));

/** The whole talk: every topic in the order offered, then the goodbye; what was said, line by line. */
const talk = (runtime: NarrativeRuntime, first: DialogueView): DialogueView[] => {
  const views = [first];
  let view = first;
  for (let guard = 0; guard < 6 && !view.ended; guard++) {
    const topic = view.choices.find((c) => c.tone === "optional") ?? view.choices.find((c) => c.tone === "leave")!;
    view = runtime.choose(topic.index);
    views.push(view);
  }
  return views;
};

describe("small talk with Alchemia's sellers (ADR-0101)", () => {
  for (const language of ["pl", "en"] as const) {
    it(`plays every voice through in ${language}: greeting, three topics once each, goodbye, the flag of a regular`, () => {
      for (const { knot, flag } of voices) {
        const commands: GameCommand[] = [];
        const runtime = new NarrativeRuntime(storySource(language), (c) => commands.push(c));
        const first = runtime.start(knot, at(12));
        // The greeting and the voice's own line, both the seller's.
        expect(first.lines.map((l) => l.speaker), knot).toEqual(["speaker.lada", "speaker.lada"]);
        expect(first.choices.map((c) => c.tone), knot).toEqual(["optional", "optional", "optional", "leave"]);
        const views = talk(runtime, first);
        expect(views.at(-1)?.ended, knot).toBe(true);
        // Three topics and the goodbye: Seki asks, the seller answers.
        expect(views.slice(1).map((v) => v.lines.map((l) => l.speaker)), knot).toEqual(Array.from({ length: 4 }, () => ["speaker.you", "speaker.lada"]));
        // Each topic once: the menu shrinks by one after each.
        expect(views.slice(0, 4).map((v) => v.choices.length), knot).toEqual([4, 3, 2, 1]);
        for (const v of views) for (const l of v.lines) expect(l.text.length, knot).toBeGreaterThan(5);
        expect(commands, knot).toEqual([{ type: "set-flag", flag }]);
      }
    });

    it(`greets by the hour and greets a regular otherwise (${language})`, () => {
      const runtime = new NarrativeRuntime(storySource(language), () => {});
      const greeting = (knot: string, d: DomainState): string => {
        const text = runtime.start(knot, d).lines[0]!.text;
        runtime.interrupt();
        return text;
      };
      for (const { knot, flag } of voices) {
        const hours = [1, 6, 12, 19].map((h) => greeting(knot, at(h)));
        expect(new Set(hours).size, knot).toBe(4);
        const regular = [1, 6, 12, 19].map((h) => greeting(knot, at(h, { flags: [flag] })));
        expect(new Set(regular).size, knot).toBe(4);
        for (let i = 0; i < 4; i++) expect(regular[i], knot).not.toBe(hours[i]);
      }
    });
  }

  it("gives the voices of a scenario lines of their own", () => {
    for (const [scenario, n] of Object.entries(SCENARIOS)) {
      if (n < 2) continue;
      const said = Array.from({ length: n }, (_, i) => {
        const runtime = new NarrativeRuntime(storySource("pl"), () => {});
        return talk(runtime, runtime.start(`seller_${scenario}.v${i + 1}`, at(12))).flatMap((v) => v.lines.filter((l) => l.speaker === "speaker.lada").map((l) => l.text)).slice(1);
      });
      const all = said.flat();
      expect(new Set(all).size, scenario).toBe(all.length);
    }
  });

  it("sends her off when the street is hostile to her", () => {
    const d = at(12);
    const commands: GameCommand[] = [];
    const view = new NarrativeRuntime(storySource("pl"), (c) => commands.push(c)).start("seller_crypto.v2", { ...d, reputation: { ...d.reputation, civilians: -60 } });
    expect(view.lines).toHaveLength(1);
    expect(view.ended).toBe(true);
    expect(commands).toEqual([]);
  });
});
