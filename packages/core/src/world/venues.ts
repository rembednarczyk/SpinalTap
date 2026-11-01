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

/**
 * Every letter a venue's sign can show, upper case: the renderer draws exactly these into its
 * glyph atlas, so a 2077 name is spelt in them (the importer's test holds the names to it).
 */
export const SIGN_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZĄĆĘŁŃÓŚŹŻ0123456789 &'!+-./·:#*?";

/** Whether a name can go on a sign: every letter of its upper case is a glyph of the atlas. */
export const isSignText = (name: string): boolean => name.length > 0 && [...name.toUpperCase()].every((c) => SIGN_GLYPHS.includes(c));
