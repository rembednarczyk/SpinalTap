/**
 * The bakes' quadric simplifier (Garland and Heckbert 1997, as meshoptimizer implements it): an
 * indexed mesh in on stdin, its simplified index buffer out on stdout, both JSON. The vertices
 * carry the swatch of their faces, so the bake welds them by position and swatch: a seam between
 * two swatches is an attribute seam meshoptimizer collapses along without tearing.
 *
 *   in:  { "positions": [x, y, z, ...], "indices": [...], "target": triangles, "error": relative }
 *   out: { "indices": [...], "error": relative error reached }
 *
 * Used by `tools/city_qem.py`; the decision of the user of 20.11 to use meshoptimizer for the bakes.
 */
import { MeshoptSimplifier } from "meshoptimizer";

interface Job {
  readonly positions: number[];
  readonly indices: number[];
  readonly target: number;
  readonly error: number;
}

const read = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
};

const job = JSON.parse(await read()) as Job;
await MeshoptSimplifier.ready;
const positions = new Float32Array(job.positions);
const indices = new Uint32Array(job.indices);
const target = Math.min(indices.length, job.target * 3);
const [out, error] = MeshoptSimplifier.simplify(indices, positions, 3, target, job.error);
process.stdout.write(JSON.stringify({ indices: Array.from(out), error }));
