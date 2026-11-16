import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION } from "@seki/core";
import { ESCORT_RETIRED_FLAG, MIGRATIONS, W3_WAKE, checksum, decodeSave } from "../src";
import { snapshot } from "./fixtures";

/** The docks rebuilt as Tessen's sector W-3 (ADR-0082 stage 1): schema v39 and the v38 -> v39 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const at = (key: string, x: number, y: number, z: number, extra: Record<string, unknown> = {}) => ({ key, position: { x, y, z }, yaw: 1, pitch: 0.2, hp: 100, cooldown: 0, alerted: false, ...extra });
const WAKE = { x: W3_WAKE.x, y: W3_WAKE.y, z: W3_WAKE.z };
const bag = (key: string, x: number, y: number, z: number) => ({ key, position: { x, y, z }, chunk: "nabrzeze-1-1", expiresAtTick: 9999, lines: [{ kind: "eddies", qty: 5 }] });
const body = (hidden: boolean, carried = false) => ({ downed: { playerAt: { x: 2550, y: -28.6, z: 420 }, fought: false, found: false, reported: false, dead: false, carried, hidden } });

/** The old warehouse's roof (local x -38..-18, z 94..120 by DOCKS_PLACE (2560; -28.6; 300), 9 m up). */
const WAREHOUSE_ROOF = { x: 2532, y: -19.6, z: 407 } as const;

/**
 * A v38 save on the old warehouse's roof during an escort: Mika, the ambush, a sniper on the crane,
 * Genzō by his old container, a body in the old container, a bag on the quay, Kaito on the deptak.
 */
const onTheWarehouse = () => {
  const s = snapshot({});
  const escort = { id: "c7", kind: "escort", siteId: "docks_escort", targets: 3, reward: 700, status: "active" };
  return {
    ...s,
    version: 38,
    entities: [
      at("player", WAREHOUSE_ROOF.x, WAREHOUSE_ROOF.y, WAREHOUSE_ROOF.z),
      at("c7-escort", 2578, -28.6, 397.6),
      at("c7-g0", 2548, -28.6, 434),
      at("c7-g1", 2580.5, -20.6, 438.7, { sniper: { phase: "idle", timer: 0, perch: 2 } }),
      at("genzo", 2580.6, -28.6, 397.6),
      at("c5-g2", 2550, -28.6, 445.2, body(true)),
      at("fixer", 320, -0.3, -93),
    ],
    domain: {
      ...s.domain,
      contracts: { active: escort, completed: 4, tally: { kills: 0 }, hooks: ["hook_escort_1"] },
      loot: { ...s.domain.loot, containers: [bag("loot:quay", 2560, -28.6, 432), bag("loot:deptak", 300, -0.4, -90)] },
    },
  };
};

const migrate = <T>(old: T): T => MIGRATIONS[38]!(old as unknown as Record<string, unknown>) as unknown as T;

describe("the docks rebuilt as Tessen's W-3 in the save (v38 to v39, ADR-0082 stage 1)", () => {
  it("is schema v39 or later", () => {
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(39);
  });

  it("wakes a player saved on the old warehouse's roof on the public strip by the metro, facing the fence", () => {
    const moved = migrate(onTheWarehouse());
    expect(moved.version).toBe(39);
    expect(moved.entities[0]).toMatchObject({ key: "player", position: WAKE, yaw: 0, pitch: 0, hp: 100 });
  });

  it("drops the docks' people (Mika, the posts, the sniper, Genzō) and lays the hidden body on the strip", () => {
    const moved = migrate(onTheWarehouse());
    expect(moved.entities.map((e) => e.key)).toEqual(["player", "c5-g2", "fixer"]);
    expect(moved.entities[1]).toMatchObject({ position: WAKE, downed: { hidden: false, carried: false } });
    expect(moved.entities[2]).toEqual(onTheWarehouse().entities[6]);
  });

  it("calls a running escort off without a penalty: no active job, the count kept, the flag for Genzō", () => {
    const moved = migrate(onTheWarehouse());
    expect(moved.domain.contracts).toEqual({ active: null, completed: 4 });
    expect(moved.domain.flags).toContain(ESCORT_RETIRED_FLAG);
    expect(moved.domain.reputation).toEqual(onTheWarehouse().domain.reputation);
    expect(moved.domain.wallet).toEqual(onTheWarehouse().domain.wallet);
  });

  it("keeps an infiltration or a hack running, at its new site", () => {
    for (const kind of ["infiltrate", "hack"] as const) {
      const job = { id: "c8", kind, siteId: kind === "hack" ? "quay_terminal" : "tessen_office", targets: 3, reward: 640, status: "active" };
      const old = { ...snapshot({}), version: 38, domain: { ...snapshot({}).domain, contracts: { active: job, completed: 2 } } };
      expect(migrate(old).domain.contracts.active).toEqual(job);
      expect(migrate(old).domain.flags).not.toContain(ESCORT_RETIRED_FLAG);
    }
  });

  it("puts the bags left on the docks where the player wakes, and leaves the others", () => {
    const [quay, deptak] = migrate(onTheWarehouse()).domain.loot.containers;
    expect(quay).toMatchObject({ key: "loot:quay", position: WAKE, chunk: W3_WAKE.chunk });
    expect(deptak).toEqual(onTheWarehouse().domain.loot.containers[1]);
  });

  it("leaves a player saved on the riverside path west of the river, or in the city, where she was", () => {
    for (const [x, y, z] of [
      [2441, -26.6, 440],
      [2455, -26.4, 360],
      [320, -0.3, -93],
    ] as const) {
      const moved = migrate({ ...snapshot({}), version: 38, entities: [at("player", x, y, z)] });
      expect(moved.entities[0]!.position, `${x},${z}`).toEqual({ x, y, z });
    }
  });

  it("drops the heat's reinforcements and a mugging's bodies left on the docks", () => {
    const person = (x: number, z: number) => ({ state: at("r", x, -28.6, z) });
    const old = { ...snapshot({}), version: 38, reinforcements: { sent: 2, wait: 3, people: [person(2560, 420), person(300, -90)] }, strayBodies: [person(2580, 440), person(310, -90)] };
    const moved = migrate(old);
    expect(moved.reinforcements.people.map((p) => p.state.position.x)).toEqual([300]);
    expect(moved.strayBodies.map((p) => p.state.position.x)).toEqual([310]);
  });

  it("decodes a v38 save on the warehouse's roof into the current schema", () => {
    const decoded = decodeSave("v38", wrap(onTheWarehouse()));
    expect(decoded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(decoded.entities[0]!.position).toEqual(WAKE);
    expect(decoded.domain.contracts.active).toBeNull();
  });
});
