import type { Message } from "../message";

/**
 * English texts of the building sites' information boards (ADR-0087 step 8): the pools the
 * import's generator draws a board's name, developer and term from (`BOARD_KEYS` in
 * `tools/osm-import/src/construction-site.ts`); the sites' table holds the keys. The projects and
 * the companies are fiction.
 */
export const enSite = {
  "site.board.name.0": "Neon Gardens Residence",
  "site.board.name.1": "Lublin Arcology, phase II",
  "site.board.name.2": "Copper Roofs Heights",
  "site.board.name.3": "Bystrzyca Lofts 2.0",
  "site.board.name.4": "Old Town Data Haven",
  "site.board.name.5": "Goat Plaza",
  "site.board.name.6": "Skyline Krakowskie",
  "site.board.name.7": "Cloud Apartments",
  "site.board.developer.0": "Developer: Sakura-Wisła Development",
  "site.board.developer.1": "Developer: Orochi Realty",
  "site.board.developer.2": "Developer: Nowa Unia Budowlana",
  "site.board.developer.3": "Developer: Kumo Estates",
  "site.board.developer.4": "Developer: Lubelska Arkologia S.A.",
  "site.board.developer.5": "Developer: Tetsu Construct",
  "site.board.term.0": "Completion: Q3 2078",
  "site.board.term.1": "Completion: spring 2079",
  "site.board.term.2": "Completion: date under review",
  "site.board.term.3": "Completion: 2080 (delayed)",
} as const satisfies Readonly<Record<string, Message>>;

export type SiteKey = keyof typeof enSite;
