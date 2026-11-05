import type { ProgressionKey } from "../en/progression";
import type { Message } from "../message";

/** Polish texts of the attributes (ADR-0059, stage 2): the English keys. */
export const plProgression = {
  "attribute.section": "Atrybuty",
  "attribute.level": "Poziom {level}",
  "attribute.points": { one: "{count} punkt do rozdania", few: "{count} punkty do rozdania", many: "{count} punktów do rozdania", other: "{count} punktu do rozdania" },
  "attribute.raise": "Podnieś: {name}",
  "attribute.might.name": "Krzepa",
  "attribute.might.effect": "+4 zdrowia i +2% obrażeń wręcz na punkt",
  "attribute.reflex.name": "Refleks",
  "attribute.reflex.effect": "+1% stabilności celowania na punkt, szybsze wejście w celowanie",
  "attribute.tech.name": "Technika",
  "attribute.tech.effect": "+1 pancerza z odzieży na punkt, +1 pojemności cyberware na 3 punkty",
  "attribute.net.name": "Sieć",
  "attribute.net.effect": "+1 RAM na 2 punkty, szybszy upload",
  "attribute.shadow.name": "Cień",
  "attribute.shadow.effect": "Wykrywanie wolniejsze o 2% i +0,5% szansy krytycznej na punkt",
} as const satisfies Readonly<Record<ProgressionKey, Message>>;
