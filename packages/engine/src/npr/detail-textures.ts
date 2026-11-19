import { type BaseTexture, Constants, RawTexture, type Scene, Texture } from "../babylon";
import { DETAIL_FILES, DETAIL_SAMPLERS, type DetailTexture } from "./detail-layers";

/** What a material binds: the sampler name and the texture of each detail file. */
export type DetailBinding = readonly (readonly [sampler: string, texture: BaseTexture])[];

const KINDS = Object.keys(DETAIL_FILES) as DetailTexture[];

/**
 * The detail textures of the toon shader (ADR-0092). Until `load` and while the files load, every
 * sampler reads a 1×1 grey of 0.5, the layers' mean: the surfaces look as they did without them.
 * When a file has loaded, `onSwap` hands it to the materials that sample it.
 */
export class DetailTextures {
  private readonly current = new Map<DetailTexture, BaseTexture>();
  private readonly neutral: RawTexture;
  private onSwap: (sampler: string, texture: BaseTexture) => void = () => {};
  private loading: Promise<unknown> = Promise.resolve();

  constructor(private readonly scene: Scene) {
    this.neutral = new RawTexture(new Uint8Array([128, 128, 128, 128]), 1, 1, Constants.TEXTUREFORMAT_RGBA, scene, false, false, Constants.TEXTURE_NEAREST_SAMPLINGMODE);
    for (const k of KINDS) this.current.set(k, this.neutral);
  }

  /** The samplers and textures a material compiled with DETAIL binds now. */
  get binding(): DetailBinding {
    return KINDS.map((k) => [DETAIL_SAMPLERS[k], this.current.get(k) ?? this.neutral] as const);
  }

  /** Every file has loaded or failed; at once without `load`. The start waits for it with the city kit. */
  get ready(): Promise<unknown> {
    return this.loading;
  }

  /** Called with each file once it has loaded, for the materials that sample it. */
  setSwap(swap: (sampler: string, texture: BaseTexture) => void): void {
    this.onSwap = swap;
  }

  /** Loads the files from `base` (a folder URL ending in `/`); repeating, trilinear, mipmapped. */
  load(base: string): void {
    const files = KINDS.map(
      (k) =>
        new Promise<void>((done) => {
          // A file that fails leaves its grey: the surfaces look as they did before the layers.
          const tex = new Texture(new URL(DETAIL_FILES[k], base).href, this.scene, {
            noMipmap: false,
            invertY: false,
            samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
            onLoad: () => {
              this.current.set(k, tex);
              this.onSwap(DETAIL_SAMPLERS[k], tex);
              done();
            },
            onError: () => done(),
          });
          tex.wrapU = Texture.WRAP_ADDRESSMODE;
          tex.wrapV = Texture.WRAP_ADDRESSMODE;
          tex.anisotropicFilteringLevel = 4;
        }),
    );
    this.loading = Promise.all(files);
  }
}
