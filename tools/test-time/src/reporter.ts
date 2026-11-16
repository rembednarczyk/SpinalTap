import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Reporter, TestModule, Vitest } from "vitest/node";
import { type TestTime, testId } from "./gate.ts";
import type { FileTime, TimesFile } from "./times.ts";

/**
 * Vitest reporter for the CI shards (ADR-0046): the time of every test file, written to
 * `TEST_TIME_OUTPUT` (default `reports/unit-times.json`) when the run ends. Whole time of a file:
 * harness, environment, setup, import (with `describe` blocks) and the tests with their hooks.
 * The JSON reporter of Vitest counts only the tests, but the import was 58% of the suite before
 * PR #430 (docs/plany/czas-testow.md), so a slower import has to show too. And the time of every
 * test that ran, with its limit, for the gate of single tests (ADR-0083, `gate.ts`).
 *
 * The limit is the run's own (`testTimeout`, 20 s), never a test's own `timeout`: a test of 50 s
 * under a `timeout` of 120 s was 42% of its limit and passed the gate, so a higher limit hid a
 * slow test instead of a faster set-up taking it under (decision of the user, 16.11). A test that
 * has to take long goes in the list of exceptions with its reason (`exceptions.ts`).
 *
 * In CI: `vitest run --reporter=default --reporter=./tools/test-time/src/reporter.ts`.
 */
export default class TestTimeReporter implements Reporter {
  private readonly files: Record<string, FileTime> = {};
  private readonly tests: Record<string, TestTime> = {};
  private defaultLimitMs = 5000;

  onInit(vitest: Vitest): void {
    this.defaultLimitMs = vitest.config.testTimeout;
  }

  onTestModuleEnd(module: TestModule): void {
    const d = module.diagnostic();
    const importMs = d.prepareDuration + d.environmentSetupDuration + d.setupDuration + d.collectDuration;
    this.files[module.relativeModuleId] = { ms: Math.round(importMs + d.duration), importMs: Math.round(importMs) };
    for (const test of module.children.allTests()) {
      const state = test.result().state;
      const diagnostic = test.diagnostic();
      if ((state !== "passed" && state !== "failed") || !diagnostic) continue;
      this.tests[testId(module.relativeModuleId, test.fullName)] = { ms: Math.round(diagnostic.duration), limitMs: this.defaultLimitMs };
    }
  }

  onTestRunEnd(): void {
    const out = resolve(process.env.TEST_TIME_OUTPUT ?? "reports/unit-times.json");
    mkdirSync(dirname(out), { recursive: true });
    const data: TimesFile = { files: this.files, tests: this.tests };
    writeFileSync(out, `${JSON.stringify(data, null, 1)}\n`);
  }
}
