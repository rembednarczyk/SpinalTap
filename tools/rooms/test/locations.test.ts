import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRACT_SITE_IDS } from "../../../packages/core/src/contracts/contracts";
import { CITY_DISTRICT_IDS, TERRITORY_IDS } from "../../../packages/core/src/world/territories";
import { ENCOUNTERS } from "../../../packages/sim/src/content/encounters";
import { INTERIORS } from "../../../packages/sim/src/content/interior-areas";
import { LUBLIN_CONSTRUCTION_SITES } from "../../../packages/sim/src/content/lublin/construction.generated";
import { METRO_ENTRANCES } from "../../../packages/sim/src/content/metro";
import { WORLD_STASHES } from "../../../packages/sim/src/content/world-map";
import { INTERIOR_CONTRACTS, INTERIOR_STASHES, LOCATIONS, type LocationRefs, STORY_INTERIORS } from "../src/locations";

/*
 * The rule of location cards (ADR-0102, the user's order of 23.11): every location of the game has its story and
 * its audit against the rules of `docs/zasady-lokacji.md`, a story location has a detailed scenario, and the scenes
 * are reworked by them. Every place the game's own lists name (contract sites, territories, districts, metro
 * entrances, building sites, encounters, stashes) belongs to a location or to an interior with a room card.
 * The cards are written in batches: `locations-pending.json` lists the ones still to write and only shrinks
 * (a card that is complete while still listed is a red test too; `LOCATIONS_PENDING=update` rewrites the list).
 * A background location (not `story`) has a short scenario instead (`## Scenariusz tła`, three lines).
 */

const LOCATION_CARDS = new URL("../../../docs/lokacje/", import.meta.url);
const ROOM_CARDS = new URL("../../../docs/pomieszczenia/", import.meta.url);
const PENDING_FILE = new URL("./locations-pending.json", import.meta.url);
const UPDATE = process.env.LOCATIONS_PENDING === "update";

const SECTIONS = ["## Historia", "## Klimat", "## Przeznaczenie", "## Topografia", "## Inwentarz docelowy", "## Frakcja i zasady", "## Dług sceny"] as const;
/** The scenario of a story location or interior: what the player sees first, who stands where, the beats, the ways in and out, the times and states, and what the scene must have. */
const SCENARIO = ["## Scenariusz", "### Pierwszy kadr", "### Postacie i miejsca", "### Przebieg", "### Drogi", "### Pora i stan świata", "### Wymagania wobec sceny"] as const;
/** The short scenario of a background location (the user's decision of 23.11): who comes here, what goes on, the trace they leave. */
const BACKGROUND = ["## Scenariusz tła"] as const;
const BACKGROUND_LINES = ["- Kto tu bywa:", "- Co się dzieje:", "- Ślad obecności:"] as const;
const FACTION = /^Frakcja: (ulica|technika|korporacja)\b/m;
const RULES = ["§12", "§13", "§14", "§15", "§16", "§17"] as const;

interface Pending {
  readonly locations: readonly string[];
  readonly interiors: readonly string[];
}
const pending: Pending = JSON.parse(readFileSync(PENDING_FILE, "utf8")) as Pending;

/** What a card misses, empty when it is complete. */
const missing = (file: URL, parts: readonly string[], encounters: readonly string[] = []): string[] => {
  if (!existsSync(file)) return ["(brak pliku)"];
  const text = readFileSync(file, "utf8");
  const out = parts.filter((s) => !new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(text));
  if (parts.includes("## Frakcja i zasady")) {
    if (!FACTION.test(text)) out.push("Frakcja: ulica|technika|korporacja");
    for (const r of RULES) if (!new RegExp(`^- ${r} `, "m").test(text)) out.push(`- ${r} w audycie`);
  }
  if (parts.includes(BACKGROUND[0])) for (const l of BACKGROUND_LINES) if (!text.split("\n").some((line) => line.startsWith(`${l} `))) out.push(l);
  if (encounters.length > 0) {
    if (!/^## Spotkania\s*$/m.test(text)) out.push("## Spotkania");
    for (const e of encounters) if (!text.includes(`\`${e}\``)) out.push(`spotkanie \`${e}\``);
  }
  return out;
};

const locationGaps = new Map(LOCATIONS.map((l) => [l.id, missing(new URL(`${l.id}.md`, LOCATION_CARDS), l.story ? [...SECTIONS, ...SCENARIO] : [...SECTIONS, ...BACKGROUND], l.refs?.encounters)]));
const interiorGaps = new Map(STORY_INTERIORS.map((id) => [id, missing(new URL(`${id}.md`, ROOM_CARDS), SCENARIO)]));

const covered = (key: keyof LocationRefs): Set<string> => new Set(LOCATIONS.flatMap((l) => l.refs?.[key] ?? []));

describe("the location registry (ADR-0102)", () => {
  it("names every location once", () => {
    const ids = LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of STORY_INTERIORS) expect(INTERIORS.some((i) => i.id === id), `interior ${id}`).toBe(true);
  });

  it("gives every place of the game's own lists a location or a room card", () => {
    const contracts = covered("contracts");
    for (const id of CONTRACT_SITE_IDS) expect(contracts.has(id) || id in INTERIOR_CONTRACTS, `contract site ${id}`).toBe(true);
    for (const [id, room] of Object.entries(INTERIOR_CONTRACTS)) expect(INTERIORS.some((i) => i.id === room), `${id} → ${room}`).toBe(true);
    const lists: [keyof LocationRefs, readonly string[]][] = [
      ["territories", TERRITORY_IDS],
      ["districts", CITY_DISTRICT_IDS],
      ["metro", METRO_ENTRANCES.map((e) => `${e.station}-${e.label}`)],
      ["construction", LUBLIN_CONSTRUCTION_SITES.map((s) => s.id)],
      ["encounters", ENCOUNTERS.map((e) => e.id)],
      ["stashes", WORLD_STASHES.map((s) => s.key).filter((k) => !(k in INTERIOR_STASHES))],
    ];
    for (const [key, ids] of lists) {
      const have = covered(key);
      for (const id of ids) expect(have.has(id), `${key}: ${id}`).toBe(true);
      // And no location names one the game does not have.
      for (const id of have) expect(ids.includes(id), `${key}: ${id} is not in the game`).toBe(true);
    }
  });
});

describe("the location cards (ADR-0102)", () => {
  it("keeps the list of cards still to write shrinking", () => {
    const want: Pending = {
      locations: LOCATIONS.filter((l) => (locationGaps.get(l.id) ?? []).length > 0).map((l) => l.id),
      interiors: STORY_INTERIORS.filter((id) => (interiorGaps.get(id) ?? []).length > 0),
    };
    if (UPDATE) {
      // Only ever shrinks: an id that was not pending and now has gaps stays a red test below.
      const shrunk = { locations: want.locations.filter((id) => pending.locations.includes(id)), interiors: want.interiors.filter((id) => pending.interiors.includes(id)) };
      writeFileSync(PENDING_FILE, `${JSON.stringify(shrunk, null, 2)}\n`);
      return;
    }
    for (const id of pending.locations) expect(want.locations.includes(id), `docs/lokacje/${id}.md is complete: run LOCATIONS_PENDING=update`).toBe(true);
    for (const id of pending.interiors) expect(want.interiors.includes(id), `docs/pomieszczenia/${id}.md has its scenario: run LOCATIONS_PENDING=update`).toBe(true);
  });

  for (const l of LOCATIONS) {
    it(`has the card of ${l.id}${l.story ? " with its scenario" : " with its background scenario"}`, () => {
      if (pending.locations.includes(l.id)) return;
      expect(locationGaps.get(l.id), `docs/lokacje/${l.id}.md`).toEqual([]);
    });
  }

  for (const id of STORY_INTERIORS) {
    it(`has the scenario of the story interior ${id}`, () => {
      if (pending.interiors.includes(id)) return;
      expect(interiorGaps.get(id), `docs/pomieszczenia/${id}.md`).toEqual([]);
    });
  }
});
