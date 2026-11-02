/**
 * Which kinds of `docs/world/lublin-props.todo.json` become street furniture (ADR-0047), which
 * map to the nearest `StreetPropKind`, and which are left out and why.
 */
import type { StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";

/** Kinds of the plan that are a `StreetPropKind` as they are. */
const SAME: readonly StreetPropKind[] = [
  "lamp-pastoral",
  "lamp-wall-lantern",
  "lamp-candelabra",
  "lamp-modern-pole",
  "lamp-road",
  "lamp-park",
  "floodlight",
  "bench",
  "bollard",
  "tree",
  "shrubs",
  "planter",
  "hanging-basket",
  "waste-bin",
  "bike-rack",
  "bike-station",
  "advertising-column",
  "a-frame-sign",
  "street-plate",
  "street-cabinet",
  "manhole",
  "granite-block",
  "flagpole",
  "traffic-signal",
  "bus-shelter",
  "bus-stop",
  "ticket-machine",
  "vending-machine",
  "kiosk",
  "cafe-garden",
  "market-stall",
  "fountain-jets",
  "monument",
  "artwork",
  "cctv",
  "atm",
  "hydrant",
  "food-cart",
  "container",
];

/** Kinds of the plan drawn as the nearest street prop, and why that one. */
export const MAPPED: Readonly<Record<string, { readonly prop: StreetPropKind; readonly why: string }>> = {
  "trolley-wire": { prop: "trolley-pole", why: "the line is the street under the wires; count is the number of poles and hangers" },
  "tree-row": { prop: "tree", why: "a row of trees along the line" },
  hedge: { prop: "shrubs", why: "clipped shrubs along the line" },
  "lamp-memorial": { prop: "lamp-pastoral", why: "the pre-war lantern on a post shares the pastoral's lantern" },
  "street-lamp": { prop: "lamp-road", why: "OSM street lamps away from the old town are road lamps" },
  "flagpole-tall": { prop: "flagpole", why: "the 35 m Maszt Niepodległości, the tall shape of the flagpole" },
  fountain: { prop: "fountain-jets", why: "jets in the basin; the water itself is a ground surface" },
  "fountain-multimedia": { prop: "fountain-jets", why: "jets in the leaf-shaped basin; the water itself is a ground surface" },
  "drinking-fountain": { prop: "bollard", why: "a cast-iron post with a tap" },
  shrine: { prop: "monument", why: "a roadside shrine: the shrine shape of the monuments" },
  "memorial-stone": { prop: "granite-block", why: "a boulder (Głaz Katowski)" },
  millstone: { prop: "granite-block", why: "a stone on the ground" },
  "neon-art": { prop: "artwork", why: "an installation" },
  "info-board": { prop: "street-plate", why: "a board on a post" },
  "poster-box": { prop: "advertising-column", why: "a poster stand" },
  "parcel-locker": { prop: "vending-machine", why: "a box with a screen by a wall" },
  "phone-booth": { prop: "vending-machine", why: "the netrunner terminals of 2077 stand where the phone booths were" },
  "picnic-table": { prop: "bench", why: "a seat in the park" },
  recycling: { prop: "waste-bin", why: "bins" },
  "waste-container": { prop: "waste-bin", why: "bins" },
  "post-box": { prop: "street-cabinet", why: "a box on the pavement" },
  market: { prop: "market-stall", why: "a marketplace's outline: rows of stalls on its open ground (G-064)" },
};

/** Kinds of the plan left out, and why. */
export const SKIPPED: Readonly<Record<string, string>> = {
  crossing: "zebra crossings are ground markings (decals), not furniture",
  "stop-position": "a node on the road where the bus stops; the stop itself is bus-stop",
  "parking-lot": "an area, drawn as ground",
  "parking-entrance": "an opening in a building",
  steps: "stairs need their own geometry along the way (later, with walls)",
  wall: "walls need their own geometry along the way",
  "retaining-wall": "walls need their own geometry along the way",
  "city-wall": "walls need their own geometry along the way",
  fence: "fences need their own geometry along the way",
  "pedestrian-railing": "railings need their own geometry along the way",
  "construction-fence": "temporary, picked per building by the game",
  gate: "gates belong to fences and walls",
  "lift-gate": "a barrier arm on a road, with the parking areas",
  bridge: "bridges are structures (ADR-0044 puts them later)",
  footbridge: "bridges are structures (ADR-0044 puts them later)",
  "river-bank": "river banks are terrain",
  tower: "towers are buildings in the map data",
  church: "the building is in the map data",
  "city-gate": "the building is in the map data",
  ruins: "low walls of an outline, structures",
  "archaeological-site": "nothing visible",
  viewpoint: "a place, not a thing",
  playground: "an area with its own equipment (later)",
  "bus-station": "a building",
  "bus-platform": "a roofed platform, a structure",
  "taxi-rank": "a road marking",
  "wood-deck": "a pattern of the ground surface",
  "event-stage": "temporary, for events",
  "exhibition-board": "temporary exhibitions",
  "seasonal-decoration": "depends on the date in the game",
  "vehicle-trolleybus": "a moving vehicle, not static furniture",
  "shop-sign-bracket": "shop signs belong to the facades' neon (ADR-0044)",
  plaque: "plaques sit on facades",
  "atm-indoor": "a cash machine inside a building (OSM indoor=yes)",
  cafe: "a point of interest inside a building",
  "food-outlet": "a point of interest inside a building",
  toilet: "a small building",
  well: "a structure with its own model (later)",
  cannon: "museum pieces with their own model (later)",
  billboard: "billboards belong to the facades' neon",
  note: "a note, no object",
};

/**
 * Monuments and artworks of the drawn kinds left out by their OSM tags (`props-art.ts`, G-149):
 * what is not free-standing, and why.
 */
export const SKIPPED_ART = {
  plaque: "a plaque sits flat on a facade, not on the pavement",
  stolperstein: "a stumbling stone lies flush in the pavement",
  mural: "a mural is painted on a facade",
  graffiti: "graffiti is painted on a facade",
  mosaic: "a mosaic is laid in a wall or in the paving",
  relief: "a relief is carved into a facade",
  neon: "a neon hangs on a facade, with the facades' signs (ADR-0044)",
  rope: "the figure hangs on a wire high over the street; it needs its own model",
} as const;

/** The street prop a plan kind becomes, or null when it is left out. */
export const propOf = (kind: string): StreetPropKind | null => {
  if ((SAME as readonly string[]).includes(kind)) return kind as StreetPropKind;
  return MAPPED[kind]?.prop ?? null;
};

/** Every kind of the plan is either drawn or left out with a reason. */
export const knownKind = (kind: string): boolean => propOf(kind) !== null || kind in SKIPPED;

/**
 * Shapes chosen by the low bits of `variant` (ADR-0047), the same table as the renderer's
 * `PROP_SHAPES`: monument and artwork 0 obelisk, 1 figure on a plinth, 2 Koziołek, 3 abstract,
 * 4 stele with a tablet, 5 wayside shrine (all picked from the tags, `props-art.ts`);
 * flagpole 0 ordinary, 1 tall mast; tree 0 lime, 1 maple, 2 horse chestnut; bench 0 slatted
 * bench without a back, 1 with a back; advertising column 0 graphite, 1 the yellow one with a dome.
 */
export const SHAPES: Readonly<Partial<Record<StreetPropKind, number>>> = { monument: 6, artwork: 6, flagpole: 2, tree: 3, bench: 2, "advertising-column": 2 };

/** `hash` with its shape forced to `shape` (kept within 16 bits). */
export const withShape = (hash: number, kind: StreetPropKind, shape: number): number => {
  const n = SHAPES[kind] ?? 1;
  const h = hash & 0xffff;
  const v = h - (h % n) + shape;
  return v > 0xffff ? v - n : v;
};

/** Kinds that may stand on a building outline: the wall-mounted ones. */
export const ON_BUILDINGS: ReadonlySet<StreetPropKind> = new Set(["lamp-wall-lantern", "cctv"]);

/** How far the bulky free-standing pieces keep from the walls (m): about their footprint's radius. */
export const WALL_ROOM: Partial<Record<StreetPropKind, number>> = {
  artwork: 1.5,
  monument: 1.5,
  kiosk: 1.7,
  "bus-shelter": 2,
  bench: 1.2,
  "vending-machine": 0.7,
  "advertising-column": 0.8,
  floodlight: 0.4,
  // ADR-0058 stage 2: a cash machine's back by the wall, a rack with its bikes, the long pieces
  // by the radius of their solid less the glitch scan's 0.3 m.
  atm: 0.5,
  "bike-rack": 1.1,
  "food-cart": 1.9,
  container: 3,
  // ADR-0058 stage 3: a booth's centre 1.35 m out with its back posts by the wall, the stock by its stall.
  "food-stall": 1.3,
  "market-goods": 0.5,
};

/**
 * How far a piece may be moved out from a wall (m), beyond the default 4: the plan sketches the
 * floodlights on the lit building's outline, up to 8 m inside the Trinitarian Tower.
 */
export const WALL_REACH: Partial<Record<StreetPropKind, number>> = { floodlight: 10 };

/** How far a piece may end up from its point in the plan (m), at most. */
export const MAX_MOVE: Partial<Record<StreetPropKind, number>> = { hydrant: 3, "food-stall": 1, "market-goods": 0.1 };

/** Kinds of ADR-0058 stages 2 and 3 that never stand in the carriageway, even moved out of a wall. */
export const KERB_SHY: ReadonlySet<StreetPropKind> = new Set(["atm", "hydrant", "food-cart", "container", "market-goods", "food-stall"]);
