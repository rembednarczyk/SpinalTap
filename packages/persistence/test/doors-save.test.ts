import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

describe("automatic doors and the interiors (v13 to v14, ADR-0038)", () => {
  /** What v13 wrote: no doors, Kaito and Mori remembered at their old spots on the street. */
  const v13Payload = () => {
    const { doors: _d, ...s } = snapshot();
    const street = (key: string, x: number, z: number) => ({ key, position: { x, y: 0, z }, yaw: 0, pitch: 0, hp: null, cooldown: 0, alerted: false });
    return { ...s, version: 13, entities: [...s.entities, street("fixer", 6.2, 1.5), street("mori", -6.2, 2.4)] };
  };

  it("shuts every door and lets Kaito and Mori stand where the content puts them now", () => {
    const loaded = decodeSave("v13", wrap(v13Payload()));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.doors).toEqual([]);
    expect(loaded.entities.map((e) => e.key)).toEqual(["player", "guard"]);
  });

  it("tolerates a save without entities and keeps doors already there", () => {
    expect(MIGRATIONS[13]!({ version: 13 })).toEqual({ version: 14, entities: [], doors: [] });
    const doors = [{ key: "door:klinika#0", open: 0.5, idle: 0 }];
    expect(MIGRATIONS[13]!({ version: 13, doors })).toMatchObject({ doors });
  });

  it("round-trips a door in motion and rejects a malformed one", () => {
    const s = snapshot({ doors: [{ key: "door:neon-koi#1", open: 0.25, idle: 0.4 }] });
    expect(decodeSave("d", encodeSave(s)).doors).toEqual(s.doors);
    const bad = (doors: unknown) => findSchemaError({ ...s, doors } as unknown as Record<string, unknown>);
    expect(bad(undefined)).toBe("doors");
    expect(bad([{ key: "door:klinika#0", open: "half", idle: 0 }])).toBe("doors");
    expect(bad([{ open: 1, idle: 0 }])).toBe("doors");
  });
});
