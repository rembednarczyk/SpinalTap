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
  // The street graph's districts of E4 (the curator's review of 27.11, `docs/plany/e4-przeglad/raport-kuratora.md` P1, the
  // orthophoto PZGiK 2025-04 in sections centred on OSM's axis, the offset their median):
  // Kowalska east, two-way, setts: the kerb 3.0–3.6 m left of the way, the parking lane's dashed line 3.6–4.2 m right of it;
  // BDOT10k 3.6 m (one lane) laid half the carriageway as a sidewalk, its posts on the road.
  ["w438384687", { width: 6.6, offset: -0.3, reason: "Kowalska east of the Brama Grodzka steps: two lanes between the kerb and the parking lane's line (T-362)" }],
  // Ciasna: 5 m between the wall and the kiosk at Lubartowska, the car park's aisle 7 m between the rows; BDOT10k 3 m on another line.
  ["w227679341", { width: 6, offset: 0, reason: "Ciasna: the mouth between the walls and the car park's aisle (T-363)" }],
  // Lubartowska by Probostwo: kerbs −5.2…+5.4 m round a double line on the axis; BDOT10k 8.7 m sat 1 m right of it.
  ["w215632413", { width: 10.6, offset: -0.1, reason: "Lubartowska by Probostwo: kerb to kerb (T-364)" }],
  // Aleja Unii Lubelskiej south of Rondo Dmowskiego: four lanes (OSM lanes=4, merge_to_left) −5.7…+8.7 m; BDOT10k 10.7 m is three.
  ["w60610301", { width: 14.4, offset: -1.5, reason: "Aleja Unii Lubelskiej: four lanes kerb to kerb (T-365)" }],
  // Turystyczna (w210273909): two lanes −3.9…+5.0 m; BDOT10k 7.1 m laid 2.4 m of the right lane as a sidewalk.
  ["w210273909", { width: 8.8, offset: -0.6, reason: "Turystyczna by the river: two lanes kerb to kerb (T-366)" }],
  // Turystyczna (w90972510): three lanes, the asphalt −5.1…+7.3 m; BDOT10k 11 m is the left edge line to the right kerb.
  ["w90972510", { width: 12.4, offset: -1.1, reason: "Turystyczna to Rondo Cybulskiego: three lanes kerb to kerb (T-367)" }],
  // Rondo Cybulskiego: four lanes −8.2…+7.2 m, as the orthophoto's both sides (8.45/7.25); BDOT10k 14 m left the left lane bare.
  ["w215632448", { width: 15.5, offset: 0.5, reason: "Rondo Cybulskiego: four lanes kerb to kerb (T-368)" }],
  // Andersa's link to Mełgiewska: asphalt −4.0…+2.0 m at the zebra and above it; BDOT10k 7.5 m (its class) laid the lanes on the verge.
  ["w40051729", { width: 6, offset: -0.2, reason: "Andersa's link to Mełgiewska: the link's asphalt (T-369)" }],
  // Cerkiewna's northern branch: 9.8 m at z 355, 11.2 m in the mouth at the zebra (z 348); BDOT10k 8 m.
  ["w739432830", { width: 9.8, offset: -0.2, reason: "Cerkiewna's northern branch: kerb to kerb (T-370)" }],
]);
