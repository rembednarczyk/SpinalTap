import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type LootContainer } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave } from "../src";
import { CLINIC_CHAIR, snapshot } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const bag = (key: string, x: number, z: number): LootContainer => ({ key, position: { x, y: 0, z }, chunk: "shinsekai-7", expiresAtTick: 99999, lines: [{ kind: "eddies", qty: 40 }] });

describe("the world moves to Lublin (v14 to v15, ADR-0045)", () => {
  /** What v14 wrote in the old city: the player on Ulica Kanałowa, a guard asleep, a door open, bags and stashes, the heat on. */
  const v14Payload = () => {
    const s = snapshot();
    return {
      ...s,
      version: 14,
      entities: [...s.entities, { key: "oyaji", position: { x: 80, y: 0, z: 62 }, yaw: 0, pitch: 0, hp: 60, cooldown: 0, alerted: false }],
      streaming: { loadedChunks: ["shinsekai-7", "kanal"] },
      doors: [{ key: "door:klinika#0", open: 0.6, idle: 0.2 }],
      domain: {
        ...s.domain,
        flags: ["met_fixer", "dead:courier", "placed:stash:s7-pachinko", "placed:stash:kanal-alley"],
        loot: { containers: [bag("loot:guard", 0, 33), bag("stash:s7-pachinko", -9, 12), bag("drop:1", 4, 4)], dropSeq: 2 },
        heat: { level: 2, faction: "hebi", searching: true, lastKnown: { x: 3, y: 0, z: 30 }, searchLeft: 12, cooldown: 0 },
        metro: { ride: { from: "kanal", to: "doki", arriveTick: 960 } },
      },
    };
  };

  it("wakes the player on the clinic's chair with her things, and forgets where everyone else stood", () => {
    const loaded = decodeSave("v14", wrap(v14Payload()));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.entities).toEqual([{ key: "player", position: CLINIC_CHAIR, yaw: Math.PI / 2, pitch: 0, hp: 77, cooldown: 0, alerted: false }]);
    expect(loaded.streaming).toEqual({ loadedChunks: [] });
    expect(loaded.doors).toEqual([]);
    // What she carries, her standing and the story stay as they were.
    const before = snapshot().domain;
    expect(loaded.domain.inventory).toEqual(before.inventory);
    expect(loaded.domain.wallet).toEqual(before.wallet);
    expect(loaded.domain.quests).toEqual(before.quests);
    expect(loaded.narrative).toBe(snapshot().narrative);
    // The dead stay dead; the ride arrives at the new station.
    expect(loaded.domain.flags).toContain("dead:courier");
    expect(loaded.domain.metro).toEqual({ ride: { from: "kanal", to: "doki", arriveTick: 960 } });
    expect(loaded.domain.heat).toEqual({ level: 0, faction: null, searching: false, lastKnown: null, searchLeft: 0, cooldown: 0 });
  });

  it("puts the bags down in the clinic and places a stash that was not emptied again, full", () => {
    const loaded = decodeSave("v14", wrap(v14Payload()));
    const containers = loaded.domain.loot.containers;
    expect(containers.map((c) => c.key)).toEqual(["loot:guard", "drop:1"]);
    for (const c of containers) {
      expect(c.chunk).toBe("krakowskie-2-0");
      // On the clinic's floor, a step from the chair.
      expect(Math.hypot(c.position.x - CLINIC_CHAIR.x, c.position.z - CLINIC_CHAIR.z)).toBeLessThan(4);
      expect(c.lines).toEqual([{ kind: "eddies", qty: 40 }]);
    }
    expect(containers[0]!.position).not.toEqual(containers[1]!.position);
    // The stash still lying in the old street goes back to the new content's spot; the one
    // already emptied (its container gone) stays emptied.
    expect(loaded.domain.flags).not.toContain("placed:stash:s7-pachinko");
    expect(loaded.domain.flags).toContain("placed:stash:kanal-alley");
  });

  it("tolerates a save without entities, a domain or loot", () => {
    expect(MIGRATIONS[14]!({ version: 14 })).toEqual({
      version: 15,
      entities: [],
      streaming: { loadedChunks: [] },
      doors: [],
      domain: { flags: [], loot: { containers: [], dropSeq: 0 }, heat: { level: 0, faction: null, searching: false, lastKnown: null, searchLeft: 0, cooldown: 0 } },
    });
  });
});
