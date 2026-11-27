import { DISTRICTS } from "../src/config.ts";
import { graphDistricts } from "../src/streets/graph-bands.ts";

/**
 * A district whose streets the import still lays the old way (ADR-0104 E3 puts Krakowskie on the
 * street graph): the tests of the old model's rules (kerb fills, lane fits, zebras) build their
 * chunks in it, since those rules lay the streets of every district off the graph.
 */
export const OFF_GRAPH = DISTRICTS.find((d) => !graphDistricts().has(d.slug) && !graphDistricts().has(d.id))!;
