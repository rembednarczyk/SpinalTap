import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { textsOf } from "./texts";

/**
 * The language scan (ADR-0056): lines of `packages/<name>/src` whose string literals, template
 * text or JSX text (as the TypeScript parser sees them) read as Polish: a Polish letter or a word
 * from `POLISH_WORDS`. Text JSX shows as it is (G-243) counts whatever its letters, unless it is
 * made of `SHOWN_WORDS` and signs; other text with neither is not counted. The catalogs (`i18n/`), the ink sources, generated files and
 * tests are not counted, nor are the data files of Lublin's proper names listed in `EXCEPTIONS`.
 */

export interface Finding {
  /** Repository path, `packages/ui/src/hud/hud.tsx`. */
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** Polish letters; no English text has them. */
const DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * Frequent Polish words spelled without diacritics, none of them an English word or a likely
 * identifier, so a text such as "Nowa gra" or "Kontrakt dla Kaito" is caught too.
 */
export const POLISH_WORDS: readonly string[] = [
  "nie", "jest", "oraz", "albo", "tylko", "przez", "teraz", "gdzie", "jeszcze", "dla", "bez", "jak", "czy", "lub", "ale",
  "tak", "przy", "nad", "pod", "mnie", "ciebie", "nowa", "nowy", "gra", "gry", "wczytaj", "zapisz", "wyjdz", "kup", "sprzedaj",
  "zadanie", "kontrakt", "zlecenie", "dzien", "noc", "broni", "bron", "klawisz", "ustawienia", "wroc", "pomoc", "zamknij", "pusty", "brak", "zapis",
  "ruch", "skan", "pozycja", "ostatnia", "znana", "mapa", "gracz", "postac", "dalej", "wstecz", "anuluj", "potwierdz", "wybierz", "strzal", "skok", "kucnij",
  "biegnij", "atak", "przeladuj", "dziennik", "zadania", "ekwipunek", "sklep", "pieniadze", "zycie", "pancerz", "wrog", "wrogowie", "wyjscie", "pauza",
  "opcje", "sterowanie", "dzwiek", "muzyka", "glosnosc", "jezyk", "trudnosc", "rozmawiaj", "otworz", "uzyj", "podnies", "wez", "idz", "juz", "sie",
];
const WORDS = new RegExp(`(?:^|[^\\p{L}])(?:${POLISH_WORDS.join("|")})(?![\\p{L}])`, "iu");

/** An id such as "hebi-rynek-noc" or "ui.save": one token joined by - _ . : or /, never shown. */
const ID = /^[\w-]*[-_.:/][\w./:-]*$/;

export const isPolish = (text: string): boolean => DIACRITICS.test(text) || (!ID.test(text.trim()) && WORDS.test(text));

/**
 * Words JSX may show as they are, the same in every language (ADR-0056), each with its reason.
 * Keys, units and the game's own names: a shown text made only of these, of single capital
 * letters (key caps such as "E") and of signs (digits, "€$", "·", "✕") needs no catalog. A
 * sentence never belongs here: it goes to the catalogs.
 */
export const SHOWN_WORDS: readonly (readonly [word: string, why: string])[] = [
  ["Enter", "The key cap of a contract's accept key, as printed on the keyboard."],
  ["Tab", "The key cap of the tab switch in the journal and the character sheet."],
  ["II", "The pause glyph of the touch pad: two bars, not a word."],
  ["s", "The seconds unit after a cooldown number in the body HUD."],
  ["m", "The metres unit after a distance number on the minimap."],
  ["HP", "Hit points, the genre's abbreviation, the same in the Polish catalog."],
  ["RAM", "The cyberdeck's memory, kept as RAM in the Polish catalog too (scan.ram)."],
  ["SEKI", "The game's title, SEKI SENSHI, on the title screen."],
  ["SENSHI", "The game's title, SEKI SENSHI, on the title screen."],
  ["関", "The game's title in Japanese, 関 戦士, on the title screen."],
  ["戦士", "The game's title in Japanese, 関 戦士, on the title screen."],
  ["KIROSHI", "The brand of the scanner optics, an in-world name."],
  ["Breach", "Breach Protocol, the name of the hacking minigame, kept in both catalogs."],
  ["Protocol", "Breach Protocol, the name of the hacking minigame, kept in both catalogs."],
  ["FLATLINE", "The genre's word for death on the death screen, an in-world term."],
];
const SHOWN = new Set(SHOWN_WORDS.map(([w]) => w));

/** Whether a text JSX shows as it is needs the catalog: it has a word that is no key, unit or name. */
export const needsCatalog = (text: string): boolean => (text.match(/\p{L}+/gu) ?? []).some((w) => !SHOWN.has(w) && !/^\p{Lu}$/u.test(w));

/** Directories and files never scanned: the catalogs themselves, ink, generated code. */
const SKIPPED_DIRS = new Set(["i18n", "ink", "node_modules", "test"]);
const isSkippedFile = (name: string): boolean => /\.generated\.ts$/.test(name) || /\.(test|spec)\.tsx?$/.test(name) || name.endsWith(".d.ts");

/**
 * Data of Lublin's proper names (streets, squares, districts, characters). ADR-0056 keeps them in
 * Polish in every language, so the scan does not count them. Each entry is a repository path,
 * a file or a directory (ending in `/`), with the reason it is here. Text meant for the player
 * (hints, objectives, descriptions) never belongs in this list: it goes to the catalogs.
 */
export const EXCEPTIONS: readonly (readonly [path: string, why: string])[] = [
  ["packages/sim/src/content/lublin/index.ts", "The Lublin districts of the map built from OpenStreetMap, by name."],
  ["packages/sim/src/content/traffic.ts", "Street names of the trolleybus network, matched against the OSM road names."],
  ["packages/sim/src/content/world-map.ts", "The districts' names (Krakowskie Przedmieście, Nabrzeże Bystrzycy)."],
  ["packages/sim/src/content/metro.ts", "Metro station names, named after the districts they stand in."],
  ["packages/engine/src/renderer/mapcity/skyline.ts", "Names of the Lublin districts the far towers stand in (Czechów, al. Kraśnicka)."],
  ["packages/engine/src/renderer/mapcity/canyon-signs.ts", "In-world ads and neon signs; ADR-0056 keeps the city's own signs Polish."],
];

const excepted = (file: string): boolean => EXCEPTIONS.some(([p]) => (p.endsWith("/") ? file.startsWith(p) : file === p));

const sourceFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIPPED_DIRS.has(name)) out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(name) && !isSkippedFile(name)) out.push(path);
  }
  return out;
};

/** Polish lines of one source file and lines JSX shows outside the catalogs, at most one finding per line. */
export const scanSource = (file: string, src: string): Finding[] => {
  const lines = new Map<number, string>();
  for (const t of textsOf(file, src)) if (!lines.has(t.line) && (isPolish(t.text) || (t.shown && needsCatalog(t.text)))) lines.set(t.line, t.text);
  return [...lines].sort(([a], [b]) => a - b).map(([line, text]) => ({ file, line, text: text.trim().slice(0, 120) }));
};

/** Every package under `packages/` with its Polish lines, the excepted data files aside. */
export const scanPackages = (root: string): Record<string, Finding[]> => {
  const out: Record<string, Finding[]> = {};
  const packages = join(root, "packages");
  for (const pkg of readdirSync(packages).sort()) {
    const src = join(packages, pkg, "src");
    try {
      if (!statSync(src).isDirectory()) continue;
    } catch {
      continue;
    }
    const found: Finding[] = [];
    for (const path of sourceFiles(src).sort()) {
      const file = relative(root, path).split(sep).join("/");
      if (!excepted(file)) found.push(...scanSource(file, readFileSync(path, "utf8")));
    }
    out[pkg] = found;
  }
  return out;
};
