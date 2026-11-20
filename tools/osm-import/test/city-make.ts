/**
 * `node city-make.ts <name> <file> [arg]`: writes `MAKE[name](arg)` of `city.ts`, serialised, to `<file>` (`writeResult`).
 * The tests' cache runs it in a process of its own, out of the reach of their coverage (`city.ts`).
 */
import { MAKE } from "./city.ts";
import { writeResult } from "./process-cache.ts";

const [name, file, arg = ""] = process.argv.slice(2);
if (name !== "generate" && name !== "props" && name !== "around") throw new Error(`city-make: no ${name}; generate, props or around`);
writeResult(file!, MAKE[name](arg));
