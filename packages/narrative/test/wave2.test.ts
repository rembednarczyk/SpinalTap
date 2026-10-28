import { describe, expect, it } from "vitest";
import { type Contract, type ContractVariation, type DomainState, type HookContractKind, createDomainState } from "@seki/core";
import { NarrativeRuntime, STORY_SOURCE, describeVariation, variationOf } from "../src";

/** Wave 2 texts (ADR-0032): hooks, metro, radio and the fixers' word on a contract's variation. */

const KNOTS = [...STORY_SOURCE.matchAll(/^===\s*(\w+)\s*===/gm)].map((m) => m[1] ?? "");
const knotsLike = (re: RegExp): string[] => KNOTS.filter((k) => re.test(k));

const domain = (active: Contract | null = null): DomainState => {
  const d = createDomainState();
  return {
    ...d,
    clock: { seconds: 21 * 3600 },
    character: { ...d.character, alias: "Seki Senshi" },
    quests: { m0_first_contract: { status: "completed" } },
    contracts: { active, completed: 2 },
  };
};

const runtime = new NarrativeRuntime(STORY_SOURCE, () => {});
const fresh = runtime.saveState();
const play = (knot: string, d: DomainState = domain(), variation?: ContractVariation) => {
  runtime.loadState(fresh);
  return runtime.start(knot, d, undefined, variation);
};

/** A one-shot text: one to three lines, no choices, every speaker with a display name. */
const expectOneShot = (knot: string): void => {
  const view = play(knot);
  expect(view.choices, knot).toEqual([]);
  expect(view.lines.length, knot).toBeGreaterThanOrEqual(1);
  expect(view.lines.length, knot).toBeLessThanOrEqual(3);
  for (const line of view.lines) {
    expect(line.text.length, knot).toBeGreaterThan(10);
    expect(line.speaker ?? "", knot).not.toMatch(/^[A-Z]+$/);
  }
};

const HOOK_KINDS: readonly HookContractKind[] = ["eliminate", "delivery", "retrieve", "protect", "escort", "infiltrate", "hack"];

describe("observation hooks", () => {
  it.each(HOOK_KINDS)("%s has one or two hook knots", (kind) => {
    const hooks = knotsLike(new RegExp(`^hook_${kind}_\\d+$`));
    expect(hooks.length).toBeGreaterThanOrEqual(1);
    expect(hooks.length).toBeLessThanOrEqual(2);
    for (const knot of hooks) expectOneShot(knot);
  });
});

describe("metro rides", () => {
  it("has six to ten lines for the car, none with choices", () => {
    const rides = knotsLike(/^metro_ride_\d+$/);
    expect(rides.length).toBeGreaterThanOrEqual(6);
    expect(rides.length).toBeLessThanOrEqual(10);
    for (const knot of rides) expectOneShot(knot);
  });
});

describe("radio breaks", () => {
  it.each(["drift", "yoru", "tessen"])("station %s has four to six breaks", (station) => {
    const breaks = knotsLike(new RegExp(`^radio_${station}_\\d+$`));
    expect(breaks.length).toBeGreaterThanOrEqual(4);
    expect(breaks.length).toBeLessThanOrEqual(6);
    for (const knot of breaks) expectOneShot(knot);
  });
});

describe("contract variations in the fixers' lines", () => {
  const variation: ContractVariation = { modifiers: ["time_limit", "twin"], security: "light", trait: "armored", twist: "setup" };
  const text = describeVariation(variation);

  it("describes the modifiers, the security and the trait, never the twist", () => {
    expect(text).toContain("Klient liczy czas");
    expect(text).toContain("dwóch");
    expect(text).toContain("cienka");
    expect(text).toContain("pancerz");
    expect(text).not.toMatch(/ustawk|podstaw/i);
    expect(describeVariation({ modifiers: [], security: "standard" })).toBe("");
    expect(describeVariation(undefined)).toBe("");
  });

  it("reads the variation stored on a contract and ignores anything else", () => {
    expect(variationOf({ id: "c1", variation })).toEqual(variation);
    expect(variationOf({ id: "c1", variation: { modifiers: "x" } })).toBeUndefined();
    expect(variationOf({ id: "c1" })).toBeUndefined();
    expect(variationOf(null)).toBeUndefined();
  });

  const hit: Contract = { id: "c1", siteId: "car_wash", targets: 2, reward: 500, status: "active" };
  const delivery: Contract = { id: "c2", kind: "delivery", siteId: "hana_stall", targets: 0, reward: 325, status: "active", deadlineTick: 6000 };
  const retrieve: Contract = { id: "c2", kind: "retrieve", siteId: "hebi_stash", targets: 2, reward: 470, status: "active" };
  const escort: Contract = { id: "c3", kind: "escort", siteId: "docks_escort", targets: 2, reward: 580, status: "active" };

  it.each([
    ["Kaito, hit", "fixer", hit, "Kaito"],
    ["Kaito, delivery", "fixer", delivery, "Kaito"],
    ["Hana, retrieve", "hana", retrieve, "Hana"],
    ["Genzō, escort", "genzo", escort, "Genzō"],
  ] as const)("%s: the line comes only with a variation", (_name, knot, contract, speaker) => {
    const said = (v?: ContractVariation) => play(knot, domain(contract), v).lines.filter((l) => l.speaker === speaker && l.text.includes(text));
    expect(said(variation)).toHaveLength(1);
    expect(said()).toHaveLength(0);
  });

  it("takes the variation from the contract when the caller passes none", () => {
    const stored = { ...hit, variation } as Contract;
    expect(play("fixer", domain(stored)).lines.some((l) => l.text.includes(text))).toBe(true);
  });
});
