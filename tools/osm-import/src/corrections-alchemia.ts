/**
 * The map's ways the game's set pieces replace (ADR-0042, ADR-0074 stage 7): an OSM element that
 * stands where a building or a square of 2077 is, dropped from the import with its row in
 * `docs/topografia.md`. The raw data in `data/osm` stays as downloaded; the glitch scan's
 * `cut-on-road` reads this list to tell a street the game replaced on purpose from one it cut by
 * mistake. Kept apart so `corrections.ts` stays within ADR-0031's 500 lines.
 */
import type { AddedArea } from "./corrections.ts";
import type { Area, Line } from "./features.ts";

export interface ReplacedWay {
  /** `w<id>`, as `Area.id` or `Line.id`. */
  readonly id: string;
  /** What of the game stands there instead. */
  readonly by: string;
  readonly reason: string;
  /** The entry of `docs/topografia.md` it answers. */
  readonly ref: string;
}

export const REPLACED_WAYS: readonly ReplacedWay[] = [];

const REPLACED_IDS: ReadonlySet<string> = new Set(REPLACED_WAYS.map((w) => w.id));

/** Whether the import leaves the element out: the game's set piece stands in its place. */
export const isReplaced = (id: string, replaced: ReadonlySet<string> = REPLACED_IDS): boolean => replaced.has(id);

/** The map's features without the replaced ways, before the corrections read them. */
export const withoutReplaced = <T extends { readonly areas: readonly Area[]; readonly lines: readonly Line[] }>(f: T, replaced: ReadonlySet<string> = REPLACED_IDS): { areas: Area[]; lines: Line[] } => ({
  areas: f.areas.filter((a) => !isReplaced(a.id, replaced)),
  lines: f.lines.filter((l) => !isReplaced(l.id, replaced)),
});

/** The areas the game lays where the replaced ways were (drawn after `ADDED_AREAS`' others). */
export const ALCHEMIA_AREAS: readonly AddedArea[] = [];
