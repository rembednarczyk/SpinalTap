/**
 * The places of `compare.ts`, in the format of `GLITCH_SPOTS` (e2e/glitch-shots.spec.ts):
 * a JSON list of [name, x, z, yaw, pitch, y?]. The name becomes a file name, so it is checked here,
 * before two builds are spent on a typo.
 */

export type Spot = readonly [string, number, number, number, number, number?];

const NAME = /^[A-Za-z0-9._-]+$/;

export const parseSpots = (text: string): Spot[] => {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data) || data.length === 0) throw new Error("spots: a non-empty JSON list of [name, x, z, yaw, pitch, y?]");
  const seen = new Set<string>();
  return data.map((s: unknown, i) => {
    if (!Array.isArray(s) || s.length < 5 || s.length > 6) throw new Error(`spot ${i}: [name, x, z, yaw, pitch, y?]`);
    const [name, ...nums] = s as unknown[];
    if (typeof name !== "string" || !NAME.test(name)) throw new Error(`spot ${i}: name ${JSON.stringify(name)} is not [A-Za-z0-9._-]+`);
    if (seen.has(name)) throw new Error(`spot ${i}: name ${name} twice`);
    seen.add(name);
    if (!nums.every((v) => typeof v === "number" && Number.isFinite(v))) throw new Error(`spot ${name}: x, z, yaw, pitch and y are numbers`);
    return [name, ...(nums as number[])] as unknown as Spot;
  });
};
