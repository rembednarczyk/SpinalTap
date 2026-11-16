import { describe, expect, it } from "vitest";
import { type GameCommand, type InputFrame, STACKABLE_CATALOG, healScale } from "@seki/core";
import { type Simulation } from "../src";
import { input } from "./helpers";
import { floorScript, floorSim, play } from "./fixtures/determinism-floor";

/** Hurt enough that a medkit heals in full, with or without the perk. */
const HURT = 20;

/** The floor after its first frame (the level up to 2): Tech to 4 opens Field Medic, a rank of it, the player hurt. */
const medicFloor = (): Simulation => {
  const sim = play(floorSim(1234), floorScript().slice(0, 1));
  sim.enqueue({ type: "spend-attribute-point", attribute: "tech" });
  sim.enqueue({ type: "spend-perk-point", perk: "tech_field_medic" });
  sim.step();
  const p = sim.player();
  if (p?.health) p.health = { ...p.health, current: HURT };
  return sim;
};

const healedBy = (commands: readonly GameCommand[], frame: InputFrame): number => {
  const sim = medicFloor();
  expect(healScale(sim.domain.progression.perks)).toBeGreaterThan(1);
  for (const c of commands) sim.enqueue(c);
  sim.step(frame);
  return (sim.player()?.health?.current ?? 0) - HURT;
};

describe("Field Medic on a quick-used medkit (G-895)", () => {
  it("quick use heals as much as the use-item command", () => {
    const quick = healedBy([], input({ useItem: true }));
    const command = healedBy([{ type: "use-item", ref: { stack: "medkit" } }], input());
    expect(command).toBeGreaterThan(STACKABLE_CATALOG.medkit.heal);
    expect(quick).toBe(command);
  });
});
