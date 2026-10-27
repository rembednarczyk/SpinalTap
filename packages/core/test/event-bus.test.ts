import { describe, expect, it } from "vitest";
import { EventBus } from "../src";

interface Ev { ping: number; other: string }

describe("event bus", () => {
  it("delivers payloads in subscription order", () => {
    const bus = new EventBus<Ev>();
    const seen: string[] = [];
    bus.on("ping", (n) => seen.push(`a${n}`));
    bus.on("ping", (n) => seen.push(`b${n}`));
    bus.emit("ping", 1);
    expect(seen).toEqual(["a1", "b1"]);
  });

  it("unsubscribes and clears", () => {
    const bus = new EventBus<Ev>();
    let count = 0;
    const off = bus.on("ping", () => count++);
    bus.emit("ping", 1);
    off();
    off();
    bus.emit("ping", 1);
    bus.on("other", () => count++);
    bus.clear();
    bus.emit("other", "x");
    expect(count).toBe(1);
  });

  it("tolerates handlers that unsubscribe during emit", () => {
    const bus = new EventBus<Ev>();
    const seen: number[] = [];
    const off = bus.on("ping", () => { seen.push(1); off(); });
    bus.on("ping", () => seen.push(2));
    bus.emit("ping", 0);
    expect(seen).toEqual([1, 2]);
  });
});
