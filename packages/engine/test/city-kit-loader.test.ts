// @ts-expect-error The engine is typed for the browser; the test reads the files off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKitLoader } from "../src/renderer/city-kit-loader";
import type { Stage } from "../src/renderer/stage";

/** The kit itself is not under test: a stand-in that loads at once. */
vi.mock("../src/renderer/city-kit", () => ({
  CityKit: class {
    static load = async (): Promise<object> => ({});
    setDaylight(): void {}
    add(): void {}
    setProps(): void {}
  },
}));

const bytes = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

/** A fetch whose answers the test releases one URL at a time. */
const deferredFetch = () => {
  const waiting = new Map<string, (ok: boolean) => void>();
  const fetch = vi.fn(
    (url: string) =>
      new Promise<{ ok: boolean; status: number; arrayBuffer: () => Promise<ArrayBuffer> }>((resolve) => {
        waiting.set(url, (ok) => resolve({ ok, status: ok ? 200 : 404, arrayBuffer: async () => bytes(url) }));
      }),
  );
  return { fetch, release: (url: string, ok = true) => waiting.get(url)?.(ok), asked: () => [...waiting.keys()] };
};

const loader = (onProps: (keys: string[]) => void) => {
  const scene = new Scene(new NullEngine());
  return new CityKitLoader({
    stage: { scene, glow: null } as unknown as Stage,
    materials: new ToonMaterials(scene),
    shadow: { invalidateStatics: () => {} } as never,
    dressing: { setKit: () => {} } as never,
    blocks: () => [],
    onProps: (p) => onProps([...p.models.keys()]),
  });
};

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

afterEach(() => vi.unstubAllGlobals());

describe("CityKitLoader with several props files (ADR-0057, ADR-0063)", () => {
  it("is ready only once the second props file is in, and merges both", async () => {
    const f = deferredFetch();
    vi.stubGlobal("fetch", f.fetch);
    let keys: string[] = [];
    const l = loader((k) => (keys = k));
    l.load("city-kit.glb", ["city-props.glb", "street-props.glb"]);
    let ready = false;
    void l.ready.then(() => (ready = true));
    await flush();
    expect(f.asked().sort()).toEqual(["city-props.glb", "street-props.glb"]);
    f.release("city-props.glb");
    await flush();
    expect(ready).toBe(false);
    expect(l.props).toBeNull();
    f.release("street-props.glb");
    await flush();
    expect(ready).toBe(true);
    expect(keys).toContain("pr-pole");
    expect(keys).toContain("st-vending");
  });

  it("is ready with the other file's props when one fails", async () => {
    const f = deferredFetch();
    vi.stubGlobal("fetch", f.fetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let keys: string[] = [];
    const l = loader((k) => (keys = k));
    l.load("city-kit.glb", ["city-props.glb", "street-props.glb"]);
    let ready = false;
    void l.ready.then(() => (ready = true));
    await flush();
    f.release("street-props.glb", false);
    await flush();
    expect(ready).toBe(false);
    f.release("city-props.glb");
    await flush();
    expect(ready).toBe(true);
    expect(keys).toContain("pr-pole");
    expect(keys).not.toContain("st-vending");
  });
});
