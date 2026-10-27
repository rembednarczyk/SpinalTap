import m0Source from "../ink/m0.ink?raw";
import m3EchoSource from "../ink/m3-echo.ink?raw";

/** All ink sources of the build, concatenated into one story (knots are the dialogue ids). */
export const STORY_SOURCE: string = [m0Source, m3EchoSource].join("\n");
