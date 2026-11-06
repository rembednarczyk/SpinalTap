import { describe, expect, it } from "vitest";
import { REN_TRAIL_FLAG } from "@seki/core";
import { MOVED_STASHES, OLD_MARKET_WAKE, checksum } from "@seki/persistence";
import {
  ALCHEMIA_LIFT,
  ALCHEMIA_TERRACE,
  REN_SPOT,
  STALL_FRONT_YAW,
  STALL_KEEPERS,
  TARG_OVERPASS_STASH,
  TARG_ROOF_STASH,
  chunkAt,
  groundY,
} from "@seki/sim";
import { frame, setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * The market in Alchemia (ADR-0063 stage 6), headless: the stallholders at the stalls answer and
 * trade from the path in front of them, Ren is on the roof terrace up the lift, and a game saved
 * in the old market on Aleja Tysiąclecia loads with Seki on the avenue and its people in Alchemia.
 */

const OUT = { x: Math.sin(STALL_FRONT_YAW), z: Math.cos(STALL_FRONT_YAW) };
/** 1.4 m in front of a stallholder, facing back at him. */
const before = (key: keyof typeof STALL_KEEPERS) => ({ x: STALL_KEEPERS[key].x + OUT.x * 1.4, z: STALL_KEEPERS[key].z + OUT.z * 1.4 });
const faceStall = STALL_FRONT_YAW + Math.PI;

const startAt = (session: GameSession, at: { x: number; z: number }) => {
  teleport(session, at.x, at.z, faceStall);
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
};

describe("the market in Alchemia (ADR-0063 stage 6)", () => {
  it("each stallholder answers from the path in front of his stall, Oyaji's and Fumiko's stalls trade", () => {
    const { session, ui } = setup();
    session.newGame();
    // A new game is in the evening (21:00): Oyaji's stall is open till 22, Fumiko's ramen from 16.
    const expected: Readonly<Record<keyof typeof STALL_KEEPERS, RegExp>> = { sachiko: /Sachiko/, kenta: /Kenta/, fumiko: /Fumiko/, goro: /Goro/, oyaji: /Oyaji's stall/ };
    for (const key of Object.keys(expected) as (keyof typeof STALL_KEEPERS)[]) {
      startAt(session, before(key));
      expect(ui.getState().prompt ?? "", key).toMatch(expected[key]);
    }
    for (const key of ["oyaji", "fumiko"] as const) {
      startAt(session, before(key));
      steps(session, 1, frame({ interact: true }));
      expect(ui.getState().shopOpen, key).toBe(true);
      session.intents.closeShop();
      steps(session, 2);
    }
  });

  it("Ren waits on the roof terrace: up the lift, across the bridge, and he talks", () => {
    const { session, ui } = setup();
    session.newGame();
    session.sim.enqueue({ type: "set-flag", flag: REN_TRAIL_FLAG });
    const C = ALCHEMIA_LIFT.centre;
    startAt(session, { x: C.x, z: C.z + ALCHEMIA_LIFT.half + 1.4 });
    // Into the cage, up, and onto the terrace by Ren (the lift's own test walks the bridge step by step).
    teleport(session, C.x, C.z, Math.PI, 0, ALCHEMIA_LIFT.levels[0]);
    steps(session, 2);
    expect(ui.getState().prompt ?? "").toContain("Elevator");
    steps(session, 1, frame({ interact: true }));
    steps(session, Math.ceil(((ALCHEMIA_LIFT.levels[1] - ALCHEMIA_LIFT.levels[0]) / 2.5) * 60) + 15);
    expect(session.sim.player()!.position.y).toBeCloseTo(ALCHEMIA_LIFT.levels[1], 2);
    const ren = [...session.sim.world].find((e) => e.key === "ren")!;
    expect(ren.position.y).toBeCloseTo(ALCHEMIA_TERRACE.roof, 1);
    // On his side away from the Hebi bag by him, facing him.
    const away = { x: REN_SPOT.x - TARG_ROOF_STASH.at.x, z: REN_SPOT.z - TARG_ROOF_STASH.at.z };
    const d = Math.hypot(away.x, away.z);
    const stand = { x: REN_SPOT.x + (away.x / d) * 1.1, z: REN_SPOT.z + (away.z / d) * 1.1 };
    teleport(session, stand.x, stand.z, Math.atan2(-away.x, -away.z), 0, ALCHEMIA_TERRACE.roof);
    steps(session, 2);
    expect(ui.getState().prompt ?? "").toContain("Ren");
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().dialogue).not.toBeNull();
  });

  it("an old save in the market loads with Seki on the avenue where it stood and its people in Alchemia", async () => {
    // The migration's places are the content's (persistence knows no map).
    for (const [key, s] of Object.entries(MOVED_STASHES)) {
      const at = key === TARG_ROOF_STASH.key ? TARG_ROOF_STASH.at : TARG_OVERPASS_STASH.at;
      expect(Math.hypot(s.x - at.x, s.y - at.y, s.z - at.z), key).toBeLessThan(0.01);
      expect(chunkAt(at.x, at.z)?.id).toBe(s.chunk);
    }
    expect(OLD_MARKET_WAKE.y - groundY(OLD_MARKET_WAKE.x, OLD_MARKET_WAKE.z)).toBeCloseTo(0.05, 2);
    expect(chunkAt(OLD_MARKET_WAKE.x, OLD_MARKET_WAKE.z)?.id).toBe(OLD_MARKET_WAKE.chunk);

    const { session, store } = setup();
    session.newGame();
    steps(session, 2);
    // A v28 save with her on the old market's south roof and Oyaji at his old stall.
    const now = session.sim.snapshot(null, "old", "");
    const entities = [
      ...now.entities.filter((e) => e.key !== "player"),
      { ...now.entities.find((e) => e.key === "player")!, position: { x: 775, y: -7.9, z: 319.6 } },
      { key: "oyaji", position: { x: 769, y: -20.6, z: 326.6 }, yaw: 0, pitch: 0, hp: 120, cooldown: 0, alerted: false },
    ];
    const text = JSON.stringify({ ...now, version: 28, entities, streaming: { loadedChunks: ["podzamcze-1-0"] } });
    await store.put("old", JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text }));
    expect(await session.saves.loadAsync("old")).toBe(true);
    const p = session.sim.player()!;
    expect({ x: p.position.x, z: p.position.z }).toEqual({ x: OLD_MARKET_WAKE.x, z: OLD_MARKET_WAKE.z });
    const hp = p.health!.current;
    steps(session, 30);
    expect(p.position.y).toBeCloseTo(groundY(OLD_MARKET_WAKE.x, OLD_MARKET_WAKE.z), 1);
    expect(p.health!.current).toBe(hp);
    expect(session.sim.district).toBe("targ");
    // Oyaji is at his stall in Alchemia when she gets there.
    startAt(session, before("oyaji"));
    const oyaji = [...session.sim.world].find((e) => e.key === "oyaji")!;
    expect(Math.hypot(oyaji.position.x - STALL_KEEPERS.oyaji.x, oyaji.position.z - STALL_KEEPERS.oyaji.z)).toBeLessThan(3.5);
  });
});
