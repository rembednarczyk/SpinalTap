import { type RandomPort, mulberry32Advance, mulberry32Output } from "@seki/core";

/** mulberry32 (`@seki/core`) stepped on a 32-bit state. The whole state fits in one number, so it is trivially saveable. */
export class SeededRandom implements RandomPort {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = mulberry32Advance(this.state);
    return mulberry32Output(this.state);
  }

  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }
}
