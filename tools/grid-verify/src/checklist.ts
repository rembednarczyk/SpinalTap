/**
 * The checklist of a new grid of map chunks (`.claude/skills/nowa-siatka/SKILL.md`): each point a phase, what it asks
 * and how it is settled. An automatic point is a command whose exit says it; a decision is the person's or the
 * curator's, written in the grid's declaration (`docs/siatki/<name>.json`, `decyzje`) with a reference. Each point
 * comes from something a row of chunks got wrong before (the reason in `skad`).
 */

export type Phase = "dane" | "import" | "grunt i ruch" | "skan" | "topografia i treść" | "wygląd i wydajność" | "bramki" | "dokumentacja";

export interface Check {
  readonly id: string;
  readonly faza: Phase;
  readonly opis: string;
  /** What taught the point (a glitch, a T-row, a PR). */
  readonly skad: string;
  /** A command run by `grid:verify`, its exit 0 the point green; none: a decision in the declaration. */
  readonly komenda?: readonly string[];
  /** Run only with `--full` (the slow gates). */
  readonly pelne?: true;
}

const vitest = (...files: string[]): string[] => ["pnpm", "exec", "vitest", "run", ...files];

export const CHECKS: readonly Check[] = [
  { id: "deklaracja", faza: "dane", opis: "Chunki siatki są w rejestrze pokrycia (docs/mapa-pokrycie.json) ze statusem", skad: "rząd Podzamcza 23.11: komórki nieprzejrzane poza sumami skanu" },
  { id: "nmt", faza: "dane", opis: "Edycja NMT sprawdzona; mozaika porównana z NMPT i z sąsiednimi chunkami", skad: "T-343 (dwie edycje NMT w jednej mozaice)" },
  { id: "brzeg", faza: "dane", opis: "Budynki ścięte na brzegu mapy przejrzane, zwłaszcza zabytki z małym kawałkiem obrysu", skad: "T-250, T-342 (kościół św. Eliasza: 13% obrysu)" },
  { id: "tablice", faza: "import", opis: "Tablice są tym, co piszą generatory (osm:build, osm:props)", skad: "#979: zapomniany osm:props", komenda: ["pnpm", "tables:check"] },
  { id: "skan-siatka", faza: "skan", opis: "Nowe miejsca skanu glitchy w chunkach siatki: każde naprawione, zgłoszone albo przyjęte z odnośnikiem", skad: "ADR-0054; G-962–G-965 z rzędu Podzamcza" },
  { id: "skan-poza", faza: "skan", opis: "Poza siatką skan bez nowych miejsc (szew, stare komórki)", skad: "szew z 580 rzędu Podzamcza" },
  { id: "grunt-ruch", faza: "grunt i ruch", opis: "Pasy aut na jezdni, cały ruch miasta, terytoria (ground-readers, traffic, territory)", skad: "G-962, G-966 (zmiana pasów przestawia rozkład w całym mieście), #984", komenda: vitest("packages/sim/test/ground-readers.test.ts", "packages/sim/test/traffic", "packages/sim/test/territory-groups.test.ts") },
  { id: "sondy", faza: "grunt i ruch", opis: "Sondy siatki: schody na jezdni", skad: "G-963 (schody Szkolnej na pasie ruchu)" },
  { id: "lokacje", faza: "topografia i treść", opis: "Każde miejsce gry w siatce należy do lokacji z kartą (rejestr LOCATIONS)", skad: "ADR-0102", komenda: vitest("tools/rooms/test/locations.test.ts") },
  { id: "kurator", faza: "topografia i treść", opis: "Przegląd agenta topography-curator: wiersze T, nazwy i kierunki ulic, zabytki, terytoria z dala od kościołów i miejsc pamięci, meble wobec ortofotomapy", skad: "CLAUDE.md (Topografia Lublina), #984, G-964" },
  { id: "karty", faza: "topografia i treść", opis: "Nowe miejsca mają karty lokacji; sceny, którym brakuje siatek, najpierw na mapę", skad: "ADR-0102; decyzja użytkownika 23.11" },
  { id: "zrzuty", faza: "wygląd i wydajność", opis: "Zrzuty dzień i noc z wysokości oczu (grunt + 1,7 m) w ujęciach siatki obejrzane", skad: "ujęcia z wysokością bezwzględną (23.11)" },
  { id: "npr-perf", faza: "wygląd i wydajność", opis: "Migawka NPR i budżety na spokojnej maszynie", skad: "test P-2 pod obciążeniem (#988)", komenda: ["pnpm", "e2e", "e2e/npr-perf.spec.ts"], pelne: true },
  { id: "bramki", faza: "bramki", opis: "typecheck, lint, depcheck, test:coverage, build", skad: "Definition of Done", komenda: ["sh", "-c", "pnpm typecheck && pnpm lint && pnpm depcheck && pnpm test:coverage && pnpm build"], pelne: true },
  { id: "dokumentacja", faza: "dokumentacja", opis: "Rejestr glitchy, topografia.md, mapa-pokrycie.json, backlog i changelog zaktualizowane", skad: "CLAUDE.md (Start nowej sesji)" },
];
