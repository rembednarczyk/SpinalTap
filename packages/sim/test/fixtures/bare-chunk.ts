import { type ChunkDef, chunkAt } from "../../src";

/**
 * A chunk of the city bare, as a test floor (ADR-0046, ADR-0083): its id, district and bounds, and
 * nothing else, on flat ground at y = 0. The content keyed on the chunk's id comes with it: the
 * crowd's routes and spots (ADR-0041), the passers-by's activity spots (ADR-0040) and the traffic
 * of its roads, so the same people walk the same routes from the same places as in the city. Its
 * buildings, furniture, terrain and named people stay out, and so do the chunks round it, which a
 * walker nearing the chunk's edge would wake. For the rules of the street that need its people,
 * not its shape. Load it with `Simulation.create({ seed, chunks: bareChunk(x, z) })`.
 */

const bare = new Map<string, readonly ChunkDef[]>();

/** The city's chunk at (x, z) bare; made once a chunk, as the steering's shared memory keys on the chunks' identity. */
export const bareChunk = (x: number, z: number): readonly ChunkDef[] => {
  const c = chunkAt(x, z);
  if (!c) throw new Error(`no chunk of the city at (${x}, ${z})`);
  let chunks = bare.get(c.id);
  if (!chunks) {
    chunks = [{ id: c.id, district: c.district, bounds: c.bounds, props: [], actors: [] }];
    bare.set(c.id, chunks);
  }
  return chunks;
};
