/**
 * Explicit corrections of OSM tags and outlines (ADR-0042): a value the map has only as an
 * estimate, which a measurement or the topography curator's review (`docs/topografia.md`) puts
 * right. Each entry names the OSM element, what it replaces, why, and the register entry; the raw data in
 * `data/osm` stays as downloaded, so a new extract keeps the correction until OSM agrees.
 */
import { type Area, type Line } from "./features.ts";
import { centroid } from "./geometry.ts";
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
    // with a 1 m plinth; `height` counts over the plinth, hence 9.5 + 1.6 - 1.
    // St Nicholas's belfry w680377807 waits for a source: the surface model there is tree crowns.
    id: "w1382552285",
    tags: { height: "10.1" },
    reason: "wieża cerkwi św. Jozafata: szczyt y 9,5 z NMPT wobec y 12,2 z domyślnych 4 kondygnacji",
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
