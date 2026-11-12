import { describe, expect, it } from "vitest";
import { LruMap } from "../src";

describe("LruMap", () => {
  it("drops the least recently used entry once over the limit", () => {
    const m = new LruMap<string, number>(2);
    m.set("a", 1).set("b", 2).set("c", 3);
    expect(m.size).toBe(2);
    expect(m.has("a")).toBe(false);
    expect([...m.keys()]).toEqual(["b", "c"]);
  });

  it("a hit makes the entry the most recently used", () => {
    const m = new LruMap<string, number>(2);
    m.set("a", 1).set("b", 2);
    expect(m.get("a")).toBe(1);
    m.set("c", 3);
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(false);
    expect([...m.keys()]).toEqual(["a", "c"]);
  });

  it("setting an existing key refreshes it without growing", () => {
    const m = new LruMap<string, number>(2);
    m.set("a", 1).set("b", 2).set("a", 10).set("c", 3);
    expect(m.get("a")).toBe(10);
    expect(m.has("b")).toBe(false);
    expect(m.size).toBe(2);
  });

  it("a miss changes nothing and an undefined value still counts as an entry", () => {
    const m = new LruMap<string, number | undefined>(2);
    m.set("u", undefined).set("b", 2);
    expect(m.get("x")).toBeUndefined();
    expect([...m.keys()]).toEqual(["u", "b"]);
    expect(m.get("u")).toBeUndefined();
    expect([...m.keys()]).toEqual(["b", "u"]);
  });

  it("never holds more than the limit", () => {
    const m = new LruMap<number, number>(3);
    for (let i = 0; i < 100; i++) {
      m.set(i, i);
      expect(m.size).toBeLessThanOrEqual(3);
    }
    expect([...m.keys()]).toEqual([97, 98, 99]);
    m.delete(98);
    expect([...m.keys()]).toEqual([97, 99]);
    m.clear();
    expect(m.size).toBe(0);
  });

  it("rejects a limit below one", () => {
    expect(() => new LruMap(0)).toThrow();
  });
});
