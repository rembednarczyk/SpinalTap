import { EngineStore } from "@babylonjs/core/Engines/engineStore";
import { afterAll } from "vitest";

/**
 * After each test file of the shared project (vitest.config.ts): every engine the file left behind
 * goes, with its scenes, meshes and the model files' vertex data (G-865). Babylon keeps each engine
 * in `EngineStore`, and a worker without isolation runs file after file in one heap: most engine
 * tests make a `NullEngine` and never free it, so one worker running the engine package reached
 * 150 engines and 1.7 GB of heap after a garbage collection and ran out of memory, in whichever
 * file came next (often `model-donors.test.ts`, which loads seven model files).
 */
afterAll(() => {
  for (const engine of [...EngineStore.Instances]) engine.dispose();
});
