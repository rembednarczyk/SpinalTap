/**
 * Venues on the ground floors of Lublin (ADR-0064 stage 4): the kinds the importer sorts the
 * map's shops, cafés, bars, banks and the rest into, and the letters their signs are written in.
 */

/** What a venue is, coarse enough for a sign and a word for the player. */
export const VENUE_KINDS = [
  "restaurant",
  "fast-food",
  "cafe",
  "ice-cream",
  "bar",
  "pub",
  "club",
  "bank",
  "exchange",
  "pharmacy",
  "bakery",
  "grocery",
  "books",
  "jewelry",
  "optician",
  "hairdresser",
  "beauty",
  "clothes",
  "art",
  "mall",
  "shop",
] as const;

export type VenueKind = (typeof VENUE_KINDS)[number];

/** The catalog key of a venue kind's word for the player (ADR-0056): `venue.kind.cafe`. */
export const venueKindKey = (kind: VenueKind): string => `venue.kind.${kind}`;

/** Polish capitals by code point (Ą Ć Ę Ł Ń Ó Ś Ź Ż): letters of the city's signs, not text for the player (ADR-0056). */
const POLISH_CAPITALS = String.fromCharCode(0x104, 0x106, 0x118, 0x141, 0x143, 0xd3, 0x15a, 0x179, 0x17b);

/**
 * Every letter a venue's sign can show, upper case: the renderer draws exactly these into its
 * glyph atlas, so a 2077 name is spelt in them (the importer's test holds the names to it).
 */
export const SIGN_GLYPHS = `ABCDEFGHIJKLMNOPQRSTUVWXYZ${POLISH_CAPITALS}0123456789 &'!+-./\u00b7:#*?`;

/** Whether a name can go on a sign: every letter of its upper case is a glyph of the atlas. */
export const isSignText = (name: string): boolean => name.length > 0 && [...name.toUpperCase()].every((c) => SIGN_GLYPHS.includes(c));
