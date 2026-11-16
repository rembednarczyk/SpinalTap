import type { SiteKey } from "../en/site";
import type { Message } from "../message";

/** Polish texts of the building sites' information boards (ADR-0087): the English keys. */
export const plSite = {
  "site.board.name.0": "Rezydencja Neonowe Ogrody",
  "site.board.name.1": "Arkologia Lublin, etap II",
  "site.board.name.2": "Wzgórza Miedzianych Dachów",
  "site.board.name.3": "Lofty nad Bystrzycą 2.0",
  "site.board.name.4": "Przystań Danych Stare Miasto",
  "site.board.name.5": "Plac Koziołka",
  "site.board.name.6": "Panorama Krakowskie",
  "site.board.name.7": "Apartamenty Chmura",
  "site.board.developer.0": "Deweloper: Sakura-Wisła Development",
  "site.board.developer.1": "Deweloper: Orochi Realty",
  "site.board.developer.2": "Deweloper: Nowa Unia Budowlana",
  "site.board.developer.3": "Deweloper: Kumo Estates",
  "site.board.developer.4": "Deweloper: Lubelska Arkologia S.A.",
  "site.board.developer.5": "Deweloper: Tetsu Construct",
  "site.board.term.0": "Zakończenie: III kwartał 2078",
  "site.board.term.1": "Zakończenie: wiosna 2079",
  "site.board.term.2": "Zakończenie: termin w weryfikacji",
  "site.board.term.3": "Zakończenie: 2080 (opóźnione)",
} as const satisfies Readonly<Record<SiteKey, Message>>;
