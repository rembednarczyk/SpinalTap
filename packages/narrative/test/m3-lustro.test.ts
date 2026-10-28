import { describe, expect, it } from "vitest";
import { type ActTwoEndingId, type DomainState, type EndingId, type GameCommand, KAGAMI_CLEANER_KEYS, createDomainState } from "@seki/core";
import { type DialogueView, NarrativeRuntime, STORY_SOURCE } from "../src";

/** Act II, "Lustro" (ADR-0023): what each conversation says and which commands it sends. */

const setup = () => {
  const commands: GameCommand[] = [];
  const runtime = new NarrativeRuntime(STORY_SOURCE, (c) => commands.push(c));
  return { runtime, commands };
};

type Choices = DomainState["story"]["choices"];
const ACT_ONE: Readonly<Record<EndingId, Choices>> = {
  aya: { case: "opened", name: "spoken", crash: "wheel" },
  seki: { case: "sealed", name: "silent", crash: "ren" },
};

const lustro = (stepIndex: number, ending: EndingId, choices: Choices = {}, flags: string[] = []): DomainState => {
  const d = createDomainState();
  return {
    ...d,
    character: { ...d.character, alias: ending === "aya" ? "Aya" : "Seki Senshi" },
    quests: { m0_first_contract: { status: "completed" }, m3_echo: { status: "completed" }, m3_lustro: { status: "active", stepIndex } },
    story: { choices: { ...ACT_ONE[ending], ...choices }, ending, act2Ending: null },
    flags: [`ending:${ending}`, ...flags],
  };
};

const after = (act2Ending: ActTwoEndingId): DomainState => {
  const d = lustro(0, "aya", { archive: act2Ending });
  return { ...d, quests: { ...d.quests, m3_lustro: { status: "completed" } }, story: { ...d.story, act2Ending } };
};

const text = (v: DialogueView) => v.lines.map((l) => l.text).join("\n");
const flagsSet = (commands: readonly GameCommand[]) => commands.flatMap((c) => (c.type === "set-flag" ? [c.flag] : []));
const CLEANERS_DEAD = KAGAMI_CLEANER_KEYS.map((k) => `dead:${k}`);

describe("act II opening", () => {
  it("after aya, Ren speaks through the module and sends her to Ume", () => {
    const { runtime, commands } = setup();
    const view = runtime.start("act2_opening", lustro(0, "aya", { crash: "ren" }));
    expect(view.ended).toBe(true);
    expect(view.lines.filter((l) => l.speaker === "Ren").length).toBeGreaterThan(0);
    expect(text(view)).toContain("Babcia Ume wie");
    expect(text(view)).toContain("Ten sam głos co w słuchawce");
    expect(commands).toEqual([{ type: "set-flag", flag: "seen:act2_opening" }]);
  });

  it("after seki, Kaito tells her who bought the module", () => {
    const { runtime } = setup();
    const view = runtime.start("act2_opening", lustro(0, "seki", { crash: "wheel" }));
    expect(view.lines.some((l) => l.speaker === "Kaito")).toBe(true);
    expect(text(view)).toContain("Mori sprzedał fiolkę");
    expect(text(view)).not.toContain("Ren, którego głos");
  });
});

describe("the trail to Ren", () => {
  it("Ume tells where he sleeps, after either ending", () => {
    for (const ending of ["aya", "seki"] as const) {
      const { runtime, commands } = setup();
      const view = runtime.start("ume", lustro(0, ending, {}, ["ume_memory"]));
      expect(view.choices.map((c) => c.text)).toEqual(["Gdzie znajdę Rena Odagiri?", "Nieważne."]);
      expect(text(runtime.choose(0))).toContain("Śpi na dachu nad targiem");
      expect(flagsSet(commands)).toEqual(["ren_trail"]);
    }
  });

  it("Mori names the buyer after seki, and only sends her to Ume after aya", () => {
    const seki = setup();
    seki.runtime.start("mori", lustro(0, "seki"));
    expect(text(seki.runtime.choose(0))).toContain("Ren Odagiri");
    expect(flagsSet(seki.commands)).toEqual(["ren_trail"]);

    const aya = setup();
    expect(text(aya.runtime.start("mori", lustro(0, "aya")))).toContain("Aya. Jak głowa?");
    expect(text(aya.runtime.choose(0))).toContain("babcia Ume");
    expect(aya.commands).toEqual([]);
  });
});

describe("Ren on the roof", () => {
  it("answers what she remembers of act I, then hands over the chip", () => {
    const { runtime, commands } = setup();
    let view = runtime.start("ren_odagiri", lustro(1, "aya", { case: "opened", crash: "ren" }));
    expect(text(view)).toContain("Aya. Jednak przyszłaś.");
    expect(view.choices.map((c) => c.text)).toEqual([
      "Tamtej nocy słyszałam w słuchawce twój głos.",
      "Widziałam chip ze swoim imieniem.",
      "Czego ode mnie chcesz?",
    ]);
    view = runtime.choose(0);
    expect(text(view)).toContain("furgonetce Kagami");
    view = runtime.choose(view.choices.findIndex((c) => c.text === "Czego ode mnie chcesz?"));
    expect(text(view)).toContain("Zapis zero");
    expect(text(view)).toContain("Moduł za twoim uchem");
    runtime.choose(0);
    expect(flagsSet(commands)).toEqual(["met_ren"]);
  });

  it("after seki he holds the module in a vial and reads the chip through it", () => {
    const { runtime } = setup();
    const view = runtime.start("ren_odagiri", lustro(1, "seki", { case: "sealed", crash: "wheel" }));
    expect(text(view)).toContain("szklaną fiolkę");
    expect(view.choices.map((c) => c.text)).toEqual(["Pamiętam wypadek. Sama skręciłam.", "Nigdy nie zajrzałam do tej walizki.", "Czego ode mnie chcesz?"]);
    expect(text(runtime.choose(2))).toContain("Podepnę cię kablem");
  });

  it("waits during the fight and closes the act only once every cleaner is down", () => {
    const fight = setup();
    expect(text(fight.runtime.start("ren_odagiri", lustro(3, "aya", { archive: "street" }, ["kagami_ambush", CLEANERS_DEAD[0]!])))).toContain("Słyszę strzały");
    expect(fight.commands).toEqual([]);

    const won = setup();
    const view = won.runtime.start("ren_odagiri", lustro(3, "aya", { archive: "street", voice: "listened" }, ["kagami_ambush", ...CLEANERS_DEAD]));
    expect(text(view)).toContain("Sprzedałeś im swój głos");
    expect(text(view)).toContain("walizką pełną cudzych żyć");
    expect(won.commands).toEqual([{ type: "resolve-ending", act: 2 }]);

    const hebi = setup();
    const v2 = hebi.runtime.start("ren_odagiri", lustro(3, "seki", { archive: "hebi", voice: "torn" }, ["kagami_ambush", ...CLEANERS_DEAD]));
    expect(text(v2)).toContain("połową zapłaty");
    expect(text(v2)).toContain("oddaje ci fiolkę");
    expect(text(v2)).not.toContain("Sprzedałeś im swój głos");
  });

  it.each([
    ["street", "Ume chodzi od drzwi do drzwi"],
    ["hebi", "Hebi biorą już zamówienia"],
  ] as const)("after %s he talks about the archive", (ending, line) => {
    const { runtime } = setup();
    expect(text(runtime.start("ren_odagiri", after(ending)))).toContain(line);
  });
});

describe("Kaito's job on Ren", () => {
  it.each([
    [0, "refused", -3],
    [1, "taken", 3],
  ] as const)("choice %i records %s and names Kurosawa", (pick, option, delta) => {
    const { runtime, commands } = setup();
    const view = runtime.start("fixer", lustro(2, "aya", { rooftop: "together" }, ["recalled:rooftop"]));
    expect(text(view)).toContain("pięć tysięcy za Rena Odagiri");
    expect(text(view)).toContain("Prawie tyle, ile Kagami obiecało");
    expect(text(runtime.choose(pick))).toContain("Kurosawa");
    expect(commands).toEqual([
      { type: "story-choice", choice: "job", option },
      { type: "change-reputation", faction: "fixers", delta },
      { type: "set-flag", flag: "kagami_job" },
    ]);
  });

  it("speaks of the outcome once the act is over", () => {
    const { runtime, commands } = setup();
    expect(text(runtime.start("fixer", after("kagami")))).toContain("Kagami zapłaciło za Rena");
    expect(flagsSet(commands)).toContain("kaito_after_act2");
  });
});

describe("Kurosawa on the overpass", () => {
  const deal = (choices: Choices = {}) => lustro(3, "aya", { job: "taken", voice: "listened", ...choices });
  const pickArchive = (runtime: NarrativeRuntime, view: DialogueView, prefix: string) => runtime.choose(view.choices.findIndex((c) => c.text.startsWith(prefix)));

  it("offers her recording for Ren and the archive, in the light of earlier choices", () => {
    const { runtime } = setup();
    const view = runtime.start("kurosawa", deal());
    expect(text(view)).toContain("przyjęła pani zlecenie");
    expect(text(view)).toContain("filtr Odagiri");
    expect(view.choices.map((c) => c.text)).toEqual([
      "Ile z tego zapisu jest prawdziwe?",
      "Kto mówił do mnie głosem Rena?",
      "Archiwum wraca do ludzi, których nagraliście.",
      "Archiwum zostaje u Rena.",
      "Bierzcie Rena i archiwum. Chcę swój zapis.",
    ]);
  });

  it.each([
    ["Archiwum wraca", "street"],
    ["Archiwum zostaje", "hebi"],
  ] as const)("%s: the deal is off and the cleaners come out", (prefix, option) => {
    const { runtime, commands } = setup();
    const view = pickArchive(runtime, runtime.start("kurosawa", deal()), prefix);
    expect(text(view)).toContain("ludzie w kamizelkach Kagami");
    expect(commands).toEqual([
      { type: "story-choice", choice: "archive", option },
      { type: "set-flag", flag: "kagami_ambush" },
    ]);
  });

  it("taking the deal ends the act on the spot, without a fight", () => {
    const { runtime, commands } = setup();
    const view = pickArchive(runtime, runtime.start("kurosawa", deal({ rooftop: "together" })), "Bierzcie");
    expect(text(view)).toContain("chip w białym etui");
    expect(text(view)).toContain("obiecywał ci morze");
    expect(commands).toEqual([
      { type: "story-choice", choice: "archive", option: "kagami" },
      { type: "resolve-ending", act: 2 },
    ]);
  });

  it("only waits outside the overpass step", () => {
    const { runtime } = setup();
    expect(runtime.start("kurosawa", lustro(2, "seki")).lines[0]?.text).toContain("Czekam na kogoś");
  });
});

describe("act II flashbacks", () => {
  it.each([
    ["recall_rooftop", "rooftop", ["together", "alone"]],
    ["recall_last_call", "voice", ["listened", "torn"]],
  ] as const)("%s records the %s choice and marks itself played", (knot, choice, options) => {
    for (const [i, option] of options.entries()) {
      const { runtime, commands } = setup();
      runtime.start(knot, lustro(2, "aya"));
      expect(runtime.choose(i).ended).toBe(true);
      expect(commands).toEqual([
        { type: "story-choice", choice, option },
        { type: "set-flag", flag: `recalled:${knot.slice("recall_".length)}` },
      ]);
    }
  });

  it("the mirror plays without a choice", () => {
    const { runtime, commands } = setup();
    expect(runtime.start("recall_mirror", after("kagami")).ended).toBe(true);
    expect(commands).toEqual([{ type: "set-flag", flag: "recalled:mirror" }]);
  });

  it("syncs the act-II ending into ink", () => {
    const { runtime } = setup();
    runtime.start("recall_mirror", after("hebi"));
    expect(runtime.saveState()).toContain('"act2_ending":"^hebi"');
  });
});
