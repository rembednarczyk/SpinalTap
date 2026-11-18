import { describe, expect, it } from "vitest";
import { type Contract, type DomainEvents, type DomainState, EventBus, createDomainState } from "@seki/core";
import { createUiStore, patchUi } from "@seki/ui";
import { HackingHud } from "../src/presenters/hacking-hud";
import { hudPartContext } from "../src/presenters/hud-part";

/*
 * G-374: the HUD learns when the breached network's ICEpick runs (ADR-0029), so the quickhack
 * list shows the cost the simulation takes; RAM updates keep it.
 */

const HACK: Contract = { id: "c9", kind: "hack", siteId: "quay_terminal", targets: 3, reward: 900, status: "active", progress: 10 } as Contract;

const presenter = () => {
  let domain: DomainState = createDomainState();
  const bus = new EventBus<DomainEvents>();
  const ui = createUiStore({ screen: "playing" });
  const hooks = { playerId: () => null, domain: () => domain, clock: () => "", tick: () => 0, ticksPerSecond: 30, damageMode: () => "off" as const, renderKnot: () => [] };
  const hud = new HackingHud(hudPartContext(bus, ui, hooks));
  const frame = () => patchUi(ui, hud.frame({ tick: 0, found: new Map(), player: undefined, busy: false, calm: true }));
  const withJob = (c: Contract | null) => {
    domain = { ...domain, contracts: { ...domain.contracts, active: c } };
  };
  return { bus, ui, frame, withJob };
};

describe("G-374: ICEpick on the HUD", () => {
  it("turns on with the breach's ICEpick on the running hack job, off when the job ends, through RAM changes", () => {
    const { bus, ui, frame, withJob } = presenter();
    frame();
    expect(ui.getState().ram.icepick ?? false).toBe(false);
    withJob({ ...HACK, breach: ["icepick"] } as Contract);
    frame();
    expect(ui.getState().ram.icepick).toBe(true);
    bus.emit("RamChanged", { current: 3, max: 8 });
    expect(ui.getState().ram).toEqual({ current: 3, max: 8, icepick: true });
    // Another daemon is no discount; nor is an ICEpick past its job.
    withJob({ ...HACK, breach: ["datamine"] } as Contract);
    frame();
    expect(ui.getState().ram.icepick).toBe(false);
    withJob(null);
    frame();
    expect(ui.getState().ram.icepick).toBe(false);
  });
});
