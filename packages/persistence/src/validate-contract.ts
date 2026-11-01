import { isContractKind, isContractSiteId } from "@seki/core";
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
  return findVariationError(c);
};

/** A contract with the count of jobs done when its targets were made (G-178). */
export const findContractOnSiteError = (v: unknown): string | null => {
  if (!isObject(v) || !Number.isInteger(v.completed) || (v.completed as number) < 0) return "contracts";
  return findContractError(v.contract);
};

/** Jobs replaced with some of their people still about (G-178): whole contracts with the jobs done when taken. */
export const findFormerContractsError = (v: unknown): string | null => {
  if (!Array.isArray(v)) return "contracts";
  for (const f of v) {
    const error = findContractOnSiteError(f);
    if (error) return error;
  }
  return null;
};
