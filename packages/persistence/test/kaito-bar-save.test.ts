import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave } from "../src";
import { snapshot } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

/** Kaito as v15 remembered him: by the chair in the clinic, before the first conversation. */
const clinicKaito = { key: "fixer", position: { x: 320.2, y: -0.5, z: -66.16 }, yaw: 0, pitch: 0, hp: null, cooldown: 0, alerted: false };

describe("Kaito at the bar from the start (v15 to v16, G-034)", () => {
  it("forgets Kaito's spot in the clinic of a save from before the first conversation", () => {
    const s = snapshot();
    const domain = { ...s.domain, flags: [] };
    const loaded = decodeSave("v15", wrap({ ...s, version: 15, domain, entities: [...s.entities, clinicKaito] }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.entities.map((e) => e.key)).not.toContain("fixer");
    expect(loaded.entities).toEqual(s.entities);
  });

  it("keeps Kaito once they have met: he is at the bar already", () => {
    const s = snapshot();
    const atBar = { ...clinicKaito, position: { x: 317, y: -0.38, z: -99.79 } };
    const domain = { ...s.domain, flags: ["met_fixer"] };
    const migrated = MIGRATIONS[15]!({ ...s, version: 15, domain, entities: [...s.entities, atBar] });
    expect(migrated).toMatchObject({ version: 16, entities: [...s.entities, atBar] });
  });

  it("tolerates a save without entities or flags", () => {
    expect(MIGRATIONS[15]!({ version: 15 })).toEqual({ version: 16, entities: [] });
  });
});
