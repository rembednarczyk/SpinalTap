import { describe, expect, it } from "vitest";
import { type Net, RETRY_MS, RateLimited, getPng, getText, isDropped } from "../src/http.ts";

/** As Node's fetch throws a reset: `TypeError: fetch failed` caused by `read ECONNRESET` (run 43624113625). */
const reset = () => new TypeError("fetch failed", { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET", syscall: "read" }) });
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const png = () => new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });

/** A fake network: each request takes the next answer (a Response, or an error thrown). */
const fakeNet = (answers: readonly (Response | Error | (() => Response))[]) => {
  const calls: string[] = [];
  const pauses: number[] = [];
  const net: Net = {
    fetch: (url) => {
      calls.push(String(url));
      const a = answers[calls.length - 1];
      if (!a) throw new Error(`request ${calls.length} not expected`);
      if (a instanceof Error) return Promise.reject(a);
      return Promise.resolve(typeof a === "function" ? a() : a);
    },
    pause: (ms) => {
      pauses.push(ms);
      return Promise.resolve();
    },
    log: () => {},
  };
  return { net, calls, pauses };
};

describe("orthophoto requests", () => {
  it("asks once more after a dropped connection, and takes the second answer", async () => {
    const f = fakeNet([reset(), png()]);
    expect(await getPng("https://wms/a", f.net)).toEqual(PNG);
    expect(f.calls).toEqual(["https://wms/a", "https://wms/a"]);
    expect(f.pauses).toEqual([RETRY_MS]);
  });

  it("asks once more when the body is cut while it is read", async () => {
    const cut = () => ({ status: 200, ok: true, statusText: "OK", headers: new Headers({ "content-type": "image/png" }), arrayBuffer: () => Promise.reject(new TypeError("terminated", { cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }) })) }) as unknown as Response;
    const f = fakeNet([cut, png()]);
    expect(await getPng("https://wms/a", f.net)).toEqual(PNG);
    expect(f.calls).toHaveLength(2);
  });

  it("gives up after two drops in a row: the fetch step fails", async () => {
    const f = fakeNet([reset(), reset()]);
    await expect(getPng("https://wms/a", f.net)).rejects.toThrow("fetch failed");
    expect(f.calls).toHaveLength(2);
  });

  it("never asks again after HTTP 429", async () => {
    const f = fakeNet([new Response("slow down", { status: 429 }), png()]);
    await expect(getPng("https://wms/a", f.net)).rejects.toBeInstanceOf(RateLimited);
    await expect(getText("https://wms/b", fakeNet([new Response("", { status: 429 })]).net)).rejects.toThrow("HTTP 429 (no retry)");
    expect(f.calls).toHaveLength(1);
    expect(f.pauses).toEqual([]);
  });

  it("never asks again after another HTTP error or a body that is not a PNG", async () => {
    const f = fakeNet([new Response("", { status: 503, statusText: "Service Unavailable" })]);
    await expect(getPng("https://wms/a", f.net)).rejects.toThrow("HTTP 503");
    const g = fakeNet([new Response("<ServiceException/>", { status: 200, headers: { "content-type": "text/xml" } })]);
    await expect(getPng("https://wms/a", g.net)).rejects.toThrow("text/xml: <ServiceException/>");
    expect([f.calls.length, g.calls.length]).toEqual([1, 1]);
  });

  it("tells a dropped connection from other errors", () => {
    expect(isDropped(reset())).toBe(true);
    expect(isDropped(new TypeError("fetch failed", { cause: Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }) }))).toBe(true);
    expect(isDropped(new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }) }))).toBe(false);
    expect(isDropped(new RateLimited("HTTP 429 (no retry)"))).toBe(false);
    expect(isDropped("ECONNRESET")).toBe(false);
  });
});
