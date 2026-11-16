/**
 * A Vitest reporter for `check.ts`: every failed assertion of the run (soft ones too) with its
 * `actual` and `expected` as Vitest serialised them and the line of the test file it failed on,
 * written as JSON to `$HASHES_REPORT`. Nothing on the console.
 */
import { writeFileSync } from "node:fs";
import type { Reporter, TestModule } from "vitest/node";

export interface Failure {
  readonly file: string;
  readonly test: string;
  readonly line: number | null;
  readonly message: string;
  readonly actual: string | null;
  readonly expected: string | null;
}

export interface RunReport {
  readonly files: readonly { readonly file: string; readonly tests: number; readonly failed: number }[];
  readonly failures: readonly Failure[];
  readonly errors: readonly string[];
}

export default class HashesReporter implements Reporter {
  onTestRunEnd(modules: readonly TestModule[], unhandled: readonly { message: string }[]): void {
    const failures: Failure[] = [];
    const files: { file: string; tests: number; failed: number }[] = [];
    const errors: string[] = unhandled.map((e) => e.message);
    for (const m of modules) {
      const file = m.moduleId;
      let [tests, failed] = [0, 0];
      for (const e of m.errors()) errors.push(`${file}: ${e.message}`);
      for (const t of m.children.allTests()) {
        tests++;
        const r = t.result();
        if (r.state !== "failed") continue;
        failed++;
        for (const e of r.errors ?? []) {
          const at = e.stacks?.find((s) => s.file === file);
          failures.push({ file, test: t.fullName, line: at?.line ?? null, message: e.message, actual: typeof e.actual === "string" ? e.actual : null, expected: typeof e.expected === "string" ? e.expected : null });
        }
      }
      files.push({ file, tests, failed });
    }
    const out = process.env.HASHES_REPORT;
    if (out) writeFileSync(out, `${JSON.stringify({ files, failures, errors } satisfies RunReport, null, 2)}\n`);
  }
}
