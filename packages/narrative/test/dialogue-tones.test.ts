import { describe, expect, it } from "vitest";
import { createDomainState } from "@seki/core";
import { DEFAULT_TONE, DIALOGUE_TONES, NarrativeRuntime, STORY_SOURCE, isDialogueTone, toneOf } from "../src";

/** Every player choice in ink carries a known tone (ADR-0039), or none and reads as `optional`. */

const CHOICE_RE = /^\s*[*+]\s*(?:\{[^}]*\}\s*)*\[([^\]]*)\]/;
const TAG_RE = /#\s*([^#]*)/g;

const choices = STORY_SOURCE.split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .flatMap((l) => {
    const m = CHOICE_RE.exec(l);
    if (m?.[1] === undefined) return [];
    const tags = [...m[1].matchAll(TAG_RE)].map((t) => (t[1] ?? "").trim());
    return [{ text: m[1].replace(/#.*$/, "").trim(), tags }];
  });

describe("choice tones in the ink source", () => {
  it("are found, one tag per choice", () => {
    expect(choices.length).toBeGreaterThan(100);
    expect(choices.filter((c) => c.tags.length > 0)).toHaveLength(choices.length);
  });

  it.each(choices.map((c) => [c.text, c] as const))("%s: a known tone or the default", (_text, c) => {
    const tones = c.tags.filter((t) => t.startsWith("tone"));
    expect(tones.length).toBeLessThanOrEqual(1);
    for (const t of tones) expect(DIALOGUE_TONES).toContain(t.replace(/^tone\s*:\s*/, ""));
  });

  it("uses every tone somewhere, and leave on the goodbyes", () => {
    const used = new Set(choices.map((c) => toneOf(c.tags)));
    for (const tone of DIALOGUE_TONES) expect(used).toContain(tone);
    for (const bye of ["Nie dziś.", "Muszę iść.", "Nie teraz.", "Na razie.", "Już idę."]) {
      expect(new Set(choices.filter((c) => c.text === bye).map((c) => toneOf(c.tags)))).toEqual(new Set(["leave"]));
    }
  });
});

describe("toneOf", () => {
  it("reads the tone tag and falls back to optional", () => {
    expect(toneOf(["tone:leave"])).toBe("leave");
    expect(toneOf(["other", " tone : hack "])).toBe("hack");
    expect(toneOf(["tone:shout"])).toBe(DEFAULT_TONE);
    expect(toneOf(null)).toBe("optional");
    expect(isDialogueTone("lifepath")).toBe(true);
    expect(isDialogueTone("nope")).toBe(false);
  });

  it("reaches the view: Kaito's first meeting offers main choices, the job menu a leave", () => {
    const runtime = new NarrativeRuntime(STORY_SOURCE, () => {});
    const d = createDomainState();
    const first = runtime.start("fixer", { ...d, quests: { m0_first_contract: { status: "active", stepIndex: 0 } } });
    expect(first.choices.map((c) => c.tone)).toEqual(["main", "main"]);
    expect(first.choices[0]?.text).toBe("Kim jesteś?");
    runtime.interrupt();
    const offer = runtime.start("fixer", { ...d, character: { ...d.character, alias: "Seki" }, quests: { m0_first_contract: { status: "completed" } } });
    expect(offer.choices.map((c) => c.tone)).toEqual(["main", "optional", "leave"]);
  });

  it("an untagged choice is optional", () => {
    const runtime = new NarrativeRuntime(`${STORY_SOURCE}\n=== tone_probe ===\nHi.\n* [A #tone:persuade]\n  -> END\n* [B]\n  -> END\n`, () => {});
    expect(runtime.start("tone_probe", createDomainState()).choices).toEqual([
      { index: 0, text: "A", tone: "persuade" },
      { index: 1, text: "B", tone: "optional" },
    ]);
  });
});
