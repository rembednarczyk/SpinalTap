/**
 * The landmarks of Lublin by map id (a split piece goes by its whole's id): the curator's audits
 * (`docs/topografia.md`) and the parts of the renderer's recipes (`landmarks/recipes.ts`, Brama
 * Krakowska and Brama Grodzka). One list for the import, which keeps their silhouettes as
 * reviewed (`lod1-heights.ts`), and for the glitch scan's landmark checks.
 */
export const LANDMARK_BUILDINGS: readonly string[] = [
  ...["r7224409", "w66286371", "w66286341", "w66264159", "w66264120", "w232362876", "w66286338", "r2366732"],
  ...["w48500136", "w450180469", "w66258167", "w67508958", "w66330578", "w617597407", "w617878341"],
];

const LISTED: ReadonlySet<string> = new Set(LANDMARK_BUILDINGS);

/** Whether a building (`w…`, `r…`, a split's `/n` dropped) is on the list. */
export const isListedLandmark = (id: string): boolean => LISTED.has(id.split("/")[0]!);
