import m0Source from "../ink/m0.ink?raw";
import m3EchoSource from "../ink/m3-echo.ink?raw";
import m4TargSource from "../ink/m4-targ.ink?raw";
import m4OyajiSource from "../ink/m4-oyaji.ink?raw";
import m4DokiSource from "../ink/m4-doki.ink?raw";
import dayCycleSource from "../ink/day-cycle.ink?raw";

/** All ink sources of the build, concatenated into one story (knots are the dialogue ids). */
export const STORY_SOURCE: string = [m0Source, m3EchoSource, m4TargSource, m4OyajiSource, m4DokiSource, dayCycleSource].join("\n");
