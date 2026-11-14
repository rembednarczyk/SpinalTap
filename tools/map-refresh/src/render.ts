import type { Change, Report, WidthStats } from "./report.ts";

/**
 * The report as Markdown for a person and a pull request's description (pure, in Polish like the
 * other reports of the agents). Long lists are cut to `MOST` lines; the JSON beside it keeps all.
 */

const MOST = 30;

const cut = (lines: readonly string[], most = MOST): string[] => [...lines.slice(0, most), ...(lines.length > most ? [`- … i ${lines.length - most} więcej (pełna lista w reports/map-refresh.json)`] : [])];
const signed = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}`;
const size = (b: number | null) => (b === null ? "brak" : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MiB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KiB` : `${b} B`);
const change = (c: Change<number>, unit = "") => `${c.before}${unit} -> ${c.after}${unit} (${signed(c.after - c.before)})`;

const widthLine = (w: Record<string, number>) => {
  const all = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.entries(w)
    .map(([k, m]) => `${k} ${(m / 1000).toFixed(2)} km (${all > 0 ? ((100 * m) / all).toFixed(1) : "0.0"}%)`)
    .join(", ");
};

const widths = (c: Change<WidthStats | null>): string[] => {
  if (!c.after) return ["- brak liczb (krok osm-build nie przebiegł)"];
  const out: string[] = [];
  for (const k of ["streets", "all"] as const) {
    const label = k === "streets" ? "ulice" : "z drogami serwisowymi";
    const [b, a] = [c.before ? widthLine(c.before[k]) : null, widthLine(c.after[k])];
    out.push(b === null ? `- ${label}: ${a}` : b === a ? `- ${label}: bez zmian, ${a}` : `- ${label}: przed ${b}; po ${a}`);
  }
  return out;
};

const section = (title: string, lines: readonly string[]) => (lines.length ? ["", `## ${title}`, "", ...lines] : []);

const scanLines = (r: Report): string[] => {
  if (!r.scan.ran) return ["- skan nie przebiegł"];
  if (!r.scan.kinds.length) return ["- żaden klucz nie przybył ani nie ubył"];
  return r.scan.kinds.flatMap((k) => [
    `- ${k.kind} (${k.severity}): suma ${k.before} -> ${k.after}, przybyło ${k.added.length}, ubyło ${k.removed.length}`,
    ...cut(k.added.map((a) => `  - \`+ ${a}\``), 10),
    ...cut(k.removed.map((a) => `  - \`- ${a}\``), 5),
  ]);
};

const hashLines = (r: Report): string[] => {
  if (!r.hashes.ran) return ["- hashes:check nie przebiegł"];
  if (!r.hashes.rows.length) return ["- wszystkie skróty zgodne"];
  return r.hashes.rows.map((h) => `- ${h.file} (${h.test}): ${h.verdict}${h.hashes.length ? `, ${h.hashes.join(", ")}` : ""}${h.numbersChanged.length ? `, liczby: ${h.numbersChanged.join(", ")}` : ""}`);
};

const ortoLines = (r: Report): string[] => {
  if (!r.orto) return ["- nie liczony (tablice bez zmian albo --skip=orto-diff)"];
  const o = r.orto;
  const cells = Object.entries(o.addedM2ByCell).map(([c, m]) => `${c} ${m}`);
  return [`- nawierzchnia na klasach ortofoto: zmienione ${o.changedM2} m²${cells.length ? ` (komórki, m² dodane: ${cells.join(", ")})` : ""}`, `- teren: największe przesunięcie ${o.terrainMaxAbs} m`, `- pomosty zmienione: ${o.decksChanged}`];
};

export const renderReport = (r: Report): string => {
  const v = r.verdict;
  const t = v.thresholds;
  const lines = [
    "# Odświeżenie mapy (`pnpm map:refresh`)",
    "",
    `Baza: \`${r.base}\`. Tryb: ${r.mode.offline ? "offline (bez sieci)" : "online"}, źródła: ${r.mode.sources.join(", ")}.`,
    "",
    `## Werdykt: ${v.review ? "**przegląd kuratora**" : "**bez przeglądu**"}`,
    "",
    ...(v.reasons.length ? v.reasons.map((x) => `- ${x}`) : ["- wszystko poniżej progów"]),
    ...section("Miejsca do przeglądu", cut(v.places.map((p) => `- ${p}`))),
    ...section(
      "Kroki",
      r.steps.map((s) => `- ${s.id}: ${s.status === "ran" ? "wykonany" : s.status === "failed" ? "NIEUDANY" : "pominięty"}${s.note ? ` (${s.note})` : ""}`),
    ),
    ...section(`Zmienione pliki (${r.files.length})`, r.files.length ? cut(r.files.map((f) => `- ${f.path}: ${size(f.before)} -> ${size(f.after)}`)) : ["- żaden"]),
    ...(r.restored.length ? ["", `Przywrócone (różniły się tylko datą pobrania): ${r.restored.join(", ")}.`] : []),
    ...section("Obiekty według rodzaju", [`- razem: ${change(r.objectsTotal)}`, ...cut(Object.entries(r.objects).map(([k, c]) => `- ${k}: ${change(c)}`))]),
    ...section("Nawierzchnia w tablicach (m²)", [
      `- przesunięte razem: ${r.surfaceMovedM2} m²`,
      ...Object.entries(r.surfaces).map(([k, c]) => `- ${k}: ${change(c)}`),
      ...cut(Object.entries(r.surfaceByChunk).map(([c, m]) => `- kawałek ${c}: ${m} m²`)),
    ]),
    ...section("Skan glitchy (klucze przybyłe i ubyłe wg rodzaju)", scanLines(r)),
    ...section("Testy złote (`pnpm hashes:check`)", hashLines(r)),
    ...section("Źródła szerokości jezdni (ADR-0080)", widths(r.widths)),
    ...section("orto:diff (ADR-0077)", ortoLines(r)),
    ...section("Progi", [
      `„Bez przeglądu”, gdy wszystkie kroki się udały, skan przebiegł bez nowego klucza w rodzaju S1–S3, obiektów razem przybyło lub ubyło mniej niż ${t.objectsShare * 100}%, żaden rodzaj nie zmienił się o więcej niż max(${t.kindShare * 100}%, ${t.kindMin}), nawierzchni przesunęło się mniej niż ${t.surfaceM2} m² (w tablicach i w orto:diff), teren nie ruszył się o więcej niż ${t.terrainM} m, żaden pomost się nie zmienił, a testy złote różnią się co najwyżej samym skrótem (wtedy \`pnpm hashes:check --write\`).`,
    ]),
  ];
  return `${lines.join("\n")}\n`;
};
