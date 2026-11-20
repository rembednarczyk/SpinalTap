/**
 * `node --experimental-transform-types --import ./node-resolve.ts scan-make.ts <kind> <file> [arg]`:
 * writes `SCAN_MAKERS[kind](arg)` of `scan-makers.ts`, serialised, to `<file>` (`writeResult`).
 * The scan's cache runs it in a process of its own, out of the reach of the test's coverage (`scan-cache.ts`).
 */
import { writeResult } from "../../osm-import/test/process-cache.ts";
import { SCAN_MAKERS, isMadeKind } from "./scan-makers.ts";

const [kind = "", file, arg = ""] = process.argv.slice(2);
if (!isMadeKind(kind)) throw new Error(`scan-make: no ${kind}; ${Object.keys(SCAN_MAKERS).join(", ")}`);
writeResult(file!, SCAN_MAKERS[kind](arg));
