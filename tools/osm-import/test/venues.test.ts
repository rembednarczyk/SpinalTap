import { describe, expect, it } from "vitest";
import { isSignText } from "../../../packages/core/src/world/venues.ts";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { loadInputs } from "../src/load.ts";
import { parseOsmXml } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";
import { GENERIC_NAMES, VENUE_NAMES, venueEntry } from "../src/venue-names.ts";
import { likeness } from "./name-likeness.ts";
import { KIT_NEON, type WorldVenue, assignVenues, parseColour, toKitNeon, venueKind } from "../src/venues.ts";

/** Lower case, no diacritics, punctuation as spaces: how a name reads to the eye. */
const plain = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/gi, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Chains and brands that never go on a sign (ADR-0058); the map's `brand` tags join them below. */
const FORBIDDEN = [
  "Żabka", "Biedronka", "Lidl", "McDonald's", "KFC", "Rossmann", "Orlen", "PKO", "PKO BP", "Pekao", "Starbucks", "Costa", "Burger King", "Millennium", "mBank", "Alior",
  "Stokrotka", "Lewiatan", "Społem", "Ziko", "Dr Max", "Grycan", "Wedel", "Oriflame", "Yves Rocher", "Itaka", "Empik", "Tavex", "STS", "Lotto", "Pasibus", "Erste",
  "DeFacto", "Bookland", "Hebe", "Carrefour", "Netto", "Dino", "Kaufland", "Subway", "Pizza Hut", "Costa Coffee", "Vistula", "Reserved", "Apart", "W. Kruk",
  // The verifier's list of 1.11: chains of Lublin and registered marks.
  "Oskroba", "Świat Książki", "VIVO!", "Esens", "Manekin", "Bosko", "Nova", "Plus", "Ruch", "Dbam o Zdrowie", "Mennica Polska", "Wschodni Bank Spółdzielczy",
  "Bank Pocztowy", "Pijalnia Wódki i Piwa", "Pijalnia Czekolady", "Rosomak", "BOŚ", "SKOK", "Loombard", "Chmielewski", "Grela", "Pijana Wiśnia", "Gemini", "Tendur",
];

/** Parodies that sound like a mark without a phonetic rule catching them, written by hand. */
const SOUNDS_LIKE = ["Iw Rosze", "Iwroszer", "Makdonalds", "Makdron", "Rossman", "Starbaks", "Pekało"];

/** A tag stuck on a real name to make it "2077" (1.11: not a parody). */
const STUCK_ON = /(^|[\s-])(BOT|NET|AI|EXE|NEO|X|ONLINE|\d*77|2\.0)($|[\s-])/;

const inputs = loadInputs();
const mapped = [...inputs.osm.nodes.values()].map((n) => n.tags).concat([...inputs.osm.ways.values()].map((w) => w.tags));
const venueTags = mapped.filter((t) => t !== undefined && venueKind(t) !== null);
const brands = [...new Set(venueTags.flatMap((t) => (t!.brand ? [t!.brand] : [])))];

describe("the venue-names table (ADR-0064 stage 4)", () => {
  const names2077 = [...VENUE_NAMES.map(([, n]) => n), ...Object.values(GENERIC_NAMES).flat()];
  const osmNames = new Set([...VENUE_NAMES.map(([o]) => plain(o)), ...venueTags.flatMap((t) => (t!.name ? [plain(t!.name)] : []))]);

  it("gives every named venue of the map a 2077 name", () => {
    const missing = [...new Set(venueTags.flatMap((t) => (t!.name && !venueEntry(t!.name, venueKind(t!)!, "x").named ? [t!.name] : [])))];
    expect(missing).toEqual([]);
    expect(VENUE_NAMES.length).toBeGreaterThanOrEqual(300);
  });

  it("never plays on a venue's own map name by a letter, a sound or a word of it", () => {
    expect(VENUE_NAMES.flatMap(([osm, name]) => likeness(name, osm) ?? [])).toEqual([]);
  });

  it("never plays on a chain by a letter, a sound or a word of it, the map's brands and the verifier's list included", () => {
    const chains = [...new Set([...FORBIDDEN, ...SOUNDS_LIKE, ...brands])];
    expect(names2077.flatMap((n) => chains.flatMap((c) => likeness(n, c) ?? []))).toEqual([]);
  });

  it("is a new name, not the real one with a tag stuck on", () => {
    expect(names2077.filter((n) => STUCK_ON.test(n))).toEqual([]);
  });

  it("tells a parody from its source by sound, not by the letters alone", () => {
    expect(likeness("BURGER KONG", "Burger King")).not.toBeNull();
    expect(likeness("GRYZAN", "Grycan")).not.toBeNull();
    expect(likeness("BANK PEKAŁO", "Bank Pekao")).not.toBeNull();
    expect(likeness("WIWO-WIWO!", "VIVO!")).not.toBeNull();
    expect(likeness("DE-FAKTO", "DeFacto")).not.toBeNull();
    expect(likeness("SUPERNOVA", "Nova")).not.toBeNull();
    expect(likeness("KRÓL KOTLETA", "Burger King")).toBeNull();
    expect(likeness("BANK POD ŻUBREM", "Bank Pekao")).toBeNull();
  });

  it("never writes a map name as it is, whatever the case and the diacritics", () => {
    expect(names2077.filter((n) => osmNames.has(plain(n)))).toEqual([]);
  });

  it("spells every name in the sign glyphs and gives no two venues the same one", () => {
    expect(names2077.filter((n) => !isSignText(n))).toEqual([]);
    const own = VENUE_NAMES.map(([, n]) => n);
    expect(own.filter((n, i) => own.indexOf(n) !== i)).toEqual([]);
    expect(new Set(VENUE_NAMES.map(([o]) => o)).size).toBe(VENUE_NAMES.length);
  });

  it("gives a venue without a name a generic one of its kind, the same on every import", () => {
    const a = venueEntry(undefined, "pharmacy", "w1");
    expect(a.named).toBe(false);
    expect(GENERIC_NAMES.pharmacy).toContain(a.name);
    expect(venueEntry(undefined, "pharmacy", "w1")).toEqual(a);
    expect(venueEntry("Nobody's Café", "cafe", "n7").named).toBe(false);
  });
});

describe("venue kinds and colours", () => {
  it("sorts shops, cafés, bars, banks, pharmacies and clubs; street furniture and vacant shops are none", () => {
    expect(venueKind({ shop: "convenience" })).toBe("grocery");
    expect(venueKind({ shop: "pastry" })).toBe("bakery");
    expect(venueKind({ shop: "tattoo" })).toBe("shop");
    expect(venueKind({ amenity: "nightclub" })).toBe("club");
    expect(venueKind({ amenity: "pharmacy" })).toBe("pharmacy");
    expect(venueKind({ amenity: "bureau_de_change" })).toBe("exchange");
    expect(venueKind({ amenity: "atm" })).toBeNull();
    expect(venueKind({ amenity: "bench" })).toBeNull();
    expect(venueKind({ shop: "vacant" })).toBeNull();
  });

  it("reads OSM colours and brings every colour to the kit's neon by hue", () => {
    expect(parseColour("#F00")).toBe("#ff0000");
    expect(parseColour("green;white")).toBe("#00a000");
    expect(parseColour("tartan")).toBeNull();
    expect(toKitNeon("#e30613")).toBe("#ff4040");
    expect(toKitNeon("#003574")).toBe("#3f8cff");
    expect(toKitNeon("#00704a")).toBe("#39ff8a");
    expect(toKitNeon("#ffc72c")).toBe("#ffb000");
    expect(toKitNeon("#e4007c")).toBe("#ff2e88");
    expect(toKitNeon("#1d1d1b")).toBe("#c9dcf2");
    for (const [, , c] of VENUE_NAMES) if (c) expect(KIT_NEON).toContain(toKitNeon(c));
  });
});

const venue = (id: string, x: number, z: number, building?: string): WorldVenue => ({
  id,
  at: { x, z },
  kind: "cafe",
  name: `KAWA ${id}`,
  named: false,
  color: "#ffb000",
  colourFrom: "kind",
  ...(building ? { building } : {}),
});
const box = (id: string, x0: number, z0: number, x1: number, z1: number) => ({ id, ring: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }] });

describe("venues on the facades", () => {
  const hosts = [box("w2", 0, 0, 20, 10), box("w1", 30, 0, 50, 10), box("w3", 2, 2, 8, 8)];

  it("go on the building around them, the smallest one when outlines nest", () => {
    const got = assignVenues([venue("n1", 10, 9), venue("n2", 5, 5), venue("n3", 40, 5)], hosts);
    expect(got.get("w2")?.map((v) => v.id)).toEqual(["n1"]);
    expect(got.get("w3")?.map((v) => v.id)).toEqual(["n2"]);
    expect(got.get("w1")?.map((v) => v.id)).toEqual(["n3"]);
  });

  it("go on the nearest wall within reach when mapped on the pavement, and nowhere further off", () => {
    const got = assignVenues([venue("n1", 10, 14), venue("n2", 23, 5), venue("n3", 10, 30)], hosts);
    expect(got.get("w2")?.map((v) => v.id)).toEqual(["n1", "n2"]);
    expect([...got.values()].flat().some((v) => v.id === "n3")).toBe(false);
  });

  it("go on their own outline when the map draws the venue as the building", () => {
    expect(assignVenues([venue("w1", 40, 5, "w1"), venue("w9", 4, 4, "w1")], hosts).get("w1")?.map((v) => v.id)).toEqual(["w1", "w9"]);
  });

  it("reach the chunk as the building's own, relative to its centre, with the 2077 name and the neon", () => {
    const node = (id: number, x: number, z: number, tags = "") => {
      const g = worldToGeo({ x, z });
      return ` <node id="${id}" lat="${g.lat}" lon="${g.lon}">${tags}</node>`;
    };
    const osm = parseOsmXml(
      [
        "<osm>",
        node(1, 10, 10),
        node(2, 30, 10),
        node(3, 30, 25),
        node(4, 10, 25),
        node(5, 20, 12, '<tag k="shop" v="convenience"/><tag k="name" v="Żabka"/>'),
        node(6, 20, 29, '<tag k="amenity" v="bank"/><tag k="name" v="PKO BP"/><tag k="brand:colour" v="#ff00ff"/>'),
        ' <way id="100"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="building" v="apartments"/></way>',
        "</osm>",
      ].join("\n"),
    );
    const g = generate(osm, () => 190, [{ id: "t-0-0", district: DISTRICTS[0]!, rect: { minX: -50, minZ: -50, maxX: 150, maxZ: 150 } }]);
    const b = g.chunks[0]!.buildings[0]!;
    expect(b.venues).toEqual([
      { x: 0, z: -5.5, kind: "grocery", name: "RZEKOTKA", color: "#39ff8a" },
      { x: 0, z: 11.5, kind: "bank", name: "SKARBONKA NARODOWA", color: "#b46cff" },
    ]);
    expect(g.venues).toMatchObject({ total: 2, signed: 2, named: 2, colourOsm: 1, colourTable: 1, colourKind: 0 });
  });

  it("sign nearly all of the city's venues", () => {
    const g = generate(inputs.osm, inputs.src);
    expect(g.venues.total).toBeGreaterThan(300);
    expect(g.venues.signed / g.venues.total).toBeGreaterThan(0.97);
    expect(g.chunks.filter((c) => DISTRICTS.some((d) => d.id === c.district)).flatMap((c) => c.buildings.flatMap((b) => b.venues ?? [])).length).toBe(g.venues.signed);
  });
});
