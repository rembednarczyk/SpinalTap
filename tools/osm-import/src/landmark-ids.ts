/**
 * The landmarks of Lublin by map id (a split piece goes by its whole's id): the curator's audits
 * (`docs/topografia.md`) and the parts of the renderer's recipes (`landmarks/recipes.ts`, Brama
 * Krakowska, Brama Grodzka and Nowy Ratusz). One list for the import, which keeps their silhouettes as
 * reviewed (`lod1-heights.ts`), and for the glitch scan's landmark checks.
 */
export const LANDMARK_BUILDINGS: readonly string[] = [
  ...["r7224409", "w66286371", "w66286341", "w66264159", "w66264120", "w232362876", "w66286338", "r2366732"],
  ...["w48500136", "w450180469", "w66258167", "w67508958", "w66330578", "w617597407", "w617878341"],
  // Nowy Ratusz's risalit block and tower (G-119).
  ...["w619138853", "w619138854"],
  // The Archikatedra's nave and turrets and the parts the import adds from NMPT (T-349).
  ...["w617763433", "w617763434", "w617763435"],
  ...["T-349/katedra-korpus", "T-349/katedra-pod-nawa", "T-349/katedra-prezbiterium-pn", "T-349/katedra-prezbiterium-pd", "T-349/katedra-fronton"],
];

const LISTED: ReadonlySet<string> = new Set(LANDMARK_BUILDINGS);

/** Whether a building (`w…`, `r…`, a split's `/n` dropped) is on the list. */
export const isListedLandmark = (id: string): boolean => LISTED.has(id) || LISTED.has(id.split("/")[0]!);
