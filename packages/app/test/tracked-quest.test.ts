import { describe, expect, it } from "vitest";
import { type DomainState, createDomainState } from "@seki/core";
import { Simulation } from "@seki/sim";
import { buildJournal, createJournalCache } from "../src/journal";
import { describeObjective, shownEntryId } from "../src/objective";

/** Act I under way and a contract from Kaito running at once. */
const busy = (): DomainState => {
  const base = createDomainState();
  return {
    ...base,
    quests: { m0_first_contract: { status: "active", stepIndex: 0 } },
    contracts: { active: { id: "c4", siteId: "car_wash", targets: 3, reward: 625, status: "active" }, completed: 3 },
  };
};

const pin = (domain: DomainState, id: string | undefined): DomainState => ({
  ...domain,
  preferences: id ? { ...domain.preferences, trackedQuest: id } : { cameraMode: domain.preferences.cameraMode },
});

describe("tracking a journal entry on the HUD", () => {
  it("lets the game pick when nothing is pinned: the main thread first", () => {
    const d = busy();
    expect(shownEntryId(d)).toBe("m0_first_contract");
    expect(describeObjective(d).title).toBe("Pierwsze zlecenie");
  });

  it("shows the pinned contract instead of the main thread, and back again when unpinned", () => {
    const d = pin(busy(), "contract-c4");
    expect(shownEntryId(d)).toBe("contract-c4");
    expect(describeObjective(d).title).toBe("Kontrakt 4 · Kaito");
    expect(describeObjective(pin(d, undefined)).title).toBe("Pierwsze zlecenie");
  });

  it("falls back to the game's pick once the pinned entry is no longer running", () => {
    const d = pin({ ...busy(), contracts: { active: null, completed: 4 } }, "contract-c4");
    expect(shownEntryId(d)).toBe("m0_first_contract");
    const doneQuest = pin({ ...busy(), quests: { m0_first_contract: { status: "completed" } } }, "m0_first_contract");
    expect(shownEntryId(doneQuest)).toBe("contract-c4");
    expect(describeObjective(pin(busy(), "no_such_quest")).title).toBe("Pierwsze zlecenie");
  });

  it("marks the followed entry in the journal and whether the player chose it", () => {
    const auto = buildJournal(busy(), "en");
    expect(auto.quests.find((q) => q.id === "m0_first_contract")).toMatchObject({ tracked: true, pinned: false });
    expect(auto.quests.find((q) => q.id === "contract-c4")?.tracked).toBeUndefined();
    const chosen = buildJournal(pin(busy(), "contract-c4"), "en");
    expect(chosen.quests.find((q) => q.id === "contract-c4")).toMatchObject({ tracked: true, pinned: true });
    expect(chosen.quests.find((q) => q.id === "m0_first_contract")?.tracked).toBeUndefined();
  });

  it("rebuilds the cached journal when only the pin changes", () => {
    const cache = createJournalCache();
    const d = busy();
    const a = cache(d, "en");
    expect(cache(d, "en")).toBe(a);
    expect(cache(pin(d, "contract-c4"), "en")).not.toBe(a);
  });

  it("goes through the simulation as a command and lands in the saved preferences", () => {
    const sim = Simulation.create({ seed: 3 });
    sim.enqueue({ type: "track-quest", questId: "contract-c9" });
    sim.step();
    expect(sim.domain.preferences.trackedQuest).toBe("contract-c9");
    sim.enqueue({ type: "track-quest", questId: null });
    sim.step();
    expect(sim.domain.preferences).toEqual({ cameraMode: sim.domain.preferences.cameraMode });
  });
});
