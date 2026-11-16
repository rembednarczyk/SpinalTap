import { describe, expect, it } from "vitest";
import { type Contract, type DomainState, type GameCommand, createDomainState } from "@seki/core";
import { type DialogueView, NarrativeRuntime, STORY_SOURCE } from "../src";

const setup = () => {
  const commands: GameCommand[] = [];
  const runtime = new NarrativeRuntime(STORY_SOURCE, (c) => commands.push(c));
  return { runtime, commands };
};

const text = (v: DialogueView) => v.lines.map((l) => l.text).join("\n");

const domain = (patch: Partial<DomainState> & { active?: Contract | null } = {}): DomainState => {
  const d = createDomainState();
  const { active = null, ...rest } = patch;
  return { ...d, quests: { m0_first_contract: { status: "completed" } }, character: { ...d.character, alias: "Seki Senshi" }, contracts: { active, completed: 2 }, ...rest };
};

const hack = (status: Contract["status"], progress?: number): Contract => ({
  id: "c3",
  kind: "hack",
  siteId: "quay_terminal",
  targets: 3,
  reward: 700,
  status,
  ...(progress === undefined ? {} : { progress, away: 0 }),
});

describe("Genzō (M4, docks)", () => {
  it("introduces himself once and offers the jobs of W-3 and its sabotage, the escort retired (ADR-0082)", () => {
    const { runtime, commands } = setup();
    const view = runtime.start("genzo", domain());
    expect(view.lines[0]).toEqual({ speaker: "Genzō", text: expect.stringContaining("Genzō. Pływam nocą") });
    expect(view.choices.map((c) => c.text)).toEqual(["Co trzeba wynieść z biura Tessen?", "Który terminal mam złamać?", "Co to za partia dronów?", "Nie teraz."]);
    expect(commands).toEqual([{ type: "set-flag", flag: "met_genzo" }]);
    expect(text(runtime.start("genzo", domain({ flags: ["met_genzo"] })))).not.toContain("Pływam nocą");
  });

  it.each([
    [0, "infiltrate", "Nikt nie może cię zobaczyć"],
    [1, "hack", "Czerwony laser"],
  ] as const)("choice %i asks the domain for a %s job", (index, kind, says) => {
    const { runtime, commands } = setup();
    runtime.start("genzo", domain({ flags: ["met_genzo"] }));
    const view = runtime.choose(index);
    expect(view.lines[0]?.speaker).toBe("Seki Senshi");
    expect(text(view)).toContain(says);
    expect(commands).toEqual([{ type: "accept-contract", kind }]);
  });

  it("offers the sabotage of W-3 once (ADR-0082 stage 3): the flag, then the job; not again after", () => {
    const { runtime, commands } = setup();
    runtime.start("genzo", domain({ flags: ["met_genzo"] }));
    const view = runtime.choose(2);
    expect(text(view)).toContain("serwerowni N");
    expect(commands).toEqual([
      { type: "set-flag", flag: "w3:sabotage-offered" },
      { type: "accept-contract", kind: "sabotage" },
    ]);
    const again = runtime.start("genzo", domain({ flags: ["met_genzo", "w3:sabotage-offered"] }));
    expect(again.choices.map((c) => c.text)).not.toContain("Co to za partia dronów?");
  });

  it("warns about the rooftop shooters once Tessen knows Seki", () => {
    const { runtime } = setup();
    const hostile = { ...createDomainState().reputation, tessen: -40 };
    expect(text(runtime.start("genzo", domain({ flags: ["met_genzo"], reputation: hostile })))).toContain("strzelców");
  });

  it("tells once that Mika's walk is off when the save's escort was called off (ADR-0082, v39)", () => {
    const { runtime, commands } = setup();
    const said = text(runtime.start("genzo", domain({ flags: ["met_genzo", "w3:escort-retired"] })));
    expect(said).toContain("Z Miką na razie nic");
    expect(commands).toEqual([{ type: "set-flag", flag: "w3:escort-retired-told" }]);
    expect(text(runtime.start("genzo", domain({ flags: ["met_genzo", "w3:escort-retired", "w3:escort-retired-told"] })))).not.toContain("Z Miką");
  });

  it("will not talk to someone Kaito's network turned away", () => {
    const { runtime, commands } = setup();
    const view = runtime.start("genzo", domain({ reputation: { ...createDomainState().reputation, fixers: -40 } }));
    expect(view.ended).toBe(true);
    expect(commands).toEqual([]);
  });

  it("a running hack tells the seconds left; a finished one is paid", () => {
    const { runtime, commands } = setup();
    expect(text(runtime.start("genzo", domain({ active: hack("active", 15 * 60) }), { tick: 0, ticksPerSecond: 60 }))).toContain("zostało 25 sekund");
    const pay = runtime.start("genzo", domain({ flags: ["met_genzo"], active: hack("cleared") }));
    expect(text(pay)).toContain("700 eddies");
    expect(commands).toContainEqual({ type: "complete-contract" });
  });
});
