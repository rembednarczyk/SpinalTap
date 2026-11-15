import type { Exception } from "./gate.ts";

/**
 * The tests the time gate lets through (ADR-0083 step 2), each with its reason: a test that has to
 * take long, or one waiting for the shared city cache or the project of its own (ADR-0083 steps 3
 * and 4). A test or a whole file (`gate.ts`, `testId`). Remove an entry once the test is fast again.
 */
export const EXCEPTIONS: readonly Exception[] = [];
