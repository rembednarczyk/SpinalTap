/** Seeded random source. next() returns a float in [0, 1). */
export interface RandomPort {
  next(): number;
}
