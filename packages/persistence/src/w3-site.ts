type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * v38 -> v39 (ADR-0082 stage 1): the docks on the Bystrzyca rebuilt as Tessen's sector W-3. The
 * container yard, the warehouse, the office, the crane, the pier and the barge are gone; the hall,
 * the tower, the quay and the basin stand on new ground, and the public strip by the metro is back
 * on the terrain it had. Spelled out, the content of its time:
 * - a player saved anywhere on that ground (on the ground, the warehouse's roof, the crane, the
 *   pier) wakes on the public strip by the metro's entrance A, facing north to the fence;
 * - the people saved there (the docks' posts, the escort's Mika, the snipers, Genzō, the docker)
 *   are dropped: they come back from the content at their new places (a sniper's perch index is
 *   of the old perches);
 * - the bodies and the bags left there, hidden in the old container or the skip too, lie on the
 *   public strip where the player wakes;
 * - a running escort (retired with the docks' container yard) is called off without a penalty,
 *   and `w3:escort-retired` tells Genzō's lines so; an infiltration or a hack stays, at its new site.
 */

/** A rectangle of world metres (ADR-0045). */
interface Area {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * The ground the change took: the old docks (x 2520..2594, z 390..518 with the barge) and W-3's
 * zone, quay and pier, with the public strip whose terrain came back up to 1.6 m (z 380..392).
 */
export const W3_REBUILT: Area = { minX: 2462, maxX: 2606, minZ: 380, maxZ: 520 };

/** Where a save made there wakes: on the public strip by the metro's entrance A, a few centimetres over it, facing north. */
export const W3_WAKE = { x: 2527, y: -26.8, z: 384, chunk: "nabrzeze-1-1", yaw: 0 } as const;

/** The docks' people kept by key in a save: they come back from the content at their new places. */
const W3_MOVED: readonly string[] = ["genzo", "doker"];

/** The flag Genzō's lines read after the escort was called off. */
export const ESCORT_RETIRED_FLAG = "w3:escort-retired";

const inRebuilt = (p: unknown): boolean =>
  isObject(p) && typeof p.x === "number" && typeof p.z === "number" && p.x >= W3_REBUILT.minX && p.x <= W3_REBUILT.maxX && p.z >= W3_REBUILT.minZ && p.z <= W3_REBUILT.maxZ;

const WAKE_AT = { x: W3_WAKE.x, y: W3_WAKE.y, z: W3_WAKE.z };

/** Someone lying on the rebuilt ground (a body left there, hidden or not): on the strip where the player wakes, out of the hiding place. */
const laidOnStrip = (e: Json): Json => {
  const downed = isObject(e.downed) ? { downed: { ...e.downed, hidden: false } } : {};
  return { ...e, position: WAKE_AT, ...downed };
};

/** The player woken on the strip, the bodies laid there, the docks' people and snipers dropped. */
const w3Entities = (entities: readonly unknown[]): unknown[] =>
  entities.flatMap((e) => {
    if (!isObject(e)) return [e];
    if (e.key === "player") return [inRebuilt(e.position) ? { ...e, position: WAKE_AT, yaw: W3_WAKE.yaw, pitch: 0 } : e];
    if (typeof e.key === "string" && (W3_MOVED.includes(e.key) || e.key.endsWith("-escort"))) return [];
    if (!inRebuilt(e.position)) return [e];
    // A body on the player's shoulder goes where she goes; one left lying there goes onto the strip.
    if (isObject(e.downed)) return [e.downed.carried === true ? { ...e, position: WAKE_AT } : laidOnStrip(e)];
    return [];
  });

/** Bags left on the rebuilt ground put down where the player wakes. */
const w3Loot = (loot: unknown): unknown => {
  if (!isObject(loot) || !Array.isArray(loot.containers)) return loot;
  const containers = loot.containers.map((c: unknown) => (isObject(c) && inRebuilt(c.position) ? { ...c, position: WAKE_AT, chunk: W3_WAKE.chunk } : c));
  return { ...loot, containers };
};

/** A running escort called off without a penalty; Genzō's lines learn it from the flag. */
const retireEscort = (domain: Json): Json => {
  const log = isObject(domain.contracts) ? domain.contracts : null;
  const active = log && isObject(log.active) ? log.active : null;
  if (!log || !active || active.kind !== "escort") return domain;
  const flags = Array.isArray(domain.flags) ? domain.flags : [];
  const { tally: _tally, hooks: _hooks, ...rest } = log;
  return { ...domain, contracts: { ...rest, active: null }, flags: flags.includes(ESCORT_RETIRED_FLAG) ? flags : [...flags, ESCORT_RETIRED_FLAG] };
};

/** Somebody kept outside the content (reinforcements, a mugging's bodies) on the rebuilt ground: gone. */
const keptOffRebuilt = (list: unknown): unknown => (Array.isArray(list) ? list.filter((p: unknown) => !(isObject(p) && isObject(p.state) && inRebuilt(p.state.position))) : list);

/** An escort's people still about after it ended, or replaced by a newer job: gone with it. */
const offEscort = (on: unknown): boolean => isObject(on) && isObject(on.contract) && on.contract.kind === "escort";

export const rebuildDocksAsW3 = (old: Json): Json => {
  const out: Json = { ...old, version: 39 };
  if (Array.isArray(old.entities)) out.entities = w3Entities(old.entities);
  if (isObject(old.domain)) out.domain = retireEscort({ ...old.domain, loot: w3Loot(old.domain.loot) });
  if (isObject(old.reinforcements)) out.reinforcements = { ...old.reinforcements, people: keptOffRebuilt(old.reinforcements.people) };
  if (Array.isArray(old.strayBodies)) out.strayBodies = keptOffRebuilt(old.strayBodies);
  if (offEscort(old.endedContract)) delete out.endedContract;
  if (Array.isArray(old.formerContracts)) out.formerContracts = old.formerContracts.filter((c: unknown) => !offEscort(c));
  return out;
};
