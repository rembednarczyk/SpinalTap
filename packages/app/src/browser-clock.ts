import type { ClockPort } from "@seki/core";

export const browserClock: ClockPort = { now: () => performance.now() };
