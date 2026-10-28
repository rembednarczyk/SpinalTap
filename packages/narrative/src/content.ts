import m0Source from "../ink/m0.ink?raw";
import m3EchoSource from "../ink/m3-echo.ink?raw";
import m3LustroSource from "../ink/m3-lustro.ink?raw";
import m4TargSource from "../ink/m4-targ.ink?raw";
import m4OyajiSource from "../ink/m4-oyaji.ink?raw";
import m4DokiSource from "../ink/m4-doki.ink?raw";
import m4UlicaSource from "../ink/m4-ulica.ink?raw";
import dayCycleSource from "../ink/day-cycle.ink?raw";
import phoneSource from "../ink/phone.ink?raw";

/** All ink sources of the build, concatenated into one story (knots are the dialogue ids). */
export const STORY_SOURCE: string = [m0Source, m3EchoSource, m3LustroSource, m4TargSource, m4OyajiSource, m4DokiSource, m4UlicaSource, dayCycleSource, phoneSource].join("\n");
