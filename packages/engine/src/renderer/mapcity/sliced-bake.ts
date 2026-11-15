import { type Mesh, MeshClass, type Scene, VertexData } from "../../babylon";
import { MeshSink } from "../mesh-sink";

/**
 * A mesh baked over frames (ADR-0050, the street furniture's near blocks): its parts write into
 * small sinks of `CHUNK` vertices, each turned into typed arrays once full, and the mesh is made
 * from the typed arrays in a frame of its own. So no frame pays for a block of some hundred
 * thousand vertices at once: not for growing its plain arrays (V8 copies a growing array whole,
 * five of them some megabytes each), not for converting them (Babylon makes a `Float32Array` of a
 * plain array as it uploads it) and not for its bounds over a plain array. The same vertices as
 * the parts baked into one `MeshSink`, in float32 as Babylon uploads them.
 */

/** A part of the mesh, written into the sink it is given (its indices from that sink's start). */
export type BakePart = (sink: MeshSink) => void;

/** Vertices a chunk is closed at. */
const CHUNK = 8192;

/** A mesh's vertices and triangles as Babylon takes them without converting. */
export interface PackedMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
}

interface Chunk {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly uvs: Float32Array;
  /** From the start of the whole mesh. */
  readonly indices: Uint32Array;
}

type Key = "positions" | "normals" | "colors" | "uvs";

export class SlicedBake {
  private next = 0;
  private sink = new MeshSink();
  private readonly chunks: Chunk[] = [];
  private vertices = 0;
  private packedMesh: PackedMesh | null = null;

  constructor(private readonly parts: readonly BakePart[]) {}

  /** All parts are in and packed: the mesh can be made (`packed`). */
  get ready(): boolean {
    return this.packedMesh !== null;
  }

  get packed(): PackedMesh | null {
    return this.packedMesh;
  }

  /** Bakes parts until `stop()`, asked after each; the last part packs the chunks. */
  run(stop: () => boolean): void {
    while (!this.ready) {
      if (this.next < this.parts.length) {
        this.parts[this.next++]!(this.sink);
        if (this.sink.vertexCount >= CHUNK) this.close();
      } else this.pack();
      if (stop()) return;
    }
  }

  /** Bakes all that is left at once. */
  finish(): PackedMesh {
    this.run(() => false);
    return this.packedMesh!;
  }

  private close(): void {
    const s = this.sink;
    if (s.vertexCount === 0) return;
    const base = this.vertices;
    const indices = new Uint32Array(s.indices.length);
    for (let i = 0; i < indices.length; i++) indices[i] = s.indices[i]! + base;
    this.chunks.push({ positions: Float32Array.from(s.positions), normals: Float32Array.from(s.normals), colors: Float32Array.from(s.colors), uvs: Float32Array.from(s.uvs), indices });
    this.vertices += s.vertexCount;
    this.sink = new MeshSink();
  }

  private pack(): void {
    this.close();
    const join = (key: Key): Float32Array => {
      const out = new Float32Array(this.chunks.reduce((n, c) => n + c[key].length, 0));
      let at = 0;
      for (const c of this.chunks) {
        out.set(c[key], at);
        at += c[key].length;
      }
      return out;
    };
    const count = this.chunks.reduce((n, c) => n + c.indices.length, 0);
    const indices = this.vertices > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    let at = 0;
    for (const c of this.chunks) {
      indices.set(c.indices, at);
      at += c.indices.length;
    }
    this.packedMesh = { positions: join("positions"), normals: join("normals"), colors: join("colors"), uvs: join("uvs"), indices };
    this.chunks.length = 0;
  }
}

/** A frozen, unpickable mesh of packed arrays (as `sinkToMesh` makes of a sink), or null without triangles. */
export const packedToMesh = (scene: Scene, name: string, p: PackedMesh): Mesh | null => {
  if (p.indices.length === 0) return null;
  const data = new VertexData();
  data.positions = p.positions;
  data.normals = p.normals;
  data.colors = p.colors;
  data.uvs = p.uvs;
  data.indices = p.indices;
  const mesh = new MeshClass(name, scene);
  data.applyToMesh(mesh, false);
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
};
