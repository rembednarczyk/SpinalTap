import type { Locale } from "@seki/core";
import type { StorySources } from "./language";
import m0Pl from "../ink/pl/m0.ink?raw";
import m3EchoPl from "../ink/pl/m3-echo.ink?raw";
import m3LustroPl from "../ink/pl/m3-lustro.ink?raw";
import m4TargPl from "../ink/pl/m4-targ.ink?raw";
import m4OyajiPl from "../ink/pl/m4-oyaji.ink?raw";
import m4DokiPl from "../ink/pl/m4-doki.ink?raw";
import m4UlicaPl from "../ink/pl/m4-ulica.ink?raw";
import dayCyclePl from "../ink/pl/day-cycle.ink?raw";
import phonePl from "../ink/pl/phone.ink?raw";
import encShinsekaiPl from "../ink/pl/enc-shinsekai.ink?raw";
import encKanalPl from "../ink/pl/enc-kanal.ink?raw";
import encTargPl from "../ink/pl/enc-targ.ink?raw";
import encDokiPl from "../ink/pl/enc-doki.ink?raw";
import hooksPl from "../ink/pl/hooks.ink?raw";
import metroPl from "../ink/pl/metro.ink?raw";
import radioPl from "../ink/pl/radio.ink?raw";
import m0En from "../ink/en/m0.ink?raw";

/**
 * The ink files of the build in story order, one per dialogue group (knots are the dialogue ids).
 * Wave 2 (ADR-0032) starts at `enc-shinsekai`: street encounters, observation hooks, metro and radio.
 */
export const INK_FILES = [
  "m0",
  "m3-echo",
  "m3-lustro",
  "m4-targ",
  "m4-oyaji",
  "m4-doki",
  "m4-ulica",
  "day-cycle",
  "phone",
  "enc-shinsekai",
  "enc-kanal",
  "enc-targ",
  "enc-doki",
  "hooks",
  "metro",
  "radio",
] as const;
export type InkFile = (typeof INK_FILES)[number];

/** Each file as written (`ink/pl`), the source of truth for the structure. */
export const INK_PL: Readonly<Record<InkFile, string>> = {
  "m0": m0Pl,
  "m3-echo": m3EchoPl,
  "m3-lustro": m3LustroPl,
  "m4-targ": m4TargPl,
  "m4-oyaji": m4OyajiPl,
  "m4-doki": m4DokiPl,
  "m4-ulica": m4UlicaPl,
  "day-cycle": dayCyclePl,
  "phone": phonePl,
  "enc-shinsekai": encShinsekaiPl,
  "enc-kanal": encKanalPl,
  "enc-targ": encTargPl,
  "enc-doki": encDokiPl,
  "hooks": hooksPl,
  "metro": metroPl,
  "radio": radioPl,
};

/**
 * The English files (`ink/en`), same knots, choices, variables and tags as the Polish ones, other
 * text (ADR-0056). A file not translated yet is missing here and plays in Polish.
 */
export const INK_EN: Readonly<Partial<Record<InkFile, string>>> = {
  m0: m0En,
};

/** The whole story in `language`, file by file, Polish where a translation is missing. */
export const storySource = (language: Locale): string =>
  INK_FILES.map((f) => (language === "en" ? (INK_EN[f] ?? INK_PL[f]) : INK_PL[f])).join("\n");

export const STORY_SOURCES: StorySources = { en: storySource("en"), pl: storySource("pl") };

/** The Polish story: the original, which the story tests read line by line. */
export const STORY_SOURCE: string = STORY_SOURCES.pl;
