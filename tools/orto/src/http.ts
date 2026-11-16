/**
 * The orthophoto's requests (ADR-0077): one GET with the agents' User-Agent, stopped at HTTP 429
 * (`RateLimited`, never asked again). A dropped connection (ECONNRESET, ETIMEDOUT and the like,
 * while connecting or while reading the body) is asked once more after `RETRY_MS`: the first
 * refresh in CI lost the whole run to one reset after 20 tiles (run 43624113625, 14.11). A second
 * drop, or any HTTP error, ends the fetch. `fetch` and the pause are given, so a test needs no network.
 */
import { USER_AGENT } from "./config.ts";

export class RateLimited extends Error {}

/** Wait before the one retry after a dropped connection (ms). */
export const RETRY_MS = 5000;

/** The codes of a dropped or timed-out connection (Node's and undici's), never an HTTP status. */
const DROPPED = new Set(["ECONNRESET", "ETIMEDOUT", "EPIPE", "ECONNABORTED", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]);

/** Whether an error, or one of its causes, is a dropped connection. */
export const isDropped = (e: unknown): boolean => {
  for (let c: unknown = e, depth = 0; c && typeof c === "object" && depth < 5; c = (c as { cause?: unknown }).cause, depth++) {
    const code = (c as { code?: unknown }).code;
    if (typeof code === "string" && DROPPED.has(code)) return true;
  }
  return false;
};

export interface Net {
  readonly fetch: typeof fetch;
  readonly pause: (ms: number) => Promise<void>;
  readonly log: (line: string) => void;
}

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const NET: Net = { fetch: (url, init) => fetch(url, init), pause, log: (l) => console.log(l) };

/** One request read to its end: the status checked, the body as bytes with its type. */
const getOnce = async (net: Net, url: string): Promise<{ type: string; body: Uint8Array }> => {
  const res = await net.fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 429) throw new RateLimited(`HTTP 429 (no retry): ${url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
  return { type: res.headers.get("content-type") ?? "", body: new Uint8Array(await res.arrayBuffer()) };
};

/** `getOnce`, asked once more after a dropped connection. */
const get = async (net: Net, url: string) => {
  try {
    return await getOnce(net, url);
  } catch (e) {
    if (!isDropped(e)) throw e;
    net.log(`  connection dropped (${e instanceof Error ? e.message : String(e)}), once more in ${RETRY_MS / 1000} s: ${url}`);
    await net.pause(RETRY_MS);
    return getOnce(net, url);
  }
};

export const getPng = async (url: string, net: Net = NET): Promise<Uint8Array> => {
  const { type, body } = await get(net, url);
  if (!type.startsWith("image/png")) throw new Error(`${type}: ${new TextDecoder().decode(body.subarray(0, 300))}`);
  return body;
};

export const getText = async (url: string, net: Net = NET): Promise<string> => new TextDecoder().decode((await get(net, url)).body);
