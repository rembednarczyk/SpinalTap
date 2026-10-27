import { SAVE_SCHEMA_VERSION, createDomainState, type SaveSnapshot } from "@seki/core";

export const snapshot = (overrides: Partial<SaveSnapshot> = {}): SaveSnapshot => ({
  version: SAVE_SCHEMA_VERSION,
  seed: 42,
  rngState: 123456,
  tick: 900,
  entities: [
    { key: "player", position: { x: 1, y: 0, z: -3.5 }, yaw: 0.4, pitch: -0.1, hp: 77, cooldown: 0, alerted: false },
    { key: "guard", position: { x: -2, y: 0, z: 40 }, yaw: 3.1, pitch: 0, hp: 80, cooldown: 0.2, alerted: true },
  ],
  streaming: { loadedChunks: ["shinsekai-7", "kanal"] },
  domain: { ...createDomainState(), flags: ["met_fixer"], preferences: { cameraMode: "TPP" } },
  narrative: '{"inkSaveVersion":10}',
  meta: { label: "26.10 22:30", objective: "Zneutralizuj kuriera" },
  ...overrides,
});

/** What v6 (world streaming) wrote: a medkit counter, no day clock, no equipment. */
export const v6Payload = (medkits = 3) => {
  const s = snapshot();
  const { equipment: _e, ammo: _a, loot: _l, clock: _c, ...domain } = s.domain;
  return { ...s, version: 6, domain: { ...domain, inventory: { medkit: medkits } } };
};

/** What v7 (day clock, ADR-0017) wrote: the clock, still the medkit counter. */
export const v7Payload = (medkits = 3) => {
  const s = snapshot();
  const { equipment: _e, ammo: _a, loot: _l, ...domain } = s.domain;
  return { ...s, version: 7, domain: { ...domain, inventory: { medkit: medkits } } };
};

/** What the v1 prototype wrote: "credits", no camera preference, no rngState, no alert flags. */
export const v1Payload = () => {
  const s = snapshot();
  const { preferences: _p, wallet: _w, ...domain } = s.domain;
  return {
    version: 1,
    seed: 42,
    tick: 10,
    entities: s.entities.map(({ alerted: _a, ...e }) => e),
    domain: { ...domain, wallet: { credits: 250 } },
    narrative: null,
    meta: s.meta,
  };
};
