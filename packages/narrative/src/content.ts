import m0Source from "../ink/m0.ink?raw";
import m3EchoSource from "../ink/m3-echo.ink?raw";
import m3LustroSource from "../ink/m3-lustro.ink?raw";
import m4TargSource from "../ink/m4-targ.ink?raw";
import m4OyajiSource from "../ink/m4-oyaji.ink?raw";
import m4DokiSource from "../ink/m4-doki.ink?raw";
import m4UlicaSource from "../ink/m4-ulica.ink?raw";
import dayCycleSource from "../ink/day-cycle.ink?raw";
import phoneSource from "../ink/phone.ink?raw";
import encShinsekaiSource from "../ink/enc-shinsekai.ink?raw";
import encKanalSource from "../ink/enc-kanal.ink?raw";
import encTargSource from "../ink/enc-targ.ink?raw";
import encDokiSource from "../ink/enc-doki.ink?raw";
import hooksSource from "../ink/hooks.ink?raw";
import metroSource from "../ink/metro.ink?raw";
import radioSource from "../ink/radio.ink?raw";

/** All ink sources of the build, concatenated into one story (knots are the dialogue ids). */
export const STORY_SOURCE: string = [
  m0Source,
  m3EchoSource,
  m3LustroSource,
  m4TargSource,
  m4OyajiSource,
  m4DokiSource,
  m4UlicaSource,
  dayCycleSource,
  phoneSource,
  // Wave 2 (ADR-0032): street encounters, observation hooks, metro and radio.
  encShinsekaiSource,
  encKanalSource,
  encTargSource,
  encDokiSource,
  hooksSource,
  metroSource,
  radioSource,
].join("\n");
