/*
 * The locations of the game outside its interiors (ADR-0102, the user's order of 23.11): every place the player
 * walks, from a district to a yard behind a car wash, has its card in `docs/lokacje/<id>.md` with its story and
 * its audit against the rules of `docs/zasady-lokacji.md`; a story location (a scene of an act, a place of a story
 * character, a contract's site) has a detailed scenario too. The registry names each location once and ties it to
 * the game's own lists (`refs`), so a new contract site, territory, metro entrance, building site, encounter or
 * stash without a location is a red test (`locations.test.ts`). Interiors keep their cards in `docs/pomieszczenia/`
 * (`INTERIORS`); the ones a story plays in are `STORY_INTERIORS` and need the scenario as well. Docs tooling only:
 * the game does not read it.
 */

/** What kind of place it is: the whole district, a square or a street, a yard or a scene, a landmark, a metro entrance, a building site. */
export type LocationKind = "district" | "place" | "scene" | "landmark" | "metro" | "construction";

/** The game's own ids a location covers, each list checked for coverage against its registry. */
export interface LocationRefs {
  /** `CONTRACT_SITE_IDS` (core/contracts). */
  readonly contracts?: readonly string[];
  /** `TERRITORY_IDS` (core/world/territories). */
  readonly territories?: readonly string[];
  /** `CITY_DISTRICT_IDS` (core/world/territories). */
  readonly districts?: readonly string[];
  /** `METRO_ENTRANCES` as `<station>-<label>` (sim/content/metro). */
  readonly metro?: readonly string[];
  /** `LUBLIN_CONSTRUCTION_SITES` by OSM id (sim/content/lublin). */
  readonly construction?: readonly string[];
  /** `ENCOUNTERS` by id (sim/content/encounters); the card lists each under `## Spotkania`. */
  readonly encounters?: readonly string[];
  /** `WORLD_STASHES` by key (sim/content/world-map). */
  readonly stashes?: readonly string[];
}

export interface LocationDef {
  readonly id: string;
  /** Its name in the docs (Polish, as the cards are). */
  readonly name: string;
  readonly kind: LocationKind;
  /** A scene of the story, a story character's place or a contract's site: the card has `## Scenariusz`. */
  readonly story: boolean;
  readonly refs?: LocationRefs;
}

const story = (id: string, name: string, kind: LocationKind, refs?: LocationRefs): LocationDef => ({ id, name, kind, story: true, ...(refs ? { refs } : {}) });
const place = (id: string, name: string, kind: LocationKind, refs?: LocationRefs): LocationDef => ({ id, name, kind, story: false, ...(refs ? { refs } : {}) });

export const LOCATIONS: readonly LocationDef[] = [
  // The story: the prologue and act I on Krakowskie Przedmieście.
  story("deptak-krakowskie", "Deptak Krakowskiego Przedmieścia (Shinsekai-7)", "place", { stashes: ["stash:s7-pachinko"] }),
  story("plac-litewski", "Plac Litewski: wrak przy południowej bramie i furgonetka na parkingu", "place", { contracts: ["south_gate", "east_lot"], metro: ["shinsekai-A"] }),
  story("myjnia-podworko", "Podwórko za MYJNIA 24H przy Placu Łokietka", "scene", { contracts: ["car_wash"], territories: ["car-wash-yard"] }),
  story("koi-podworko", "Podwórko za Neon Koi", "scene", { contracts: ["koi_back"], stashes: ["stash:s7-koi-back"] }),
  // Acts II and III, the Old Town.
  story("alchemia-pawilon-dach", "Dach trójkątnego pawilonu Alchemii (Ren)", "scene", { stashes: ["stash:targ-roof"] }),
  story("alchemia-parking-kiosk", "Parking przy kiosku windy Alchemii (Kurosawa)", "scene", { metro: ["kanal-B"] }),
  story("alchemia-t1", "Taras T1 Alchemii z wózkiem Hany", "place", { contracts: ["hana_stall"] }),
  story("alchemia-t2-arkady", "Plac T2 i Arkady Alchemii (czujka Hebi, kamień pamięci)", "place", { territories: ["alchemia-arcades"], stashes: ["stash:targ-overpass"] }),
  story("zamek-dziedziniec", "Dziedziniec Zamku Lubelskiego, Kaplica Trójcy i Donżon", "scene"),
  story("rynek", "Rynek z Trybunałem (Hideo, Mei, Tetsu)", "place", { territories: ["rynek"] }),
  story("grodzka-kladka", "Grodzka pod krytą kładką i Brama Grodzka", "place", { contracts: ["kanal_bridge"], territories: ["grodzka-bridge"] }),
  story("brama-krakowska", "Brama Krakowska i kontener pod nią (Tetsu)", "landmark", { stashes: ["stash:kanal-alley"] }),
  // W-3 „Dwie drogi” outside its halls, and the docks.
  story("w3-pas-publiczny", "Pas publiczny nabrzeża i kontener Genzō", "place", { contracts: ["docks_escort"], metro: ["doki-A"] }),
  story("w3-plac-odbioru", "Plac odbioru W-3 z ogrodzeniem i bramą", "scene"),
  story("w3-nabrzeze", "Nabrzeże i pomost W-3 z terminalem", "scene", { contracts: ["quay_terminal"] }),
  story("w3-wieza", "Wieża przepustek W-3 z zewnątrz", "scene"),
  story("w3-rurociag-basen", "Rurociąg i basen W-3", "scene"),
  // The districts, with their encounters.
  place("dzielnica-shinsekai-7", "Krakowskie Przedmieście (Shinsekai-7)", "district", { districts: ["shinsekai-7"], encounters: ["s7_pachinko", "s7_salaryman", "s7_neko", "s7_poet"] }),
  place("dzielnica-kanal", "Stare Miasto (Kanał)", "district", { districts: ["kanal"], encounters: ["kanal_flowers", "kanal_fisherman", "kanal_vending", "kanal_recruit"] }),
  place("dzielnica-targ", "Podzamcze (Targ)", "district", { districts: ["targ"], encounters: ["targ_fortune", "targ_chicken", "targ_debt", "targ_idol"] }),
  place("dzielnica-doki", "Nabrzeże Bystrzycy (Doki)", "district", { districts: ["doki"], encounters: ["doki_laidoff", "doki_gull", "doki_container"] }),
  // Squares and streets.
  place("plac-lokietka", "Plac Łokietka i Nowy Ratusz", "place", { metro: ["kanal-A"] }),
  place("plac-po-farze", "Plac po Farze", "place"),
  place("plac-katedralny", "Plac Katedralny, Archikatedra i Wieża Trynitarska", "place"),
  place("plac-zamkowy", "Plac Zamkowy", "place", { metro: ["targ-A"] }),
  place("aleja-tysiaclecia", "Aleja Tysiąclecia i hale bazaru", "place", { territories: ["bazaar-halls"] }),
  place("dworzec-autobusowy", "Dworzec Autobusowy i stragany", "place", { territories: ["bus-station"], metro: ["targ-B"] }),
  place("nowy-plac-targowy", "Nowy Plac Targowy przy Ruskiej", "place", { territories: ["ruska-market"] }),
  place("lubartowska", "Lubartowska przy rondzie", "place", { territories: ["lubartowska"] }),
  place("zaulek-kapucynska", "Zaułek przy Kapucyńskiej", "place", { territories: ["kapucynska-alley"] }),
  place("zaulek-panasa", "Zaułek Panasa i Podwale", "place", { territories: ["panasa-lane"] }),
  place("nabrzeze-bystrzycy", "Nabrzeże Bystrzycy poza W-3", "place"),
  // Alchemia outside.
  place("alchemia-plac-frontu", "Plac przed frontem Alchemii od Bajkowskiego", "place"),
  place("alchemia-deptak", "Deptak Alchemii na Lubartowskiej i jego nocny koniec", "place"),
  place("alchemia-t0", "Taras T0 Alchemii", "place"),
  place("alchemia-zielony-dach", "Zielony dach Alchemii", "place"),
  place("alchemia-dom-z-arkadami", "Dom z arkadami w osi frontu Alchemii", "landmark"),
  // Landmarks.
  place("kosciol-sw-ducha", "Kościół Świętego Ducha", "landmark"),
  place("cerkiew-przemienienia", "Cerkiew Przemienienia Pańskiego", "landmark"),
  // Building sites (ADR-0087).
  place("budowa-arkologia", "Plac budowy: Arkologia Lublin, etap II", "construction", { construction: ["w1236055101"] }),
  place("budowa-wzgorza", "Plac budowy: Wzgórza Miedzianych Dachów", "construction", { construction: ["w1362895448"] }),
  place("budowa-plac-koziolka", "Plac budowy: Plac Koziołka", "construction", { construction: ["w770678456"] }),
];

/** Interiors a story plays in: their room cards get `## Scenariusz` too. */
export const STORY_INTERIORS: readonly string[] = [
  "clinic",
  "neon-koi",
  "capsule",
  "tessen-office",
  "w3-hall",
  "w3-basement",
  "trasa-podziemna",
  "alchemia-shelter",
  "alchemia-gallery",
  "alchemia-foodhall",
];

/** Contract sites whose place is an interior with a room card (ADR-0102): the location registry does not list them again. */
export const INTERIOR_CONTRACTS: Readonly<Record<string, string>> = {
  hebi_stash: "alchemia-shelter",
  raid_north: "alchemia-gallery",
  raid_east: "alchemia-foodhall",
  tessen_office: "tessen-office",
  w3_hall: "w3-hall",
};

/** Stashes that lie in an interior with a room card. */
export const INTERIOR_STASHES: Readonly<Record<string, string>> = {
  "stash:trasa-podziemna": "trasa-podziemna",
};
