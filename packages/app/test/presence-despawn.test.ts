import { describe, expect, it } from "vitest";
import { KAGAMI_AMBUSH_FLAG, KAGAMI_JOB_FLAG } from "@seki/core";
import { market } from "@seki/sim";
import { setup, shootDown, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * G-033: a character whose presence condition stops holding leaves the scene the way a chunk
 * unload does ("unloaded"), so the renderer does not play its death fall. A kill still reads
 * as "removed".
 */

const idOf = (s: GameSession, key: string) => [...s.sim.world].find((e) => e.key === key)?.id;

const start = () => {
  const ctx = setup();
  ctx.session.newGame();
  steps(ctx.session, 1);
  return { ...ctx, despawns: ctx.render.despawns };
};

describe("G-033: leaving by the flags is not a death", () => {
  it("a conditional character that a flag sends away despawns as unloaded", () => {
    const { session, despawns } = start();
    session.sim.enqueue({ type: "set-flag", flag: KAGAMI_JOB_FLAG });
    // Kurosawa waits on the overpass deck while the Kagami job is open (district-targ.ts).
    const deck = market(98.5, 9.9, 92);
    teleport(session, deck.x, deck.z, Math.PI / 2, 0, deck.y);
    steps(session, 2);
    const kurosawa = idOf(session, "kurosawa");
    expect(kurosawa).toBeDefined();

    despawns.length = 0;
    session.sim.enqueue({ type: "set-flag", flag: KAGAMI_AMBUSH_FLAG });
    steps(session, 1);
    expect(idOf(session, "kurosawa")).toBeUndefined();
    expect(despawns).toContainEqual([kurosawa, "unloaded"]);
  });

  it("a ganger that is shot down still despawns as removed", () => {
    const { session, despawns } = start();
    const courier = idOf(session, "courier");
    expect(courier).toBeDefined();
    shootDown(session, "courier");
    steps(session, 1);
    expect(despawns).toContainEqual([courier, "removed"]);
  });
});
