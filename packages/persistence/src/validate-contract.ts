import { SABOTAGE_LOUD, isContractKind, isContractSiteId, isW3Station } from "@seki/core";
import { findVariationError } from "./validate-wave2";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** A contract of the log, running or cleared, or one ended with its people still about (G-178). */
export const findContractError = (c: unknown): string | null => {
  if (!isObject(c) || typeof c.id !== "string" || typeof c.siteId !== "string" || !isContractSiteId(c.siteId)) return "contracts";
  if (!Number.isInteger(c.targets) || !Number.isInteger(c.reward) || (c.status !== "active" && c.status !== "cleared")) return "contracts";
  // M4 fields are optional, so v6 saves from before them stay valid as they are.
  if (c.kind !== undefined && (typeof c.kind !== "string" || !isContractKind(c.kind))) return "contract kind";
  if (c.deadlineTick !== undefined && (!Number.isInteger(c.deadlineTick) || (c.deadlineTick as number) < 0)) return "contract deadline";
  // A hack's clock (ADR-0024): ticks connected and ticks away, both whole and not negative.
  for (const field of ["progress", "away"] as const) {
    const n = c[field];
    if (n !== undefined && (!Number.isInteger(n) || (n as number) < 0)) return "contract progress";
  }
  if (c.breach !== undefined && (!Array.isArray(c.breach) || !c.breach.every((x) => typeof x === "string"))) return "contract breach";
  // The sabotage's way and its way out seen (ADR-0082 stage 3, v40).
  if (c.route !== undefined && c.route !== "quiet" && c.route !== "loud") return "contract route";
  if (c.seenLeaving !== undefined && c.seenLeaving !== true) return "contract seen leaving";
  return findLoudError(c) ?? findVariationError(c);
};

const tick = (n: unknown): boolean => Number.isInteger(n) && (n as number) >= 0;

/** The loud way's fields (ADR-0082 stage 3b, v41): its charges on distinct stations, at most three; the planting, fuse, blast and alarm. */
const findLoudError = (c: Json): string | null => {
  const charges = c.charges;
  if (charges !== undefined && (!Array.isArray(charges) || charges.length > SABOTAGE_LOUD.charges || !charges.every(isW3Station) || new Set(charges).size !== charges.length)) return "contract charges";
  const p = c.planting;
  if (p !== undefined && (!isObject(p) || !isW3Station(p.station) || !tick(p.ticks) || typeof p.hp !== "number" || !Number.isFinite(p.hp) || p.hp < 0)) return "contract planting";
  if ((c.fuseTick !== undefined && !tick(c.fuseTick)) || (c.alarmTick !== undefined && !tick(c.alarmTick))) return "contract fuse";
  if (c.detonated !== undefined && c.detonated !== true) return "contract detonated";
  return null;
};

/** A contract with the count of jobs done when its targets were made (G-178). */
export const findContractOnSiteError = (v: unknown): string | null => {
  if (!isObject(v) || !Number.isInteger(v.completed) || (v.completed as number) < 0) return "contracts";
  return findContractError(v.contract);
};

/**
 * Jobs replaced with some of their people still about (G-178): whole contracts with the jobs done
 * when they were taken, none twice and none the one in the log or the ended one.
 */
export const findFormerContractsError = (v: unknown, taken: readonly unknown[]): string | null => {
  if (!Array.isArray(v)) return "contracts";
  const ids = new Set(taken.flatMap((c) => (isObject(c) && typeof c.id === "string" ? [c.id] : [])));
  for (const f of v) {
    const error = findContractOnSiteError(f);
    if (error) return error;
    const id = ((f as Json).contract as Json).id as string;
    if (ids.has(id)) return "contracts";
    ids.add(id);
  }
  return null;
};
