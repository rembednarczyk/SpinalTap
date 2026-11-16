/**
 * `node city-make.ts <name> <file> [arg]`: writes `MAKE[name](arg)` of `city.ts`, serialised, to `<file>`.
 * The tests' cache runs it in a process of its own, out of the reach of their coverage (`city.ts`).
 */
import { writeFileSync } from "node:fs";
import { serialize } from "node:v8";
import { MAKE } from "./city.ts";

const [name, file, arg = ""] = process.argv.slice(2);
if (name !== "generate" && name !== "props" && name !== "around") throw new Error(`city-make: no ${name}; generate, props or around`);
writeFileSync(file!, serialize(MAKE[name](arg)));
