import { describe, expect, it } from "vitest";
import { CRASH_NOTICE_MS, type CrashReport, bindCrashWatch } from "../src/crash-watch";

/** A target that keeps its listeners, so a test can fire them and see the unbinding. */
const target = () => {
  const listeners = new Map<string, Set<(e: Event) => void>>();
  return {
    listeners,
    addEventListener: (type: string, l: (e: Event) => void) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(l),
    removeEventListener: (type: string, l: (e: Event) => void) => void listeners.get(type)?.delete(l),
    fire: (type: string, e: object = {}) => listeners.get(type)?.forEach((l) => l(e as Event)),
  };
};

describe("crash watch (gap audit: errors shown to the player)", () => {
  it("reports an uncaught error and a rejected promise, at most once per notice window", () => {
    const win = target();
    const canvas = target();
    let t = 0;
    const reports: CrashReport[] = [];
    bindCrashWatch(win, canvas, () => t, (r) => reports.push(r));
    win.fire("error", { error: new Error("boom"), message: "Uncaught Error: boom" });
    t = 100;
    win.fire("unhandledrejection", { reason: new Error("again") });
    expect(reports).toEqual([{ kind: "error", message: "boom" }]);
    t = CRASH_NOTICE_MS + 1;
    win.fire("unhandledrejection", { reason: "no network" });
    expect(reports.at(-1)).toEqual({ kind: "error", message: "no network" });
  });

  it("reports the WebGL context lost and restored every time", () => {
    const win = target();
    const canvas = target();
    const reports: CrashReport[] = [];
    bindCrashWatch(win, canvas, () => 0, (r) => reports.push(r));
    canvas.fire("webglcontextlost");
    canvas.fire("webglcontextrestored");
    canvas.fire("webglcontextlost");
    expect(reports.map((r) => r.kind)).toEqual(["context-lost", "context-restored", "context-lost"]);
  });

  it("stops listening when unbound", () => {
    const win = target();
    const canvas = target();
    const unbind = bindCrashWatch(win, canvas, () => 0, () => undefined);
    unbind();
    expect([...win.listeners.values(), ...canvas.listeners.values()].every((s) => s.size === 0)).toBe(true);
  });
});
