import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Reporter, TestModule } from "vitest/node";
import type { FileTime, TimesFile } from "./times.ts";

/**
 * Vitest reporter for the CI shards (ADR-0046): the time of every test file, written to
 * `TEST_TIME_OUTPUT` (default `reports/unit-times.json`) when the run ends. Whole time of a file:
 * harness, environment, setup, import (with `describe` blocks) and the tests with their hooks.
 * The JSON reporter of Vitest counts only the tests, but the import was 58% of the suite before
 * PR #430 (docs/plany/czas-testow.md), so a slower import has to show too.
 *
 * In CI: `vitest run --reporter=default --reporter=./tools/test-time/src/reporter.ts`.
 */
export default class TestTimeReporter implements Reporter {
  private readonly files: Record<string, FileTime> = {};

  onTestModuleEnd(module: TestModule): void {
    const d = module.diagnostic();
    const importMs = d.prepareDuration + d.environmentSetupDuration + d.setupDuration + d.collectDuration;
    this.files[module.relativeModuleId] = { ms: Math.round(importMs + d.duration), importMs: Math.round(importMs) };
  }

  onTestRunEnd(): void {
    const out = resolve(process.env.TEST_TIME_OUTPUT ?? "reports/unit-times.json");
    mkdirSync(dirname(out), { recursive: true });
    const data: TimesFile = { files: this.files };
    writeFileSync(out, `${JSON.stringify(data, null, 1)}\n`);
  }
}
