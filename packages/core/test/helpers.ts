import type { RandomPort } from "../src";

/** Deterministic RandomPort that replays a fixed sequence. */
export const sequenceRng = (...values: number[]): RandomPort => {
  let i = 0;
  return {
    next: () => {
      const v = values[i % values.length];
      i += 1;
      return v ?? 0;
    },
  };
};
