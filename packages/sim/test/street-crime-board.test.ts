import { describe, expect, it } from "vitest";
import { GRUDGE_STEP, SECONDS_PER_HOUR, bandLevel, TERRITORIES, TESSEN_FOIL_STANDING, crimeSlot, standingOf, streetCrimePay, streetCrimesAt } from "@seki/core";
import { CRIME_REACH, type BoardCrime, DISTRICT_BANDS, MICRO_SPOTS, Simulation, TERRITORY_GROUPS, chunkAt, crimeBoard, crimeHidden, ground, inBuilding } from "../src";
import { onRoad } from "../src/content/lublin/roads";
import { run, teleportPlayer } from "./helpers";

/*
 * The street's board of crimes (ADR-0091 stage 5a): every 4 game hours 1–2 crimes per district at
 * the street's spots, from the seed and the slot alone; one starts once the player comes within
 * 60 m of it, any time (a contract's district aside). Foiled, Tessen pays as the police, the
 * gang holding the district holds it against her, and it does not come back on that board.
 */

const HOUR = 13;

/** After Kaito's first word, at 13:00, with `patch` on the domain. */
const street = (seed = 6, patch: (d: Simulation["domain"]) => Simulation["domain"] = (d) => d): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "t", "");
  const clock = { seconds: HOUR * SECONDS_PER_HOUR };
  const domain = patch({ ...snap.domain, flags: ["met_fixer"], clock, streetCrimes: streetCrimesAt(clock) });
  const sim = Simulation.fromSnapshot({ ...snap, domain });
  run(sim, 1);
  return sim;
};

/** A crime of the board of seed 6 at 13:00 of `kind` (a board with one exists: see the first test). */
const boardCrime = (kind: BoardCrime["kind"], seed = 6): BoardCrime => crimeBoard(seed, crimeSlot({ seconds: HOUR * SECONDS_PER_HOUR })).find((c) => c.kind === kind)!;

/** To 30 m of the crime, where it starts. */
const goTo = (sim: Simulation, c: BoardCrime): void => {
  teleportPlayer(sim, ground(c.at.x, c.at.z - 30), 0);
  run(sim, 2);
};

describe("the street's board of crimes (ADR-0091 stage 5a)", () => {
  it("draws 1-2 crimes per district from the seed and the slot alone, each id once", () => {
    const board = crimeBoard(6, 3);
    expect(crimeBoard(6, 3)).toEqual(board);
    expect(crimeBoard(7, 3)).not.toEqual(board);
    for (const d of ["shinsekai-7", "kanal", "targ", "doki"]) expect(board.filter((c) => c.district === d).length).toBeGreaterThanOrEqual(1);
    for (const d of ["shinsekai-7", "kanal", "targ", "doki"]) expect(board.filter((c) => c.district === d).length).toBeLessThanOrEqual(2);
    expect(new Set(board.map((c) => c.id)).size).toBe(board.length);
    const kinds = new Set(Array.from({ length: 6 }, (_, s) => crimeBoard(6, crimeSlot({ seconds: HOUR * SECONDS_PER_HOUR }) + s).map((c) => c.kind)).flat());
    expect([...kinds].sort()).toEqual(["aid", "deal", "droneTheft", "extortion", "kidnap", "mugging"]);
    expect(boardCrime("mugging")).toBeDefined();
  });

  it("keeps every crime's spot 40 m or more off the cores of the gangs' territories (decision 9 of 18.11)", () => {
    const spots = Array.from({ length: 12 }, (_, s) => crimeBoard(6, s)).flat();
    for (const c of spots) {
      for (const g of TERRITORY_GROUPS) {
        if (TERRITORIES[g.territory].district !== c.district) continue;
        expect(Math.hypot(c.at.x - g.core.x, c.at.z - g.core.z), `${c.id} by ${g.territory}`).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it("starts a crime when she comes within reach, and a foiled mugging pays as Tessen pays, angers the district's gang, and stays done", () => {
    const c = boardCrime("mugging");
    const sim = street();
    goTo(sim, c);
    const run0 = sim.session.street2.micro;
    expect(run0?.crime?.id).toBe(c.id);
    expect(CRIME_REACH).toBe(60);
    const eddies = sim.domain.wallet.eddies;
    const tessen = sim.domain.reputation.tessen;
    for (const id of run0!.attackers) {
      const e = [...sim.world].find((x) => x.id === id)!;
      e.health = { ...e.health!, current: 0 };
      e.lastHitBy = sim.player()!.id;
    }
    run(sim, 2);
    // Another crime of the board near by may start on the next step.
    expect(sim.session.street2.micro?.crime?.id).not.toBe(c.id);
    // At the level of the district's band (ADR-0059), as the contracts there pay.
    expect(sim.domain.wallet.eddies - eddies).toBe(streetCrimePay("mugging", bandLevel(sim.domain.progression.level, DISTRICT_BANDS[c.district]), 0, tessen));
    expect(sim.domain.reputation.tessen).toBe(tessen + TESSEN_FOIL_STANDING);
    expect(sim.domain.streetCrimes.done).toEqual([c.id]);
    expect(sim.domain.streetCrimes.paidToday).toBe(1);
    if (c.district !== "doki") expect(standingOf(sim.domain.gangStandings, "hebi", c.district).grudge).toBeGreaterThanOrEqual(GRUDGE_STEP.foil);
    goTo(sim, c);
    expect(sim.session.street2.micro?.crime?.id).not.toBe(c.id);
  });

  it("pays nothing from Tessen to a player it holds wanted, though the crime is done", () => {
    const c = boardCrime("mugging");
    const sim = street(6, (d) => ({ ...d, reputation: { ...d.reputation, tessen: -60 } }));
    goTo(sim, c);
    const run0 = sim.session.street2.micro!;
    const eddies = sim.domain.wallet.eddies;
    for (const id of run0.attackers) {
      const e = [...sim.world].find((x) => x.id === id)!;
      e.health = { ...e.health!, current: 0 };
      e.lastHitBy = sim.player()!.id;
    }
    run(sim, 2);
    expect(sim.domain.wallet.eddies).toBe(eddies);
    expect(sim.domain.streetCrimes.done).toEqual([c.id]);
  });

  it("hides the crimes of a running contract's district, and only there", () => {
    expect(crimeHidden("kanal_bridge", "kanal")).toBe(true);
    expect(crimeHidden("kanal_bridge", "targ")).toBe(false);
    expect(crimeHidden("w3_hall", "doki")).toBe(false);
    expect(crimeHidden(null, "kanal")).toBe(false);
  });

  it("stands every spot of the board on the pavement of its district", () => {
    for (const [district, spots] of Object.entries(MICRO_SPOTS)) {
      for (const p of spots) {
        expect(chunkAt(p.x, p.z)?.district, `${p.x},${p.z}`).toBe(district);
        expect(inBuilding(p.x, p.z)).toBe(false);
        if (district !== "doki") expect(onRoad(p.x, p.z)).toBe(false);
      }
    }
  });
});
