import type { MicroEventKind } from "@seki/core";
import { translate } from "@seki/ui";
import type { Presenter } from "./context";

/*
 * A street crime over (ADR-0091 stage 6): a toast says how it ended, foiled or failed. Every micro-event is a crime
 * of the board since stage 5b, its run id `micro:<kind>:<tick>`. The pay comes with its own money
 * toast (`EddiesChanged`).
 */

/** A crime walked away from stays on the board, to come back to: no toast for it. */
const OUTCOMES = { won: "crime.end.foiled", helped: "crime.end.foiled", failed: "crime.end.failed" } as const;
const KINDS: readonly MicroEventKind[] = ["mugging", "aid", "extortion", "deal", "droneTheft", "kidnap"];

/** The crime's kind from its run id, or null for an encounter that is not one. */
export const crimeKindOf = (encounterId: string): MicroEventKind | null => {
  const [head, kind] = encounterId.split(":");
  return head === "micro" ? (KINDS.find((k) => k === kind) ?? null) : null;
};

export const presentStreetCrimes: Presenter = (ctx) => [
  ctx.bus.on("EncounterEnded", (e) => {
    const kind = crimeKindOf(e.encounterId);
    const key = e.outcome in OUTCOMES ? OUTCOMES[e.outcome as keyof typeof OUTCOMES] : null;
    if (!kind || !key) return;
    const locale = ctx.ui.getState().settings.locale;
    ctx.toast("system", translate(locale, key), translate(locale, `crime.kind.${kind}`));
  }),
];
