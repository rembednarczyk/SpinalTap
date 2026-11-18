// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUICKHACKS, hackCost } from "@seki/core";
import { GameUi, type ScanTargetVm, type UiIntents, type UiState, createUiStore } from "../src";

/*
 * G-374: the quickhack list shows what a hack costs now. With the breached network's ICEpick
 * (ADR-0029) the simulation takes 1 RAM less (`hackCost`); the list says the same, and a hack
 * that much cheaper is not greyed out for want of RAM.
 */

const intents = new Proxy({} as UiIntents, { get: () => vi.fn() });
const enemy: ScanTargetVm = { id: 7, kind: "person", name: "Ganger", faction: "Hebi", profile: [], hostile: true };
const HACKS = ["ping", "reboot_optics", "cripple_movement", "short_circuit"] as const;

const mount = (state: Partial<UiState>) => render(<GameUi store={createUiStore({ screen: "playing", scanning: true, scanTarget: enemy, ...state })} intents={intents} />);
const costOf = (id: string) => screen.getByTestId(`hack-${id}`).querySelector(".hacks__ram")?.textContent;

afterEach(cleanup);

describe("G-374: the quickhack list's RAM cost", () => {
  it("without ICEpick, the table's cost", () => {
    mount({ ram: { current: 8, max: 8 } });
    for (const id of HACKS) expect(costOf(id), id).toBe(`${QUICKHACKS[id].ram} RAM`);
  });

  it("with ICEpick, the cost the simulation takes, and a hack affordable at it is not short", () => {
    const most = Math.max(...HACKS.map((id) => QUICKHACKS[id].ram));
    mount({ ram: { current: most - 1, max: 8, icepick: true } });
    for (const id of HACKS) expect(costOf(id), id).toBe(`${hackCost(id, true)} RAM`);
    const dearest = HACKS.find((id) => QUICKHACKS[id].ram === most)!;
    expect(screen.getByTestId(`hack-${dearest}`).className).not.toContain("hacks__row--short");
  });
});
