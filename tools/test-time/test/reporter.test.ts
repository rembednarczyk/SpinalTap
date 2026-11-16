import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TestModule, Vitest } from "vitest/node";
import TestTimeReporter from "../src/reporter.ts";
import type { TimesFile } from "../src/times.ts";

/** The reporter of the CI shards (ADR-0046, ADR-0083): a fake module in, the times file out. */

const fakeTest = (fullName: string, ms: number, timeout?: number) => ({
  fullName,
  options: { timeout },
  result: () => ({ state: "passed" }),
  diagnostic: () => ({ duration: ms }),
});

const fakeModule = (tests: ReturnType<typeof fakeTest>[]) =>
  ({
    relativeModuleId: "packages/sim/test/slow.test.ts",
    diagnostic: () => ({ prepareDuration: 10, environmentSetupDuration: 0, setupDuration: 5, collectDuration: 85, duration: 1000 }),
    children: { allTests: () => tests },
  }) as unknown as TestModule;

const dirs: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const run = (tests: ReturnType<typeof fakeTest>[]): TimesFile => {
  const dir = mkdtempSync(join(tmpdir(), "test-time-"));
  dirs.push(dir);
  const out = join(dir, "times.json");
  vi.stubEnv("TEST_TIME_OUTPUT", out);
  const reporter = new TestTimeReporter();
  reporter.onInit({ config: { testTimeout: 20_000 } } as unknown as Vitest);
  reporter.onTestModuleEnd(fakeModule(tests));
  reporter.onTestRunEnd();
  return JSON.parse(readFileSync(out, "utf8")) as TimesFile;
};

describe("the times reporter (ADR-0083)", () => {
  // 16.11: a test of 50 s under its own 120 s was 42% of its limit and passed the gate.
  it("gives every test the run's limit, not its own higher timeout", () => {
    const times = run([fakeTest("chase > long", 50_000, 120_000), fakeTest("chase > short", 300)]);
    expect(times.tests).toEqual({
      "packages/sim/test/slow.test.ts > chase > long": { ms: 50_000, limitMs: 20_000 },
      "packages/sim/test/slow.test.ts > chase > short": { ms: 300, limitMs: 20_000 },
    });
    expect(times.files).toEqual({ "packages/sim/test/slow.test.ts": { ms: 1100, importMs: 100 } });
  });
});
