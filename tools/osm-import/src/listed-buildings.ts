/**
 * Listed buildings of Lublin the map does not tag `heritage` or `historic` (ADR-0058 stage 6): the
 * decals' rules take them as protected like a tagged one, so no graffiti goes on them. By the map's
 * element of the outline (`w…`, `r…`) and why it is here. Add a building with the review that found it.
 */
export const LISTED_BUILDINGS: ReadonlyMap<string, string> = new Map([
  // Hotel Lublinianka, Krakowskie Przedmieście 56: the Towarzystwo Kredytowe's building of 1900
  // (topography curator's review of PR #186, docs/topografia.md T-124).
  ["r1071051", "Hotel Lublinianka (Towarzystwo Kredytowe, 1900), T-124"],
]);
