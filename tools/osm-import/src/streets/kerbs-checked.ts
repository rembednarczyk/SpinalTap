/**
 * Ways whose carriageway a checked conflict of the data measures instead of BDOT10k (the user's
 * decision of 27.11: the order OSM → BDOT10k → the orthophoto stays, a conflict checked on the ground
 * is an exception of its own, with a T row in `docs/topografia.md`): its width and how far left of
 * the way's line it lies (m), as `bdotMatch` gives them. The street graph reads the width for the
 * part of a way it lays (`sourcedWidth`), the offset where BDOT10k measures the way (`bdotWays`: its
 * middle in a district on the graph).
 */
export const KERBS_CHECKED: ReadonlyMap<string, { readonly width: number; readonly offset: number; readonly reason: string }> = new Map([
  // OSM's bollard lines along both kerbs, w1514057822 4.48 m left of the way and w1514057823 3.95 m right of it, the
  // posts 0.3 m behind the kerb: 4.2 m and 3.7 m. BDOT10k one line of 9 m (its class's width, droga zbiorcza) over
  // the left line, the orthophoto 7.5 m (3.25 m and 4.25 m) over the right one (T-360).
  ["w40050981", { width: 7.9, offset: 0.25, reason: "Lubartowska, Bajkowskiego to Plac Łokietka: the kerbs by OSM's bollard lines (T-360)" }],
  // Królewska from Plac Łokietka south-east, the same BDOT10k class width of 9 m: the graph laid its first metres in
  // Krakowskie 4.5 m a side, over OSM's bollard lines w1514057825 (4.13-4.32 m left of the way) and w1514057828
  // (3.95-4.09 m); 3.95 m a side by them. Its middle lies in Stare Miasto, laid the old way: no offset read (T-360).
  ["w40052496", { width: 7.9, offset: 0, reason: "Królewska by Plac Łokietka: the kerbs by OSM's bollard lines (T-360)" }],
]);
