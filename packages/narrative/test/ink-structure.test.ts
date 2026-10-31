import { describe, expect, it } from "vitest";
import { INK_EN, INK_FILES, INK_PL, type InkFile, STORY_SOURCES, compileInk } from "../src";

/**
 * The English story has the Polish one's structure (ADR-0056): the same knots, stitches, gathers,
 * choices (count and order), variables, conditions, tags, external calls and diverts. Only the
 * text shown to the player differs. That is what lets a save's ink state load in either language
 * and the language change in the middle of a conversation.
 *
 * Two checks: the source, line by line, with the text taken out (readable failures, and the
 * string literals of the logic compared as written), and the compiled story with every text run
 * taken out (the containers, their indices and the visit-count paths the ink state refers to).
 */

/** Files with no English version yet: they play in Polish. Only ever shrinks, to empty. */
const UNTRANSLATED: readonly InkFile[] = [
  "m4-ulica",
  "phone",
  "enc-shinsekai",
  "enc-kanal",
  "enc-targ",
  "enc-doki",
  "hooks",
  "metro",
  "radio",
];

/**
 * Words with Polish letters the English text may keep: Lublin's proper names (streets, squares,
 * districts, the river), which stay Polish in every language (ADR-0056), and characters' names.
 */
const POLISH_NAMES: ReadonlySet<string> = new Set<string>([
  "Łokietka",
  "Tysiąclecia",
  "Przedmieście",
]);

const POLISH_LETTER = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/** Lines that are logic only, compared as written: `~ x`, `-> y`, `}`, declarations, headers, `else:`. */
const CODE_START = /^(~|->|\}|VAR\s|CONST\s|EXTERNAL\s|INCLUDE\s|===|=\s|else\s*:)/;
/** A condition opening a block or a branch of one, `{ x == "a":`, `- (a || b) && c:`, `- x: -> knot`. */
const BRANCH = /:\s*(->\s*[\w.]+\s*)?$/;
const SPEAKER = /^([A-Z]+):\s*/;
const BULLETS = /^((?:[*+-]\s*)+)/;
const LABEL = /^\(\w+\)\s*/;

interface Shape {
  /** The line without its text: bullets, labels, conditions, speaker, interpolations, tags, diverts. */
  readonly skeleton: string;
  /** The text shown to the player, "" for a code line. */
  readonly text: string;
}

const stripComment = (line: string): string => line.replace(/\s*\/\/.*$/, "");

/** `{...}` groups at the top level of `s`, in order. */
const braces = (s: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (s[i] === "}" && depth > 0) {
      depth--;
      if (depth === 0) out.push(s.slice(start, i + 1));
    }
  }
  return out;
};

const withoutBraces = (s: string): string => braces(s).reduce((acc, b) => acc.replace(b, ""), s);

/** The shape of one source line, or null for a blank or comment-only line. */
const isCode = (rest: string): boolean =>
  rest === "" || CODE_START.test(rest) || withoutBraces(rest).trim() === "" || (BRANCH.test(rest) && !SPEAKER.test(rest) && (/^[{(]/.test(rest) || /[=!<>]=|&&|\|\||\bnot\b/.test(rest)));

/** The shape of one source line, or null for a blank or comment-only line. */
export const shapeOf = (raw: string): Shape | null => {
  const line = stripComment(raw).trim();
  if (line === "") return null;
  const lead = BULLETS.exec(line)?.[1] ?? "";
  const bullets = lead.replace(/\s+/g, "");
  let rest = line.slice(lead.length);
  let head = "";
  const label = LABEL.exec(rest);
  if (label) {
    head += label[0].trim();
    rest = rest.slice(label[0].length);
  }
  if (bullets.startsWith("*") || bullets.startsWith("+")) {
    const cond = /^(\{[^}]*\})\s*/.exec(rest);
    if (cond?.[1]) {
      head += cond[1].replace(/\s+/g, " ");
      rest = rest.slice(cond[0].length);
    }
  }
  if (isCode(rest)) return { skeleton: `${bullets}${head} ${rest}`, text: "" };
  const divert = /\s*(->\s*[\w.]+)\s*$/.exec(rest);
  if (divert?.[1]) rest = rest.slice(0, divert.index);
  // Choice text in [brackets]: only its tags count.
  const bracket = /\[([^\]]*)\]/.exec(rest);
  const choiceTags = bracket ? (bracket[1]?.match(/#[^#\]]*/g) ?? []).map((t) => t.trim()) : [];
  const speaker = SPEAKER.exec(rest);
  const body = speaker ? rest.slice(speaker[0].length) : rest;
  const lineTags = (withoutBraces(body.replace(/\[[^\]]*\]/, "")).match(/#[^#]*/g) ?? []).map((t) => t.trim());
  const skeleton = [bullets, head, speaker ? `${speaker[1]}:` : "", `[${choiceTags.join(" ")}]`, braces(body).join(""), lineTags.join(" "), divert?.[1] ?? ""].join("|");
  const text = withoutBraces(body.replace(/#[^#\]]*/g, " ")).trim();
  return { skeleton, text };
};

const shapes = (source: string): { line: number; shape: Shape }[] =>
  source.split("\n").flatMap((raw, i) => {
    const shape = shapeOf(raw);
    return shape ? [{ line: i + 1, shape }] : [];
  });

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** The compiled story with every text run replaced by "^", tags kept (they are logic: tones). */
const normalized = (node: Json, inTag = { on: false }): Json => {
  if (typeof node === "string") {
    if (node === "#") inTag.on = true;
    if (node === "/#") inTag.on = false;
    return node.startsWith("^") && !inTag.on ? "^" : node;
  }
  if (Array.isArray(node)) return node.map((n) => normalized(n, inTag));
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, normalized(v, inTag)]));
  return node;
};

/** The first path where two JSON trees differ, for a readable failure. */
const firstDifference = (a: Json, b: Json, path = ""): string | null => {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const d = firstDifference((a as Record<string, Json>)[k] ?? null, (b as Record<string, Json>)[k] ?? null, `${path}/${k}`);
      if (d) return d;
    }
  }
  return `${path}: ${JSON.stringify(a)?.slice(0, 160)} vs ${JSON.stringify(b)?.slice(0, 160)}`;
};

const compiled = (source: string): Json => JSON.parse(compileInk(source).ToJson() ?? "null") as Json;

const translated = INK_FILES.filter((f) => INK_EN[f] !== undefined);

describe("ink in every language (ADR-0056)", () => {
  it("has an English file for each Polish one, the untranslated rest listed", () => {
    expect(INK_FILES.filter((f) => INK_EN[f] === undefined)).toEqual(UNTRANSLATED);
    for (const f of INK_FILES) expect(INK_PL[f].length, f).toBeGreaterThan(0);
  });

  it.each(translated)("%s: the English source has the Polish one's structure, line by line", (file) => {
    const pl = shapes(INK_PL[file]);
    const en = shapes(INK_EN[file] ?? "");
    const lines = Math.max(pl.length, en.length);
    for (let i = 0; i < lines; i++) {
      const p = pl[i];
      const e = en[i];
      expect(e?.shape.skeleton, `${file}: en line ${e?.line ?? "-"} against pl line ${p?.line ?? "-"}`).toBe(p?.shape.skeleton);
    }
  });

  it.each(translated)("%s: the English text is English, with no line left empty", (file) => {
    const pl = shapes(INK_PL[file]);
    shapes(INK_EN[file] ?? "").forEach(({ line, shape }, i) => {
      expect(shape.text === "", `${file}: en line ${line} lost its text`).toBe(pl[i]?.shape.text === "");
      const polish = shape.text.split(/[^\p{L}]+/u).filter((w) => POLISH_LETTER.test(w) && !POLISH_NAMES.has(w));
      expect(polish, `${file}: en line ${line}`).toEqual([]);
    });
  });

  it("compiles to the same story in both languages, text aside", () => {
    const pl = normalized(compiled(STORY_SOURCES.pl));
    const en = normalized(compiled(STORY_SOURCES.en ?? ""));
    expect(firstDifference(en, pl)).toBeNull();
  });
});

describe("the structure check itself", () => {
  it("takes the text out and keeps the logic", () => {
    expect(shapeOf("KAITO: Robota czeka, {alias}. #mood")).toEqual({ skeleton: "||KAITO:|[]|{alias}|#mood|", text: "Robota czeka, ." });
    expect(shapeOf("* { has_memory(\"x\") } [Kim jesteś? #tone:main]")?.skeleton).toBe('*|{ has_memory("x") }||[#tone:main]|||');
    expect(shapeOf('    ~ set_alias("Seki Senshi")')).toEqual({ skeleton: ' ~ set_alias("Seki Senshi")', text: "" });
    expect(shapeOf("- quest_step == \"find_fixer\": -> first_meeting")?.text).toBe("");
    expect(shapeOf("- KAITO: Potrzebujesz imienia.")?.skeleton).toBe("-||KAITO:|[]|||");
    expect(shapeOf("- (talk)")?.text).toBe("");
    expect(shapeOf("// a comment")).toBeNull();
  });

  it("tells a moved choice, tag or call apart", () => {
    const a = "* [Who? #tone:main]\n    ~ set_flag(\"a\")\n";
    expect(shapes(a).map((s) => s.shape.skeleton)).not.toEqual(shapes("* [Who? #tone:leave]\n    ~ set_flag(\"a\")\n").map((s) => s.shape.skeleton));
    expect(shapes(a).map((s) => s.shape.skeleton)).not.toEqual(shapes("* [Who? #tone:main]\n    ~ set_flag(\"b\")\n").map((s) => s.shape.skeleton));
    const story = (choices: string) => normalized(compiled(`=== k ===\nHi.\n${choices}`));
    expect(firstDifference(story("* [A]\n  -> END\n* [B]\n  -> END\n"), story("* [X]\n  -> END\n* [Y]\n  -> END\n"))).toBeNull();
    expect(firstDifference(story("* [A]\n  -> END\n* [B]\n  -> END\n"), story("* [A]\n  -> END\n"))).not.toBeNull();
    expect(firstDifference(story("* [A #tone:main]\n  -> END\n"), story("* [A #tone:leave]\n  -> END\n"))).not.toBeNull();
  });
});
