import { describe, expect, it } from "vitest";
import { type ActTwoEndingId, type Contract, type DomainState, type EndingId, createDomainState } from "@seki/core";
import { type DialogueView, NarrativeRuntime, STORY_SOURCE } from "../src";

/**
 * Guards the roles in every conversation: a player choice is something Seki says or does, never
 * a line of the person she talks to, and the answer comes from the right speaker. The checks look
 * at the shape of the dialogue (who speaks, in what order, what repeats), not at whole texts.
 */

const SPEAKER_PREFIX = /^[A-Z]+:/;
const CHOICE_RE = /^\s*[*+]\s*(?:\{[^}]*\}\s*)*\[([^\]]*)\]/;
const NPC_LINE_RE = /^\s*([A-Z]+):\s*(.+)$/;

const sourceLines = STORY_SOURCE.split("\n").filter((l) => !l.trim().startsWith("//"));
const choiceTexts = sourceLines.flatMap((l) => {
  const m = CHOICE_RE.exec(l);
  return m?.[1] !== undefined ? [m[1].trim()] : [];
});
const npcBodies = sourceLines.flatMap((l) => {
  const m = NPC_LINE_RE.exec(l);
  return m && m[1] !== "SEKI" && m[2] ? [m[2]] : [];
});

describe("player choices in the ink source", () => {
  it("are found", () => {
    expect(choiceTexts.length).toBeGreaterThan(20);
  });

  it.each(choiceTexts)("%s: not empty, no speaker prefix, not a line an NPC says", (choice) => {
    expect(choice).not.toBe("");
    expect(choice).not.toMatch(SPEAKER_PREFIX);
    expect(npcBodies.filter((body) => body.includes(choice))).toEqual([]);
  });
});

const base = (patch: Partial<DomainState> = {}): DomainState => {
  const d = createDomainState();
  return { ...d, clock: { seconds: 12 * 3600 }, ...patch };
};
const named = (patch: Partial<DomainState> = {}): DomainState => {
  const d = base(patch);
  return { ...d, character: { ...d.character, alias: "Seki Senshi", ...patch.character } };
};
const afterM0 = (patch: Partial<DomainState> = {}, active: Contract | null = null, completed = 1): DomainState =>
  named({ quests: { m0_first_contract: { status: "completed" } }, contracts: { active, completed }, ...patch });
const m0 = (stepIndex: number): DomainState => base({ quests: { m0_first_contract: { status: "active", stepIndex } } });
const echo = (stepIndex: number, patch: Partial<DomainState> = {}): DomainState =>
  afterM0({ quests: { m0_first_contract: { status: "completed" }, m3_echo: { status: "active", stepIndex } }, ...patch });
const memories = (...ids: DomainState["character"]["memories"]): Partial<DomainState> => ({
  character: { ...createDomainState().character, alias: "Seki Senshi", memories: ids },
});

type Choices = DomainState["story"]["choices"];
const ACT_ONE: Readonly<Record<EndingId, Choices>> = {
  aya: { case: "opened", name: "spoken", crash: "wheel" },
  seki: { case: "sealed", name: "silent", crash: "ren" },
};
/** Act II at `stepIndex`, after the act-I `ending`, with some choices overridden. */
const lustro = (stepIndex: number, ending: EndingId, choices: Choices = {}, patch: Partial<DomainState> = {}): DomainState =>
  afterM0({
    quests: { m0_first_contract: { status: "completed" }, m3_echo: { status: "completed" }, m3_lustro: { status: "active", stepIndex } },
    story: { choices: { ...ACT_ONE[ending], ...choices }, ending, act2Ending: null },
    ...patch,
    flags: [`ending:${ending}`, "seen:act2_opening", ...(patch.flags ?? [])],
  });
const afterLustro = (act2Ending: ActTwoEndingId, patch: Partial<DomainState> = {}): DomainState =>
  afterM0({
    quests: { m0_first_contract: { status: "completed" }, m3_echo: { status: "completed" }, m3_lustro: { status: "completed" } },
    story: { choices: { ...ACT_ONE.aya, archive: act2Ending }, ending: "aya", act2Ending },
    ...patch,
    flags: ["ending:aya", `ending:${act2Ending}`, "act2_ending", ...(patch.flags ?? [])],
  });
const CLEANERS_DEAD = ["dead:kagami-cleaner-1", "dead:kagami-cleaner-2", "dead:kagami-cleaner-3"];

const delivery = (status: Contract["status"]): Contract => ({ id: "c2", kind: "delivery", siteId: "hana_stall", targets: 0, reward: 325, status, deadlineTick: 6000 });
const retrieve = (status: Contract["status"]): Contract => ({ id: "c2", kind: "retrieve", siteId: "hebi_stash", targets: 2, reward: 470, status });
const hit = (status: Contract["status"]): Contract => ({ id: "c1", siteId: "car_wash", targets: 2, reward: 500, status });
const hack = (status: Contract["status"], progress?: number): Contract => ({
  id: "c3",
  kind: "hack",
  siteId: "quay_terminal",
  targets: 3,
  reward: 700,
  status,
  ...(progress === undefined ? {} : { progress, away: 0 }),
});
const escort = (status: Contract["status"]): Contract => ({ id: "c3", kind: "escort", siteId: "docks_escort", targets: 2, reward: 580, status });

interface Scenario {
  readonly name: string;
  readonly knot: string;
  readonly domain: DomainState;
  /** Display names allowed besides Seki and narration. */
  readonly npcs: readonly string[];
  /** Flashback choices are actions in narration ("Otwierasz walizkę."), not Seki's words. */
  readonly actions?: boolean;
}

const KAITO = ["Kaito"];
const SCENARIOS: readonly Scenario[] = [
  { name: "Kaito, first meeting", knot: "fixer", domain: m0(0), npcs: KAITO },
  { name: "Kaito, courier still alive", knot: "fixer", domain: m0(1), npcs: KAITO },
  { name: "Kaito, report back", knot: "fixer", domain: m0(2), npcs: KAITO },
  { name: "Kaito, contract offer", knot: "fixer", domain: afterM0({}, null, 0), npcs: KAITO },
  { name: "Kaito, offer with Kagami question", knot: "fixer", domain: echo(2, memories("operating_table")), npcs: KAITO },
  { name: "Kaito, payday", knot: "fixer", domain: afterM0({}, hit("cleared"), 2), npcs: KAITO },
  { name: "Kaito, delivery running", knot: "fixer", domain: afterM0({}, delivery("active")), npcs: KAITO },
  { name: "Kaito, busy for Hana", knot: "fixer", domain: afterM0({}, retrieve("active")), npcs: KAITO },
  { name: "Ume, first talk", knot: "ume", domain: m0(0), npcs: ["Babcia Ume"] },
  { name: "Ume, Ren unlocked", knot: "ume", domain: echo(1, memories("courier_case")), npcs: ["Babcia Ume"] },
  { name: "Ume, Ren after her memory", knot: "ume", domain: echo(1, { ...memories("courier_case"), flags: ["ume_memory"] }), npcs: ["Babcia Ume"] },
  { name: "Ume, at night", knot: "ume", domain: { ...m0(0), clock: { seconds: 23 * 3600 + 600 } }, npcs: ["Babcia Ume"] },
  { name: "Mori, small talk", knot: "mori", domain: echo(2), npcs: ["Doktor Mori"] },
  { name: "Mori, module", knot: "mori", domain: echo(1, { flags: ["recalled:courier_case"] }), npcs: ["Doktor Mori"] },
  {
    name: "Mori, finale aya",
    knot: "mori",
    domain: echo(3, { flags: ["recalled:crash_night"], story: { choices: { case: "opened", name: "spoken", crash: "wheel" }, ending: null, act2Ending: null } }),
    npcs: ["Doktor Mori"],
  },
  {
    name: "Mori, finale seki",
    knot: "mori",
    domain: echo(3, { flags: ["recalled:crash_night"], story: { choices: { case: "sealed", name: "silent", crash: "ren" }, ending: null, act2Ending: null } }),
    npcs: ["Doktor Mori"],
  },
  { name: "Hana, first offer", knot: "hana", domain: afterM0(), npcs: ["Hana"] },
  { name: "Hana, payday", knot: "hana", domain: afterM0({ flags: ["met_hana"] }, retrieve("cleared")), npcs: ["Hana"] },
  { name: "Hana, delivery", knot: "hana", domain: afterM0({}, delivery("active")), npcs: ["Hana"] },
  { name: "Oyaji, stall", knot: "oyaji", domain: afterM0(), npcs: ["Oyaji"] },
  { name: "Genzō, first offer", knot: "genzo", domain: afterM0(), npcs: ["Genzō"] },
  { name: "Genzō, known, Tessen hostile", knot: "genzo", domain: afterM0({ flags: ["met_genzo"], reputation: { ...createDomainState().reputation, tessen: -40 } }), npcs: ["Genzō"] },
  { name: "Genzō, payday", knot: "genzo", domain: afterM0({ flags: ["met_genzo"] }, escort("cleared")), npcs: ["Genzō"] },
  { name: "Genzō, hack running", knot: "genzo", domain: afterM0({}, hack("active", 600)), npcs: ["Genzō"] },
  { name: "Genzō, busy for Hana", knot: "genzo", domain: afterM0({}, retrieve("active")), npcs: ["Genzō"] },
  { name: "Oyaji, closed", knot: "oyaji_closed", domain: { ...afterM0(), clock: { seconds: 23 * 3600 } }, npcs: ["Oyaji"] },
  // Ulica Kanałowa and the market stalls (ADR-0026), by day and by night.
  { name: "Hideo, on his way to work", knot: "hideo", domain: afterM0(), npcs: ["Hideo"] },
  { name: "Hideo, at SAKE", knot: "hideo", domain: { ...afterM0(), clock: { seconds: 22 * 3600 } }, npcs: ["Hideo"] },
  { name: "Tetsu, first talk", knot: "tetsu", domain: afterM0(), npcs: ["Tetsu"] },
  { name: "Tetsu, known, at night", knot: "tetsu", domain: { ...afterM0({ flags: ["met_tetsu"] }), clock: { seconds: 23 * 3600 } }, npcs: ["Tetsu"] },
  { name: "Mei, by day", knot: "mei", domain: afterM0(), npcs: ["Mei"] },
  { name: "Mei, between sets", knot: "mei", domain: { ...afterM0(), clock: { seconds: 21 * 3600 } }, npcs: ["Mei"] },
  { name: "Sachiko, by day", knot: "sachiko", domain: afterM0(), npcs: ["Sachiko"] },
  { name: "Sachiko, at night, Hebi hostile", knot: "sachiko", domain: { ...afterM0({ reputation: { ...createDomainState().reputation, hebi: -40 } }), clock: { seconds: 23 * 3600 } }, npcs: ["Sachiko"] },
  { name: "Goro, stall open", knot: "goro", domain: afterM0(), npcs: ["Goro"] },
  { name: "Kenta, okonomiyaki", knot: "kenta", domain: afterM0(), npcs: ["Kenta"] },
  { name: "Fumiko, first visit", knot: "fumiko", domain: { ...afterM0(), clock: { seconds: 21 * 3600 } }, npcs: ["Fumiko"] },
  { name: "Fumiko, regular, friendly street", knot: "fumiko", domain: afterM0({ flags: ["met_fumiko"], reputation: { ...createDomainState().reputation, civilians: 40 } }), npcs: ["Fumiko"] },
  { name: "Fumiko, closed", knot: "fumiko_closed", domain: { ...afterM0(), clock: { seconds: 6 * 3600 } }, npcs: ["Fumiko"] },
  { name: "flashback: case", knot: "recall_courier_case", domain: echo(0), npcs: ["Ren"], actions: true },
  { name: "flashback: table", knot: "recall_operating_table", domain: echo(0), npcs: ["Technik Kagami", "Doktor Mori"], actions: true },
  { name: "flashback: crash", knot: "recall_crash_night", domain: echo(0), npcs: ["Ren"], actions: true },
  // Act II, "Lustro" (m3-lustro.ink), after each act-I ending and with different act-I choices.
  { name: "act II opening, aya", knot: "act2_opening", domain: lustro(0, "aya", { crash: "ren" }), npcs: ["Ren"] },
  { name: "act II opening, seki", knot: "act2_opening", domain: lustro(0, "seki", { crash: "ren" }), npcs: KAITO },
  { name: "Ume, where Ren is (aya)", knot: "ume", domain: lustro(0, "aya", {}, { flags: ["ume_memory", "ume_ren"] }), npcs: ["Babcia Ume"] },
  { name: "Ume, where Ren is (seki)", knot: "ume", domain: lustro(0, "seki"), npcs: ["Babcia Ume"] },
  { name: "Mori, the module talks (aya)", knot: "mori", domain: lustro(0, "aya"), npcs: ["Doktor Mori"] },
  { name: "Mori, who bought the module (seki)", knot: "mori", domain: lustro(0, "seki"), npcs: ["Doktor Mori"] },
  { name: "Ren, first meeting (aya)", knot: "ren_odagiri", domain: lustro(1, "aya", { case: "opened", crash: "ren" }), npcs: ["Ren"] },
  { name: "Ren, first meeting (seki)", knot: "ren_odagiri", domain: lustro(1, "seki", { case: "sealed", crash: "wheel" }), npcs: ["Ren"] },
  { name: "Ren, waiting for Kaito's news", knot: "ren_odagiri", domain: lustro(2, "aya"), npcs: ["Ren"] },
  { name: "Ren, waiting for the deal", knot: "ren_odagiri", domain: lustro(3, "aya"), npcs: ["Ren"] },
  { name: "Ren, under fire", knot: "ren_odagiri", domain: lustro(3, "aya", { archive: "street" }, { flags: ["kagami_ambush"] }), npcs: ["Ren"] },
  {
    name: "Ren, finale street",
    knot: "ren_odagiri",
    domain: lustro(3, "aya", { rooftop: "together", voice: "listened", archive: "street" }, { flags: ["kagami_ambush", ...CLEANERS_DEAD] }),
    npcs: ["Ren"],
  },
  {
    name: "Ren, finale hebi",
    knot: "ren_odagiri",
    domain: lustro(3, "seki", { rooftop: "alone", voice: "torn", archive: "hebi" }, { flags: ["kagami_ambush", ...CLEANERS_DEAD] }),
    npcs: ["Ren"],
  },
  { name: "Ren, after street", knot: "ren_odagiri", domain: afterLustro("street"), npcs: ["Ren"] },
  { name: "Ren, after hebi", knot: "ren_odagiri", domain: afterLustro("hebi"), npcs: ["Ren"] },
  { name: "Kaito, the job on Ren", knot: "fixer", domain: lustro(2, "aya", { rooftop: "together" }, { flags: ["recalled:rooftop"] }), npcs: KAITO },
  { name: "Kaito, after the kagami ending", knot: "fixer", domain: afterLustro("kagami"), npcs: KAITO },
  { name: "Kaito, after the street ending", knot: "fixer", domain: afterLustro("street"), npcs: KAITO },
  { name: "Kurosawa, waiting", knot: "kurosawa", domain: lustro(2, "aya"), npcs: ["Kurosawa"] },
  { name: "Kurosawa, the deal (aya)", knot: "kurosawa", domain: lustro(3, "aya", { job: "taken", voice: "listened", rooftop: "together" }), npcs: ["Kurosawa"] },
  { name: "Kurosawa, the deal (seki)", knot: "kurosawa", domain: lustro(3, "seki", { job: "refused", voice: "torn" }), npcs: ["Kurosawa"] },
  { name: "Ume, after the street ending", knot: "ume", domain: afterLustro("street", { flags: ["ume_memory"] }), npcs: ["Babcia Ume"] },
  { name: "flashback: rooftop", knot: "recall_rooftop", domain: lustro(1, "aya"), npcs: ["Ren"], actions: true },
  { name: "flashback: last call", knot: "recall_last_call", domain: lustro(2, "aya"), npcs: ["Ren", "Technik Kagami"], actions: true },
  { name: "flashback: mirror", knot: "recall_mirror", domain: afterLustro("kagami"), npcs: ["Technik Kagami"], actions: true },
  // Street encounters, one scenario per scene (and per branch the street's mood opens).
  { name: "encounter: pachinko", knot: "enc_s7_pachinko", domain: afterM0(), npcs: ["Nobu"] },
  { name: "encounter: salaryman", knot: "enc_s7_salaryman", domain: afterM0(), npcs: ["Sarariman"] },
  { name: "encounter: robot cat", knot: "enc_s7_neko", domain: afterM0(), npcs: ["Hina"] },
  { name: "encounter: poet", knot: "enc_s7_poet", domain: afterM0(), npcs: ["Shiro"] },
  { name: "encounter: poet, after the table", knot: "enc_s7_poet", domain: echo(2, memories("operating_table")), npcs: ["Shiro"] },
  { name: "encounter: flowers for Mei", knot: "enc_kanal_flowers", domain: afterM0(), npcs: ["Takumi"] },
  { name: "encounter: fisherman", knot: "enc_kanal_fisherman", domain: afterM0(), npcs: ["Dziadek Sabu"] },
  { name: "encounter: vending machine", knot: "enc_kanal_vending", domain: afterM0(), npcs: ["Automat"] },
  { name: "encounter: Hebi recruit", knot: "enc_kanal_recruit", domain: afterM0(), npcs: ["Koji"] },
  { name: "encounter: fortune teller", knot: "enc_targ_fortune", domain: afterM0(), npcs: ["Wróżka Kiku"] },
  { name: "encounter: chicken", knot: "enc_targ_chicken", domain: afterM0(), npcs: ["Daigo"] },
  { name: "encounter: debt", knot: "enc_targ_debt", domain: afterM0(), npcs: ["Akane", "Poborca Hebi"] },
  { name: "encounter: debt, Hebi friendly", knot: "enc_targ_debt", domain: afterM0({ reputation: { ...createDomainState().reputation, hebi: 40 } }), npcs: ["Akane", "Poborca Hebi"] },
  { name: "encounter: idol", knot: "enc_targ_idol", domain: afterM0(), npcs: ["Riko"] },
  { name: "encounter: laid off", knot: "enc_doki_laidoff", domain: afterM0(), npcs: ["Tomo"] },
  { name: "encounter: gull", knot: "enc_doki_gull", domain: afterM0(), npcs: ["Strażnik Tessen"] },
  { name: "encounter: container", knot: "enc_doki_container", domain: afterM0(), npcs: ["Głos z kontenera"] },
];

const firstWord = (s: string): string => (s.toLocaleLowerCase("pl").match(/\p{L}+/u) ?? [""])[0];

/** Walks every choice path (each choice text at most once per path) and checks each answer. */
const runtime = new NarrativeRuntime(STORY_SOURCE, () => {});
const freshState = runtime.saveState();

const explore = (scenario: Scenario): { choices: number; problems: string[] } => {
  runtime.loadState(freshState);
  // set_alias() renames Seki during a conversation, so her line may carry any of her names.
  const sekiNames = new Set([scenario.domain.character.alias ?? "Ty", "Seki Senshi", "Aya"]);
  const isSeki = (speaker: string | null): boolean => speaker !== null && sekiNames.has(speaker);
  const problems: string[] = [];
  let choices = 0;

  const check = (view: DialogueView, path: readonly string[], seen: ReadonlySet<string>): void => {
    for (const line of view.lines) {
      const where = `${scenario.name} > ${path.join(" > ") || "(start)"}`;
      if (line.speaker !== null && !isSeki(line.speaker) && !scenario.npcs.includes(line.speaker)) {
        problems.push(`${where}: unexpected speaker ${line.speaker}`);
      }
      if (line.speaker !== null && seen.has(`${line.speaker}|${line.text}`)) problems.push(`${where}: repeats "${line.text}"`);
    }
    const choice = path.at(-1);
    if (choice === undefined) return;
    const where = `${scenario.name} > ${path.join(" > ")}`;
    const sekiAt = view.lines.findIndex((l) => isSeki(l.speaker));
    if (sekiAt >= 0) {
      if (sekiAt !== 0) problems.push(`${where}: someone answers before Seki says her line`);
      if (!scenario.actions && firstWord(view.lines[sekiAt]?.text ?? "") !== firstWord(choice)) {
        problems.push(`${where}: Seki says something else than the choice`);
      }
      if (!view.lines.slice(sekiAt + 1).some((l) => l.speaker !== null && !isSeki(l.speaker)) && !scenario.actions && !view.ended) {
        problems.push(`${where}: nobody answers Seki`);
      }
    } else if (!scenario.actions && choice.endsWith("?")) {
      const first = view.lines.find((l) => l.speaker !== null);
      if (!first || !scenario.npcs.includes(first.speaker ?? "")) problems.push(`${where}: the question gets no answer from ${scenario.npcs.join("/")}`);
    }
  };

  const walk = (view: DialogueView, path: readonly string[], seen: ReadonlySet<string>): void => {
    check(view, path, seen);
    const next = new Set(seen);
    for (const line of view.lines) if (line.speaker !== null) next.add(`${line.speaker}|${line.text}`);
    if (path.length >= 8) return;
    for (const c of view.choices) {
      if (path.includes(c.text)) continue;
      choices += 1;
      const saved = runtime.saveState();
      walk(runtime.choose(c.index), [...path, c.text], next);
      runtime.loadState(saved);
    }
  };

  walk(runtime.start(scenario.knot, scenario.domain), [], new Set());
  return { choices, problems };
};

describe("conversation roles (every reachable choice)", () => {
  let reached = 0;

  it.each(SCENARIOS.map((s) => [s.name, s] as const))("%s", (_name, scenario) => {
    const { choices, problems } = explore(scenario);
    reached += choices;
    expect(problems).toEqual([]);
  });

  it("actually reaches the player choices", () => {
    expect(reached).toBeGreaterThan(40);
  });
});
