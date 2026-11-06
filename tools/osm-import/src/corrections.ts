/**
 * Explicit corrections of OSM tags and outlines (ADR-0042): a value the map has only as an
 * estimate, which a measurement or the topography curator's review (`docs/topografia.md`) puts
 * right. Each entry names the OSM element, what it replaces, why, and the register entry; the raw data in
 * `data/osm` stays as downloaded, so a new extract keeps the correction until OSM agrees.
 */
import { type Area, type Line } from "./features.ts";
import { type Pt, centroid } from "./geometry.ts";
import { type Tags } from "./osm.ts";

export interface TagCorrection {
  /** `w<id>` or `r<id>`, as `Area.id` or `Line.id`. */
  readonly id: string;
  readonly tags: Tags;
  /** The outline scaled round its centroid by this factor (a mapped outline too small against the photograph); areas only. */
  readonly scale?: number;
  readonly reason: string;
  /** The entry of `docs/topografia.md` it answers. */
  readonly ref: string;
}

/** The castle stairs' ways at 10 m, as wide as their walls stand (T-113). */
function stairs(ids: readonly string[], what: string): TagCorrection[] {
  return ids.map((id) => ({ id, tags: { width: "10" }, reason: `schody zamkowe (${what}) ok. 10 m szerokości jak murki w231832094/5 wobec domyślnych 2–3 m`, ref: "T-113" }));
}

/**
 * A church with no height in OSM stood at the default 16 m walls with a roof a third of its size,
 * 3-15 m over the surface model (T-122). NMPT GUGiK 0.5 m gives its main body's eaves and ridge
 * (world y) where the surface is a roof, not trees; towers and lower annexes are left out.
 * `height` counts from the base over the plinth to the ridge, hence ridge - y - plinth of the
 * game's data, and `roof:height` is ridge - eaves.
 */
function church(id: string, height: number, roof: number, what: string, eaves: number, ridge: number): TagCorrection {
  const y = (v: number) => String(v).replace(".", ",");
  return { id, tags: { height: String(height), "roof:height": String(roof) }, reason: `${what}: okap y ${y(eaves)} i kalenica y ${y(ridge)} z NMPT wobec domyślnych 16 m ścian`, ref: "T-122" };
}

export const TAG_CORRECTIONS: readonly TagCorrection[] = [
  {
    // Brama Krakowska's annex (przedbramie): OSM has only `building:levels=2` (`source: levels`,
    // 7.1 m over the foot with the 0.7 m slope under the gate). The photograph from Plac Łokietka,
    // scaled by the 3.6 m passage, gives about 10 m to the top of the battlements, 0.6 of the tower.
    // `height` counts from the base over the plinth, so 9.3 m here is 10.0 m over the foot.
    id: "w617597406",
    tags: { height: "9.3" },
    reason: "przedbramie Bramy Krakowskiej ok. 10 m do szczytu blanków wobec 7,1 m z building:levels=2",
    ref: "T-033",
  },
  {
    // Brama Krakowska's octagon: mapped 6.6 m across, on the photograph about 0.75-0.8 of the
    // tower's width, about 7.5 m (T-032). Its heights stay the map's.
    id: "w617878341",
    tags: {},
    scale: 1.13,
    reason: "ośmiobok Bramy Krakowskiej ok. 7,5 m średnicy wobec 6,6 m obrysu OSM",
    ref: "T-032",
  },
  {
    // The Trinity Chapel: OSM has no height, so it stood at a church's default 16 m walls with a
    // 4.4 m roof. NMPT GUGiK puts the eaves at about y 7 (13.3 m over the 1.3 m plinth) and the
    // nave's ridge at y 15.3 (a steep 8.3 m roof). `height` runs to the ridge, roof included,
    // hence 13.3 + 8.3. The lower chancel is a part of its own later (plan Z3).
    id: "w66258167",
    tags: { height: "21.6", "roof:height": "8.3" },
    reason: "Kaplica Trójcy: okap ok. y 7 i kalenica y 15,3 z NMPT wobec domyślnych 16 m ścian i 4,4 m dachu",
    ref: "T-114",
  },
  {
    // The keep: OSM `height=25` over the 1 m plinth put its flat top at y 18.6; NMPT GUGiK has
    // the crown at y 16.4..16.9. The stair house on the terrace (to about y 22) is the recipe's.
    id: "w450180469",
    tags: { height: "23.3" },
    reason: "Donżon: korona ok. y 16,4–16,9 z NMPT wobec y 18,6 z height=25",
    ref: "T-114",
  },
  {
    // St Josaphat's tower: OSM has only `man_made=tower` and `tower:type=bell_tower`, so it stood
    // at the district's default 4 storeys with its top at y 12.2. NMPT GUGiK has its top at y 9.5
    // in the outline (the 10.1 within 4 m of its middle is the nave's edge), the foot at y -1.6
    // with a 1 m plinth; `height` counts over the plinth, hence 9.5 + 1.6 - 1. Its tin pyramid is
    // low: the apex at y 9.4 over the middle, the eaves at y 8.0..8.2 along the walls (G-246), so
    // 1.4 m of roof where a roofless tower gets the import's 3 m.
    // St Nicholas's belfry w680377807 waits for a source: the surface model there is tree crowns.
    id: "w1382552285",
    tags: { height: "10.1", "roof:shape": "pyramidal", "roof:height": "1.4" },
    reason: "wieża cerkwi św. Jozafata: szczyt y 9,5 i okap ok. y 8,1 z NMPT wobec y 12,2 z domyślnych 4 kondygnacji i 3 m dachu",
    ref: "T-129",
  },
  {
    // The Brigittines' bell tower: OSM has only `man_made=tower` and `tower:type=bell_tower`, a
    // part of the church w66264082 without a height. NMPT GUGiK has the helmet's top at y 32.4 in
    // the middle of the outline over the tower's crown at y 23.2..23.5 along its walls. A part's
    // `height` counts over its church's base, the top of the church's plinth at y 0.9, hence
    // 32.4 - 0.9, of it 9.1 the helmet.
    id: "w1090997970",
    tags: { height: "31.5", "roof:height": "9.1" },
    reason: "wieża Brygidek: hełm do y 32,4 i korona y 23,2–23,5 z NMPT, w OSM bez wysokości",
    ref: "T-060",
  },
  {
    // The Lubomirski Palace: OSM has no height, so it stood at the default three storeys with a
    // flat top at y 8.5. NMPT GUGiK (roof cells off trees and towers) has the eaves at y 11.0 along
    // the walls and a roof that rises slowly inwards (11.5 at 2-3 m, 12.1 at 4-5 m, 13-14 past 6 m).
    // The game's hipped roof on this outline is level already about 1 m in from the walls, so a
    // 1 m roof (top y 12.0) fits the measured surface best over the whole outline (mean error
    // about 0 m; a 2.1 m roof stood about 1 m too high over half of it). `height` runs over the
    // 1 m plinth to that top, roof included.
    id: "w67508859",
    tags: { height: "13.1", "roof:height": "1.0", "building:levels": "3" },
    reason: "Pałac Lubomirskich: okap y 11,0 i dach do y 12,0 z NMPT wobec domyślnego płaskiego wierzchu y 8,5",
    ref: "T-136",
  },
  // Its two towers on the northern corners: `man_made=tower` with no height, so the import left
  // them in the palace's body (G-098). NMPT GUGiK has both tops flat at y 17.8..17.9; a part's
  // `height` counts over the palace's base, the top of its plinth at y -1.1. Their outlines lie
  // 2-4 m east of the surface model's: OSM's data, left as mapped.
  ...["w1002739983", "w1002739984"].map((id) => ({
    id,
    tags: { height: "19", "roof:shape": "flat" },
    reason: "wieża Pałacu Lubomirskich: płaski wierzch y 17,9 z NMPT, w OSM bez wysokości",
    ref: "T-136",
  })),
  {
    // The palace's annex on its south side: `building=yes` and `layer=1` with no height, so it stood
    // at the district's default 4 storeys with a flat top at y 11.6, over the palace's eaves (y 11.0).
    // NMPT GUGiK 0.5 m has a flat roof at y 4.6 in every cell of its strip off the palace (z 72.5-74,
    // x 49-64.5); the outline's median 5.1 takes in the palace's wall, which it overlaps (T-137).
    // `height` counts from the base over the 0.2 m plinth, hence 4.6 + 1.4 - 0.2.
    id: "w232805924",
    tags: { height: "5.8", "roof:shape": "flat", "building:levels": "2" },
    reason: "przybudówka Pałacu Lubomirskich: płaski dach y 4,6 z NMPT wobec y 11,6 z domyślnych 4 kondygnacji",
    ref: "T-137",
  },
  // St Josaphat's nave first: at the default it stood 6.3 m over its tower's top (y 9.5, T-129).
  church("w69916021", 11.6, 4.6, "cerkiew św. Jozafata", 6.8, 11.4),
  church("w66330578", 24.8, 12, "Bernardyni, nawa (wieża osobno)", 12.5, 24.5),
  church("w66264082", 21.1, 10.5, "Brygidki, nawa (wieża osobno)", 11.5, 22),
  church("w66264126", 19.5, 3.9, "Świętego Ducha, nawa (wieża osobno)", 16.5, 20.4),
  church("w232674421", 3.8, 0.6, "Niecała 4, niski budynek w podwórzu", 1.2, 1.8),
  // The Carmelites' outline is the whole cloister: its wings' eaves, the church's ridge.
  church("r5420467", 19.5, 9.5, "Karmelici, okap skrzydeł i kalenica kościoła", 5, 14.5),
  church("w66335226", 21.4, 7.2, "św. Piotra, nawa (szczyt fasady do y 20,9)", 12.5, 19.7),
  church("w66258180", 14.6, 4, "św. Mikołaja, nawa z dala od drzew", 8.5, 12.5),
  church("w66264148", 12.6, 2.7, "cerkiew Przemienienia, nawa (dzwonnica osobno)", -7, -4.3),
  {
    // The steps off the Zamkowa viaduct's north side: the way starts on a node of the viaduct
    // w232362907 (deck y -13.5) and ends on the path w714035045 down to Plac Zamkowy (y -19);
    // the NMT falls 1.6 m along it and the twin flight on the south side, w294098693, from the
    // viaduct's next node, is tagged `incline=down`. Its `incline=up` was the way drawn top down.
    id: "w56965515",
    tags: { incline: "down" },
    reason: "schody z wiaduktu Zamkowej w dół do ścieżki ku Placowi Zamkowemu: węzeł na wiadukcie, NMT −1,6 m, bliźniacze w294098693 incline=down",
    ref: "T-131",
  },
  // The castle stairs (Brabander, 1954): OSM has no `width` on their flights and landings, so they
  // were 3 m and 2-2.5 m bands, a dark strip up the slope. Their walls w231832094 and w231832095
  // stand 9.6..10.1 m apart (centre lines), about 11 m with the balustrades on the orthophoto.
  ...stairs(["w1435832499", "w1305940836", "w1305889408", "w1305940837", "w1306105687"], "biegi"),
  ...stairs(["w1435832498", "w56965512", "w1305889407", "w1305940838", "w48500135", "w1306105686"], "podesty"),
];

/**
 * An area OSM does not map at all, where the orthophoto shows one: a correction of the map like
 * the ones above, but with an outline of its own (world metres) instead of an element to change.
 * Its outline meets the mapped neighbours' edges as the import lays them, and runs on under the
 * paths drawn over it: their bands are rounded to 0.1 m and simplified each on its own, so an edge
 * laid along theirs would leave a crack of bare terrain. A square is drawn under every paving but
 * grass and water, so the part under a path does not show.
 */
export interface AddedArea {
  /** `T-NNN/<name>`: no OSM id, so the register entry it answers. */
  readonly id: string;
  readonly tags: Tags;
  readonly ring: readonly Pt[];
  /** Per vertex of `ring`, the OSM way it is a node of (`null`: laid off the map's nodes), so a new extract that moves the node shows. */
  readonly nodesOf: readonly (string | null)[];
  readonly reason: string;
  readonly ref: string;
}

/**
 * The lawn before the pavilions by the Dworzec Autobusowy (T-170, the curator's review of PR #318):
 * from the path w227698420 (0.5 m south of its axis, under its band) at x 840 up to 0.5 m before the
 * pavilions' south walls, east to x 870. West to east along the walls, then down to the path.
 */
const PAVILION_LAWN_EDGE: readonly Pt[] = [
  { x: 840.0, z: 365.04 },
  { x: 840.0, z: 368.93 },
  { x: 845.78, z: 368.37 },
  { x: 846.89, z: 366.92 },
  { x: 855.45, z: 365.98 },
  { x: 857.81, z: 364.67 },
  { x: 862.09, z: 364.15 },
  { x: 870.0, z: 363.19 },
];

export const ADDED_AREAS: readonly AddedArea[] = [
  {
    // The square before the Dworzec Autobusowy and Nova, paved on the orthophoto (PZGiK), where OSM
    // has only the south tip of `landuse=retail` w291844839: bare terrain from the footway
    // w227698428 in the west to the footway w227698423 in the east, between the paths w227698424
    // and w1435832520 and the car park w175995587 and Nova w66264174, with the metro's `targ` B
    // opening onto it (T-159). Its corners are the map's nodes: the paths' and the west footway's
    // on their axes, the car park's and Nova's on their edges. Only the east side is laid off
    // them, 0.1-0.7 m in from the footway's edge.
    id: "T-162/plac-dworca",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 718.1, z: 371.2 },
      { x: 732.9, z: 370.4 },
      { x: 761.4, z: 368.8 },
      { x: 763.7, z: 376.3 },
      { x: 760.3, z: 376.3 },
      { x: 746.7, z: 378.1 },
      { x: 744.7, z: 379.8 },
      { x: 741.7, z: 380.2 },
      { x: 733.0, z: 381.5 },
      { x: 720.7, z: 383.2 },
      { x: 719.7, z: 380.8 },
    ],
    nodesOf: ["w227698424", "w1435832520", null, null, "w175995587", "w175995587", "w66264174", "w66264174", "w66264174", "w66264174", "w227698428"],
    reason: "plac pieszy przed Dworcem Autobusowym, wybrukowany na ortofoto PZGiK, w OSM tylko landuse=retail",
    ref: "T-162",
  },
  {
    // The paving on both sides of the footway w227698423 by the Dworzec Autobusowy w66264171, bare in
    // OSM: the strip along the car park w175995587's edge (dark red setts on the orthophoto) and the
    // square of market stalls up to the station's west wall. Its west side is the car park's edge, its
    // east the station's walls up to their north-west corner, where the footway w227698410 meets
    // the car park; the south follows the path w227698420's axis along the station's front to its
    // south-east corner, so no seam is left at the stalls' corner, and joins T-162/plac-dworca. Off the
    // nodes: T-162's east corner, the path's axis abreast of the station's south-east corner and the
    // car park's edge abreast of the footway's node.
    id: "T-164/plac-przy-dworcu",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 760.3, z: 376.3 },
      { x: 763.7, z: 376.3 },
      { x: 764.51, z: 375.67 },
      { x: 803.59, z: 370.49 },
      { x: 803.59, z: 374.05 },
      { x: 790.12, z: 375.68 },
      { x: 790.0, z: 374.78 },
      { x: 787.69, z: 376.05 },
      { x: 787.15, z: 375.07 },
      { x: 784.29, z: 376.51 },
      { x: 783.76, z: 375.48 },
      { x: 781.48, z: 376.57 },
      { x: 781.04, z: 375.62 },
      { x: 778.46, z: 376.94 },
      { x: 781.89, z: 403.04 },
      { x: 784.65, z: 424.35 },
      { x: 785.8, z: 429.26 },
      { x: 785.01, z: 429.26 },
    ],
    nodesOf: ["w175995587", null, "w227698423", null, "w66264171", "w66264171", "w66264171", "w66264171", "w66264171", "w66264171", "w66264171", "w66264171", "w66264171", "w66264171", "w66264171", "w66264171", "w227698410", null],
    reason: "kostka placu przy Dworcu Autobusowym (stragany, pas przy parkingu) na ortofoto PZGiK, w OSM bez obszaru",
    ref: "T-164",
  },
  {
    // The pavement along Nova w66264174's east wall, between it and the car park w175995587: setts on
    // the orthophoto, bare in OSM. From T-162/plac-dworca up to Nova's north wall, whose line
    // closes it at the car park's edge.
    id: "T-164/chodnik-novy",
    tags: { "area:highway": "footway", surface: "paving_stones" },
    ring: [
      { x: 746.7, z: 378.1 },
      { x: 753.97, z: 427.59 },
      { x: 750.98, z: 427.97 },
      { x: 744.7, z: 379.8 },
    ],
    nodesOf: ["w175995587", null, "w66264174", "w66264174"],
    reason: "chodnik z kostki wzdłuż ściany Novy na ortofoto PZGiK, w OSM bez obszaru",
    ref: "T-164",
  },
  {
    // Nova w66264174's back yard, paved with parked cars on the orthophoto (PZGiK), setts from the
    // west, where OSM has only `landuse=retail` w291844839: bare terrain from Nova's north wall to
    // Nowy Plac Targowy w40050943, between the footway w227698428 by Nova's west wall and the car
    // park w175995587. It runs to the street's axis, so no seam is left at its edge, also along the
    // car park's north edge to where its aisle leaves the street, and stops at the line of the car
    // park w227698441's east edge. Off the nodes: T-164/chodnik-novy's corner on the car park's edge
    // and the street's axis abreast of the car park w227698441's north-east corner. A square, not a
    // service area: a carriageway would widen the street to Nova's wall, and its lamps lose their edge.
    id: "T-169/zaplecze-novy",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 726.96, z: 431.12 },
      { x: 748.33, z: 428.31 },
      { x: 750.98, z: 427.97 },
      { x: 753.97, z: 427.59 },
      { x: 755.2, z: 436.1 },
      { x: 771.34, z: 433.88 },
      { x: 772.74, z: 437.81 },
      { x: 767.78, z: 438.11 },
      { x: 762.26, z: 438.74 },
      { x: 745.15, z: 441.69 },
      { x: 726.12, z: 445.48 },
      { x: 726.12, z: 440.8 },
      { x: 725.42, z: 436.92 },
      { x: 727.09, z: 434.91 },
    ],
    nodesOf: ["w66264174", "w66264174", "w66264174", null, "w175995587", "w175995587", "w40050943", "w40050943", "w40050943", "w40050943", null, "w227698441", "w227698441", "w227698428"],
    reason: "utwardzony plac zaplecza Novy z zaparkowanymi autami na ortofoto PZGiK, w OSM tylko landuse=retail",
    ref: "T-169",
  },
  {
    // The platform along the Dworzec Autobusowy w66264171's east wall, light paving with walkers on
    // the orthophoto, bare in OSM: from the path w227698420's axis in the south (T-164's corner) by
    // the footway w227698409 to the stands' asphalt w66323033, along its edge north to the footway
    // w227698421 and the kiosk w73833929's east wall, and back by the station's north-east corner.
    // The footways w227698427 and w227698418 run over it. In the east it takes the roofed
    // platform w458862470's west tooth up to the north-south line through its east node
    // (810.6, 387.22), closed on that line at the footway w227698409's axis in the south and the
    // asphalt's edge in the north (both off the nodes), so the strip leaves no bare corner at the
    // stands. The rest of the platform's ground east of that line is not this strip's.
    id: "T-168/peron-przy-dworcu",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 803.59, z: 374.05 },
      { x: 803.59, z: 370.49 },
      { x: 806.22, z: 370.14 },
      { x: 808.0, z: 382.4 },
      { x: 810.6, z: 382.1 },
      { x: 810.6, z: 387.22 },
      { x: 810.6, z: 392.04 },
      { x: 805.8, z: 388.56 },
      { x: 802.22, z: 389.53 },
      { x: 807.09, z: 427.26 },
      { x: 814.02, z: 435.29 },
      { x: 806.78, z: 433.99 },
      { x: 801.64, z: 431.86 },
      { x: 801.26, z: 428.31 },
      { x: 802.47, z: 426.1 },
      { x: 796.61, z: 422.79 },
      { x: 793.79, z: 401.25 },
      { x: 791.73, z: 385.16 },
      { x: 804.79, z: 383.56 },
    ],
    nodesOf: ["w66264171", null, "w227698420", "w227698409", null, "w458862470", null, "w66323033", "w66323033", "w66323033", "w66323033", "w227698421", "w73833929", "w73833929", "w227698418", "w66264171", "w66264171", "w66264171", "w66264171"],
    reason: "peron z kostki wzdłuż wschodniej ściany Dworca Autobusowego na ortofoto PZGiK, w OSM bez obszaru",
    ref: "T-168",
  },
  {
    // The pavement along the Dworzec Autobusowy's north wall, under the footway w227698418, and the
    // block of the kiosk w73833929 that the footways w227698410 and w227698421 close in the north:
    // bare in OSM. It goes round the kiosk's south, west and north walls and leaves its east wall
    // to T-168/peron-przy-dworcu, so neither covers the kiosk. Every corner is the map's node.
    // Pedestrian, not footway: the props keep off a footway's outline as off a path, and the
    // booth before the station's fast-food venue stands on this pavement.
    id: "T-168/chodnik-przy-dworcu",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 784.65, z: 424.35 },
      { x: 796.61, z: 422.79 },
      { x: 802.47, z: 426.1 },
      { x: 801.26, z: 428.31 },
      { x: 795.17, z: 428.97 },
      { x: 795.27, z: 431.48 },
      { x: 797.7, z: 431.31 },
      { x: 797.8, z: 432.14 },
      { x: 801.64, z: 431.86 },
      { x: 806.78, z: 433.99 },
      { x: 796.18, z: 438.06 },
      { x: 790.83, z: 434.97 },
      { x: 785.8, z: 429.26 },
    ],
    nodesOf: ["w66264171", "w66264171", "w227698418", "w73833929", "w73833929", "w73833929", "w73833929", "w73833929", "w73833929", "w227698421", "w227698421", "w227698410", "w227698410"],
    reason: "chodnik wzdłuż północnej ściany Dworca Autobusowego i plac kiosku między chodnikami, w OSM bez obszaru",
    ref: "T-168",
  },
  {
    // The north pavement of al. Tysiąclecia, beige setts from the kerb to the market and the
    // Dworzec Autobusowy on the orthophoto (PZGiK), where OSM has only the lines of the paths:
    // from the carriageway's axis (w739432831, w1004769663; the road is drawn over it) north to the
    // path w227698424/w1435832520 and T-162, past the bus stop's shelters to the footway w227698409
    // and T-164 and T-168's corners. West of the Bazar w67502759 it takes the wedge up to
    // `landuse=retail` w291844839's edge, east of it the gap up to the footway w227698428 (red setts
    // from the hall's wall on the orthophoto, the footway's band narrower). Short of the beds of
    // shrubs, left bare: before the Bazar a 2.7 m bed 1-3.75 m south of its edge (the strip under
    // the halls' eaves is T-165/okap-bazaru), broken at x 684-687 where the footway w227698415 goes
    // in, and the bed before the Dworzec between the cycleway w1435832523 and the path w227698420
    // (x 773-803.6). Off the nodes: the beds' corners and the points on the road's axis abreast of
    // the grass w818580988 and w227698409.
    id: "T-165/chodnik-tysiaclecia",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 635.07, z: 384.66 },
      { x: 641.28, z: 387.48 },
      { x: 658.67, z: 386.8 },
      { x: 659.55, z: 385.43 },
      { x: 659.12, z: 382.72 },
      { x: 684.0, z: 378.79 },
      { x: 684.43, z: 381.5 },
      { x: 687.43, z: 381.02 },
      { x: 687.0, z: 378.31 },
      { x: 715.08, z: 373.87 },
      { x: 715.98, z: 379.55 },
      { x: 716.94, z: 385.65 },
      { x: 720.84, z: 389.22 },
      { x: 719.69, z: 380.84 },
      { x: 718.09, z: 371.17 },
      { x: 732.88, z: 370.41 },
      { x: 761.91, z: 368.68 },
      { x: 764.51, z: 375.67 },
      { x: 773.0, z: 374.54 },
      { x: 773.72, z: 368.93 },
      { x: 803.59, z: 364.84 },
      { x: 803.59, z: 370.49 },
      { x: 806.22, z: 370.14 },
      { x: 805.33, z: 364.6 },
      { x: 804.67, z: 360.04 },
      { x: 804.67, z: 347.54 },
      { x: 761.8, z: 353.5 },
      { x: 740.96, z: 356.4 },
      { x: 730.75, z: 357.87 },
      { x: 701.36, z: 361.98 },
      { x: 684.14, z: 364.39 },
      { x: 670.28, z: 366.33 },
      { x: 652.23, z: 368.89 },
      { x: 631.14, z: 371.84 },
      { x: 631.14, z: 379.32 },
      { x: 631.17, z: 380.49 },
    ],
    nodesOf: ["w227698424", "w291844839", "w291844839", null, null, null, null, null, null, null, "w67502759", "w67502759", "w227698428", "w227698428", "w227698424", "w227698424", "w1435832520", "w227698423", null, "w1435832523", null, null, "w227698420", "w227698409", "w227698409", null, "w1004769663", "w1004769663", "w739432831", "w739432831", "w739432831", "w739432831", "w739432831", null, "w818580988", "w818580988"],
    reason: "chodnik z kostki po północnej stronie al. Tysiąclecia (przystanek, front Bazaru i Dworca) na ortofoto PZGiK, w OSM tylko linie ścieżek",
    ref: "T-165",
  },
  {
    // The strip under the Bazar's eaves, between its south edge w67502759 and the bed of T-165
    // (which the halls' roofs overhang in the game, 1 m south of the edge on the orthophoto): the
    // same setts as the pavement, paved to the wall. Off the nodes: the bed's north corners.
    id: "T-165/okap-bazaru",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 659.55, z: 385.43 },
      { x: 715.51, z: 376.58 },
      { x: 715.98, z: 379.55 },
      { x: 660.02, z: 388.4 },
    ],
    nodesOf: [null, null, "w67502759", "w67502759"],
    reason: "pas kostki pod okapem hal Bazaru, od krawędzi targu do rabaty przed nim, na ortofoto PZGiK, w OSM bez obszaru",
    ref: "T-165",
  },
  {
    // The Dworzec Autobusowy's roofed platform w458862470 east of T-168's line x 810.6, light setts
    // under the roof on the orthophoto (PZGiK), bare in OSM: from the footway w227698409's axis
    // north to the stands' asphalt w66323033, whose edge is the roof's north zigzag, east to x 870
    // (off the nodes there). In the west it takes T-168's tooth again up to the asphalt's node
    // (805.8, 388.56): one edge along the asphalt's from node to node, so no seam is left at
    // T-168's point (810.6, 392.04) on it.
    id: "T-170/peron-pod-zadaszeniem",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 808.0, z: 382.4 },
      { x: 831.46, z: 379.68 },
      { x: 870.0, z: 375.23 },
      { x: 869.82, z: 386.47 },
      { x: 867.58, z: 384.59 },
      { x: 864.77, z: 387.83 },
      { x: 861.76, z: 385.1 },
      { x: 859.43, z: 387.94 },
      { x: 856.31, z: 385.24 },
      { x: 853.64, z: 388.63 },
      { x: 850.47, z: 386.05 },
      { x: 847.95, z: 389.4 },
      { x: 845.06, z: 387.18 },
      { x: 842.7, z: 390.29 },
      { x: 839.01, z: 387.64 },
      { x: 836.63, z: 391.0 },
      { x: 832.99, z: 388.42 },
      { x: 830.52, z: 391.87 },
      { x: 827.14, z: 389.49 },
      { x: 824.64, z: 392.96 },
      { x: 821.0, z: 390.33 },
      { x: 818.78, z: 393.42 },
      { x: 815.27, z: 390.82 },
      { x: 813.12, z: 393.88 },
      { x: 805.8, z: 388.56 },
    ],
    nodesOf: ["w227698409", "w227698409", null, ...Array<string>(22).fill("w66323033")],
    reason: "kostka peronu pod zadaszeniem Dworca Autobusowego na ortofoto PZGiK, w OSM tylko obrys dachu",
    ref: "T-170",
  },
  {
    // The block of the pavilions w458298766…w458298772 before the Dworzec, setts round them on the
    // orthophoto (PZGiK), bare in OSM: from the path w227698420 in the south to the footway
    // w227698409's axis in the west and north, east to x 870. The south side runs 0.5 m south of the
    // path's axis, under its band, so the chunks' edge z 370 leaves no seam at it; the bed between
    // the path and the cycleway w1435832523 stays bare. East of x 840 it stops 0.5 m before the
    // pavilions' south walls: the lawn in front of them is T-170/trawnik-pawilonow. Off the nodes:
    // all but the footway's.
    id: "T-170/plac-pawilonow",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 806.13, z: 369.6 },
      { x: 834.75, z: 365.76 },
      ...PAVILION_LAWN_EDGE,
      { x: 870.0, z: 375.23 },
      { x: 831.46, z: 379.68 },
      { x: 808.0, z: 382.4 },
    ],
    nodesOf: [null, null, ...PAVILION_LAWN_EDGE.map(() => null), null, "w227698409", "w227698409"],
    reason: "kostka wokół pawilonów przed Dworcem Autobusowym na ortofoto PZGiK, w OSM tylko linie chodników",
    ref: "T-170",
  },
  {
    // North of the kiosk w73833929 (T-168/chodnik-przy-dworcu): setts with the crossing w227698417 on
    // the orthophoto (PZGiK), bare in OSM, from the car park w175995587's north-east edge (from T-164's
    // corner) to Nadstawna w40049600 and Nowy Plac Targowy w40050943 (both drawn over it from their
    // axes), east to the footway w227698430 and north to the shop w73833931's walls; the kiosk
    // w73833930 stands on it. It joins T-169/zaplecze-novy on the street's axis and stops in the north
    // at the footway w227698410's node by the shop. The stands' entry south of the footway w227698430
    // is asphalt: T-170/wjazd-stanowisk. Off the nodes: T-164's corner on the car park's edge.
    id: "T-170/plac-przy-kiosku",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 771.34, z: 433.88 },
      { x: 788.55, z: 436.84 },
      { x: 785.01, z: 429.26 },
      { x: 785.8, z: 429.26 },
      { x: 790.83, z: 434.97 },
      { x: 796.18, z: 438.06 },
      { x: 806.78, z: 433.99 },
      { x: 811.29, z: 440.68 },
      { x: 822.9, z: 437.28 },
      { x: 823.95, z: 439.32 },
      { x: 828.67, z: 448.44 },
      { x: 819.61, z: 450.73 },
      { x: 817.27, z: 445.12 },
      { x: 814.83, z: 446.06 },
      { x: 813.72, z: 443.63 },
      { x: 806.78, z: 446.71 },
      { x: 808.0, z: 449.97 },
      { x: 805.57, z: 451.2 },
      { x: 800.81, z: 448.63 },
      { x: 789.51, z: 448.0 },
      { x: 787.02, z: 443.72 },
      { x: 783.78, z: 440.7 },
      { x: 780.7, z: 439.32 },
      { x: 777.16, z: 438.28 },
      { x: 772.74, z: 437.81 },
    ],
    nodesOf: ["w175995587", "w175995587", null, "w227698410", "w227698410", "w227698421", "w227698421", "w227698430", "w227698430", "w227698430", "w227698430", ...Array<string>(7).fill("w73833931"), "w227698410", "w40049600", "w40049600", ...Array<string>(4).fill("w40050943")],
    reason: "kostka na północ od kiosku przy Dworcu Autobusowym, z przejściem przez Nadstawną, na ortofoto PZGiK, w OSM tylko linie chodników",
    ref: "T-170",
  },
  {
    // The stands' entry between the asphalt w66323033's north edge and the footway w227698430, asphalt on
    // the orthophoto (PZGiK) up to the footway's zebra: a carriageway's area, not setts. Its west side is
    // T-168/peron-przy-dworcu's edge; every corner is the map's node.
    id: "T-170/wjazd-stanowisk",
    tags: { "area:highway": "service", surface: "asphalt" },
    ring: [
      { x: 806.78, z: 433.99 },
      { x: 814.02, z: 435.29 },
      { x: 822.82, z: 433.42 },
      { x: 822.9, z: 437.28 },
      { x: 811.29, z: 440.68 },
    ],
    nodesOf: ["w227698421", "w66323033", "w66323033", "w227698430", "w227698430"],
    reason: "asfalt wjazdu na stanowiska Dworca Autobusowego do przejścia przez chodnik, na ortofoto PZGiK, w OSM bez obszaru",
    ref: "T-170",
  },
  {
    // The strip between the car park w227698441 (by the Bazar) and Nowy Plac Targowy w40050943/w40049827,
    // bare in OSM, 1.2-1.9 m: on the orthophoto (PZGiK) asphalt from the cars' fronts to the street, so
    // a carriageway's area, not setts, with the street's lamps on it by the cars. From the car park's
    // north edge to 1 m short of the street's axis (under its band), so the axis lies on the street's
    // band alone and a lamp finds the band's edge. Off the nodes: the north side.
    id: "T-172/pas-parkingu",
    tags: { "area:highway": "service", surface: "asphalt" },
    ring: [
      { x: 726.12, z: 440.8 },
      { x: 726.12, z: 444.48 },
      { x: 714.09, z: 446.88 },
      { x: 695.46, z: 450.7 },
      { x: 686.21, z: 451.6 },
      { x: 676.34, z: 452.26 },
      { x: 672.09, z: 452.78 },
      { x: 672.09, z: 450.44 },
    ],
    nodesOf: ["w227698441", null, null, null, null, null, null, "w227698441"],
    reason: "asfalt od przodów aut na parkingu przy Bazarze do jezdni Nowego Placu Targowego na ortofoto PZGiK, w OSM bez obszaru",
    ref: "T-172",
  },
  {
    // The red setts along the Bazar w67502759's north and east edges by the car park w227698441, bare
    // in OSM on both sides of the footway w227698428's band: from the Bazar's edge to the car park's
    // south edge, and round the car park's south-east corner up the Bazar's east edge to the
    // footway's node (725.01, 419.7), past the building w73833938. The footway is drawn over it.
    // It joins T-169/zaplecze-novy at the car park's corner; every corner is the map's node.
    id: "T-172/chodnik-przy-hali",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 671.4, z: 446.57 },
      { x: 725.42, z: 436.92 },
      { x: 727.09, z: 434.91 },
      { x: 725.01, z: 419.7 },
      { x: 722.57, z: 421.07 },
      { x: 724.62, z: 433.99 },
      { x: 703.75, z: 437.28 },
      { x: 693.91, z: 438.84 },
      { x: 668.65, z: 442.82 },
    ],
    nodesOf: ["w227698441", "w227698441", "w227698428", "w227698428", "w67502759", "w67502759", "w67502759", "w67502759", "w67502759"],
    reason: "czerwona kostka chodnika wzdłuż hal Bazaru przy parkingu na ortofoto PZGiK, w OSM tylko linia chodnika",
    ref: "T-172",
  },
  {
    // The north pavement of al. Tysiąclecia east of T-165, beige setts to the kerb on the orthophoto
    // (PZGiK), with the bus stop's light grey edge, bare in OSM: from the carriageway w1004769663's
    // axis (drawn over it) north to the footway w1435832518 and the path w1435832524, east to the
    // lawn w804709934. Off the nodes: T-165's corner and the point on the road's axis by the lawn,
    // and the path's axis abreast of the lawn's tip.
    id: "T-173/chodnik-tysiaclecia-wschod",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 804.67, z: 360.04 },
      { x: 838.98, z: 355.26 },
      { x: 850.34, z: 355.9 },
      { x: 867.02, z: 353.11 },
      { x: 871.29, z: 352.44 },
      { x: 871.29, z: 348.69 },
      { x: 870.0, z: 346.7 },
      { x: 870.0, z: 338.46 },
      { x: 804.67, z: 347.54 },
    ],
    nodesOf: ["w1435832518", "w1435832518", "w1435832518", "w1435832524", null, "w804709934", "w804709934", null, null],
    reason: "chodnik z kostki po północnej stronie al. Tysiąclecia na wschód od Dworca (przystanek) na ortofoto PZGiK, w OSM tylko linie ścieżek",
    ref: "T-173",
  },
  {
    // The red setts along the Bazar w67502759's east edge, about 5 m from the halls' wall to Nova on
    // the orthophoto (PZGiK), where the footway w227698428's band is 2.5 m and the rest bare in OSM:
    // from the Bazar's edge to the footway's axis (drawn over it), from T-165's corner to
    // T-172/chodnik-przy-hali's. Every corner is the map's node.
    id: "T-175/chodnik-przy-bazarze",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 716.94, z: 385.65 },
      { x: 721.38, z: 413.62 },
      { x: 722.57, z: 421.07 },
      { x: 725.01, z: 419.7 },
      { x: 724.01, z: 412.43 },
      { x: 722.95, z: 404.64 },
      { x: 721.84, z: 396.58 },
      { x: 720.84, z: 389.22 },
    ],
    nodesOf: ["w67502759", "w67502759", "w67502759", "w227698428", "w227698428", "w227698428", "w227698428", "w227698428"],
    reason: "czerwona kostka między wschodnią ścianą hal Bazaru a Novą na ortofoto PZGiK, w OSM tylko linia chodnika",
    ref: "T-175",
  },
  {
    // The lawn between the pavilions' south walls and the path w227698420 (x 840-870), green on the
    // orthophoto (PZGiK) where T-170/plac-pawilonow had laid setts: grass, as a bed of the map. The path
    // is drawn over its south edge.
    id: "T-170/trawnik-pawilonow",
    tags: { landuse: "flowerbed" },
    ring: [{ x: 870.0, z: 360.96 }, ...[...PAVILION_LAWN_EDGE].reverse()],
    nodesOf: [null, ...PAVILION_LAWN_EDGE.map(() => null)],
    reason: "trawnik przed pawilonami przy Dworcu Autobusowym na ortofoto PZGiK, w OSM bez obszaru",
    ref: "T-170",
  },
];

/** The added areas as the import reads the map's. */
export const addedAreas = (added: readonly AddedArea[] = ADDED_AREAS): Area[] => added.map((a) => ({ id: a.id, osmId: 0, tags: a.tags, ring: a.ring, holes: 0 }));

const BY_ID: ReadonlyMap<string, TagCorrection> = new Map(TAG_CORRECTIONS.map((c) => [c.id, c]));

/** The area with its corrected tags and outline, or as it is. */
export const corrected = (a: Area, corrections: ReadonlyMap<string, TagCorrection> = BY_ID): Area => {
  const c = corrections.get(a.id);
  if (!c) return a;
  const k = c.scale ?? 1;
  const o = centroid(a.ring);
  return { ...a, tags: { ...a.tags, ...c.tags }, ring: k === 1 ? a.ring : a.ring.map((p) => ({ x: o.x + (p.x - o.x) * k, z: o.z + (p.z - o.z) * k })) };
};

/** The line with its corrected tags (a way's width or type the map gets wrong), or as it is. */
export const correctedLine = (l: Line, corrections: ReadonlyMap<string, TagCorrection> = BY_ID): Line => {
  const c = corrections.get(l.id);
  return c ? { ...l, tags: { ...l.tags, ...c.tags } } : l;
};
