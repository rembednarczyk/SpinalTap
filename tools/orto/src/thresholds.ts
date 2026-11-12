/**
 * The classifier's thresholds (ADR-0077), in one place: tuned on the areas the curator checked on
 * the orthophoto (T-243, T-245) and on the map's lawns, parks and squares in `krakowskie-0-1`; the
 * test `cover-truth.test.ts` holds the agreement. A change here needs `build.ts` run again and the
 * rasters in `data/orto` committed with it.
 *
 * Per 0.5 m sample and flight: the mean R, G, B of the orthophoto's pixels in it (0-255), the
 * brightness `L = (R + G + B) / 3`, the excess green `ExG = 2g - r - b` of the chromaticities
 * (`r = R / (R + G + B)`, …) and the saturation `S = (max - min) / max`.
 */
export interface Thresholds {
  /** A sample's colour is the mean over this many samples round it each way (1: a 1.5 m square). */
  readonly smooth: number;
  /** Shadow: the flights' mean L under this (no colour to tell by). */
  readonly shadowL: number;
  /** Green: the flights' mean ExG at or over this. */
  readonly greenExg: number;
  /** A hard surface more saturated than this in the current image is something else (a coloured roof, a car, a court): unknown. */
  readonly hardS: number;
  /** Light paving: the current image's L at or over this; darker is asphalt. */
  readonly pavingL: number;
}

export const THRESHOLDS: Thresholds = {
  smooth: 1,
  shadowL: 50,
  greenExg: 0.026,
  hardS: 0.4,
  pavingL: 115,
};
