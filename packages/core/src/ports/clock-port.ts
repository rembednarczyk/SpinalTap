/** Injectable clock. Milliseconds, monotonic. Logic never reads wall time directly. */
export interface ClockPort {
  now(): number;
}
