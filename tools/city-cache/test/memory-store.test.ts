import { describe, expect, it } from "vitest";
import { MemoryStore, bytesOf } from "../src/memory-store.ts";

const made = (bytes: number) => ({ yields: [1], value: { open: new Uint8Array(bytes), name: "x" } });

describe("a test worker's store (ADR-0083 step 3)", () => {
  it("counts the typed arrays a value holds of its own", () => {
    expect(bytesOf({ a: new Uint8Array(10), b: new Float64Array(2), c: [1, 2], d: { e: new Uint8Array(99) } })).toBe(26);
    expect(bytesOf(null)).toBe(0);
  });

  it("hands back what it keeps, and lets the least recently used go past its budget", () => {
    const store = new MemoryStore<{ open: Uint8Array; name: string }>(3000);
    const [a, b, c] = [made(1000), made(1000), made(1000)];
    store.set("a", a);
    store.set("b", b);
    expect(store.get("a")).toBe(a);
    store.set("c", c);
    // Over 3000 bytes with the keys and the reports: "b", used least lately, goes.
    expect(store.get("b")).toBeUndefined();
    expect(store.get("a")).toBe(a);
    expect(store.get("c")).toBe(c);
    expect(store.stats).toMatchObject({ hits: 3, misses: 1, entries: 2 });
    expect(store.stats.bytes).toBeLessThanOrEqual(3000);
  });

  it("keeps nothing bigger than its whole budget, and counts a value set again once", () => {
    const store = new MemoryStore<{ open: Uint8Array; name: string }>(500);
    store.set("big", made(1000));
    expect(store.get("big")).toBeUndefined();
    store.set("a", made(100));
    store.set("a", made(100));
    expect(store.stats.entries).toBe(1);
    expect(store.stats.bytes).toBe(100 + 8 + 2);
  });
});
