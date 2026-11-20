/**
 * `node --import ./node-resolve.ts`: resolves the sources' specifiers as Vite does where Node does
 * not, a module without its extension (`./sites`) or a directory by its `index.ts`, so that a plain
 * node process loads the simulation's modules (`scan-make.ts`). Their parameter properties need
 * `--experimental-transform-types` beside it.
 */
import { registerHooks } from "node:module";

const MISSING = new Set(["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"]);

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (e) {
      if (!specifier.startsWith(".") || !MISSING.has((e as { code?: string }).code ?? "")) throw e;
      for (const ext of [".ts", "/index.ts"]) {
        try {
          return next(specifier + ext, context);
        } catch {
          // the next way of naming it
        }
      }
      throw e;
    }
  },
});
