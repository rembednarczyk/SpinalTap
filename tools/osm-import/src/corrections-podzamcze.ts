/**
 * Added areas on the shops' land of Podzamcze (T-246, G-536, G-540), after those east of the Dworzec
 * Autobusowy in `ADDED_AREAS`: kept apart so `corrections.ts` stays within ADR-0031's 500 lines.
 *
 * OSM maps no surface round Nadstawna 1-4 (`landuse=commercial` w1305996965), round Społem between
 * Lubartowska and the Bazar (`landuse=retail` w291844839), on the dairy cooperative's yard
 * (w1094207955), along the shops by Ruska and at the stops by Szkolna, where the orthophoto (PZGiK)
 * shows setts, car parks and a lawn or two. No import rule lays them right: a paving over the land's
 * outline would lie in one plane with the Bazar's square inside w291844839 (G-320); a third to two
 * fifths of the bare ground is in the strips along the shops' walls outside the land; and land with
 * no lawn of the map may still be half grass (`landuse=retail` w175886791 on Nabrzeże).
 *
 * Each outline is the bare ground the import left there (a 0.25 m grid, simplified by 0.3-0.4 m),
 * grown 1-3 m under the streets, pavements, footways and buildings round it, which are drawn over the
 * setts, and kept 0.4 m off the map's squares, lawns and steps: a paving in one plane with a square
 * flickers (G-320), one over a lawn hides it (G-421). Its corners within 1 m of a car park or a
 * footway area of the map are moved onto that outline, with its nodes between them, so the setts end
 * where the car park begins and no added area lies over a paving OSM maps.
 */
import type { AddedArea } from "./corrections.ts";
import { DWORZEC_EAST_AREAS } from "./corrections-dworzec.ts";
import type { Tags } from "./osm.ts";

/** Setts (`square`): the game reads `road` as a carriageway. */
const SETTS = { "area:highway": "pedestrian", surface: "paving_stones" } as const;
/** A lawn, as a bed of the map. */
const LAWN = { landuse: "flowerbed" } as const;

/** An added area of T-246 from its corners, x and z in turn. */
const area = (name: string, tags: Tags, flat: readonly number[], reason: string): AddedArea => {
  const ring = Array.from({ length: flat.length / 2 }, (_, i) => ({ x: flat[2 * i]!, z: flat[2 * i + 1]! }));
  return { id: `T-246/${name}`, tags, ring, nodesOf: ring.map(() => null), reason, ref: "T-246" };
};

/**
 * The forecourt, the yards and the strips round Nadstawna 4 (w73833921) and the houses west of it on
 * `landuse=commercial` w1305996965, between and round the car parks w73976159 and w73976162.
 */
const YARD_NADSTAWNA_4 = area("nadstawna-4", SETTS, [
  732.5, 453.5, 732.89, 451.41, 733.95, 451.22, 764.91, 445.72, 764.96, 445.71, 766.25, 440.47, 774, 439, 779.5, 439.75, 783.5, 442, 784.5, 443,
  784.75, 444.5, 786.5, 445, 788, 446.5, 798.75, 472, 800.75, 475.5, 800.75, 488.5, 795, 488.5, 795, 494.25, 797.62, 494.78, 769.35, 506.24, 767.61,
  506.47, 766.38, 505.69, 765.32, 505.03, 766.5, 503, 777, 498.75, 777.25, 497, 778.5, 495.5, 781, 495.25, 782, 494, 783.5, 493.5, 785.25, 494, 786.5,
  492, 789, 491.75, 790, 490.5, 793.25, 489.5, 794.25, 488.5, 778.25, 452, 775.5, 450.25, 774.5, 450.25, 763, 452.25, 763.75, 461.5, 768, 460.5, 772,
  462, 773.5, 463.5, 784, 487, 783.5, 488.5, 781.5, 490.25, 778, 491.5, 775, 490.75, 771.5, 492.75, 768.5, 493.5, 767, 493, 765.25, 491, 762.75, 479.5,
  760.1, 482.71, 759.96, 482.07, 759.57, 480.37, 758.59, 480.53, 750.79, 481.79, 738.5, 484.13, 742.06, 509.28, 742.26, 509.79, 751.25, 531.86, 764.89,
  526.75, 760.75, 517.61, 760.33, 516.68, 760.86, 516.44, 765.15, 514.53, 765.33, 514.46, 766.28, 514.02, 767.25, 516, 768, 515, 770.63, 514.08,
  774.85, 523.59, 775.06, 523.51, 804.99, 512.14, 798.07, 494.6, 804.75, 495, 806, 499.25, 807, 500, 810.75, 508.5, 811, 510.5, 810, 514, 807.5,
  515.75, 775, 528.75, 771.5, 528.5, 770, 530.5, 768.5, 531.25, 761, 533.75, 749.5, 538.75, 746.5, 538.5, 744.75, 536, 739, 514, 739.25, 512.5, 738.25,
  511, 737.5, 507.5, 734.5, 486, 734.5, 482, 735.5, 479, 733, 461.5,
], "kostka i parkingi wokół Nadstawnej 4 i domów na zachód od niej na ortofoto PZGiK, w OSM landuse=commercial w1305996965 bez nawierzchni");

/** A strip at the south-east corner of the same land, between the street's pavement and the footway. */
const CORNER_NADSTAWNA_4 = area("nadstawna-4-rog", SETTS, [
  797.5, 451.5, 799, 449, 800.75, 449, 800.28, 456.97, 798.14, 452.44, 797.78, 452.79,
], "pas kostki przy południowo-wschodnim narożniku działki Nadstawnej 4 na ortofoto PZGiK, w OSM bez nawierzchni");

/**
 * Round the shops Nadstawna 1 and 3 (w73833931, w73833932) and the kiosk w73833930, inside the
 * footway's loop round them.
 */
const YARD_NADSTAWNA_1_3 = area("nadstawna-1-3", SETTS, [
  801.25, 449.5, 805, 451.5, 807.75, 450.75, 808.75, 453, 818, 449, 818.5, 449, 819.25, 451, 821.75, 451, 828.5, 448.75, 829.75, 449, 843.45, 479.31,
  842.5, 481.75, 841, 482.75, 841.5, 484, 841, 485.75, 836.25, 488, 835.5, 489.75, 833.75, 491.5, 831.5, 492, 829.75, 493.25, 825, 495, 820.25, 494.5,
  819.5, 493, 819.75, 491.75, 818.25, 490.75, 805.5, 460.75, 803.5, 461, 802.01, 460.61, 801.53, 459.6, 800.96, 458.39,
], "kostka wokół sklepów Nadstawna 1 i 3 i kiosku w73833930 na ortofoto PZGiK, w OSM bez nawierzchni");

/** West of Nadstawna 3, between the footway and the street. */
const WEST_NADSTAWNA_1_3 = area("nadstawna-1-3-zachod", SETTS, [
  801.25, 483, 803, 483.75, 805, 488, 804.5, 491.25, 803, 491.75, 803.5, 494.5, 801.25, 494.5, 801.25, 492.25, 802.5, 491.75, 801.25, 489,
], "pas kostki na zachód od Nadstawnej 3 między chodnikiem a jezdnią na ortofoto PZGiK, w OSM bez nawierzchni");

/** The bus bay north of the street by Szkolna, between the carriageway's band and the pavement. */
const BAY_SZKOLNA = area("zatoka-szkolna", SETTS, [
  847, 514, 847.5, 513.5, 847.5, 512, 848.5, 510.75, 853, 509.5, 854.5, 508.5, 855.5, 508.5, 859, 507, 860, 507, 861.5, 506, 863.5, 506, 865, 506.75,
  866.75, 508.5, 868.5, 511.5, 868.5, 512.5, 867.5, 513.5, 859, 516, 857.5, 517, 850.5, 519, 849, 520, 848, 519.75, 847.5, 519,
], "zatoka autobusowa przy Szkolnej między jezdnią a chodnikiem na ortofoto PZGiK, w OSM bez obszaru");

/** The lawn behind the same stop, between the pavement and the park's edge: grass, as a bed of the map. */
const LAWN_SZKOLNA = area("trawnik-szkolna", LAWN, [
  849, 521, 850.5, 519.5, 851.5, 519.5, 854.5, 518, 864.5, 515, 867.5, 513.5, 868.5, 513.75, 869, 514.5, 869, 518.5, 867.75, 520.75, 856.25, 526.5,
  854, 526, 851, 524.25, 849.25, 522.5,
], "trawnik za przystankiem przy Szkolnej między chodnikiem a parkiem na ortofoto PZGiK, w OSM bez obszaru");

/** The stop's pavement south of the street by Szkolna, between the carriageway's band and the footway. */
const STOP_SZKOLNA = area("przystanek-szkolna", SETTS, [
  859, 494, 860, 492.75, 861.5, 492, 865.5, 491, 867, 490, 869.5, 489.5, 871, 488.5, 873.5, 488, 876.5, 486.5, 878.5, 486.75, 879.5, 488.5, 879, 492,
  877.5, 494.25, 871.5, 496, 870, 497, 869, 497, 867, 498, 866, 498, 864.5, 499, 862, 498.25, 859.25, 495.5,
], "kostka przystanku po południowej stronie ulicy przy Szkolnej na ortofoto PZGiK, w OSM bez obszaru");

/** A strip south of the Dworzec Autobusowy w66264171, on the chunk's south edge. */
const EDGE_DWORZEC = area("pod-dworcem", SETTS, [
  773.75, 371, 774, 370.5, 793, 370.5, 792.75, 371.5, 792, 371.75, 777, 373.75, 775, 373.75, 774.75, 373, 773.75, 373,
], "pas kostki na południe od Dworca Autobusowego w66264171 na ortofoto PZGiK, w OSM bez nawierzchni");

/**
 * Round the Społem supermarket w66264139 between Lubartowska and the Bazar w67502759, on `landuse=retail`
 * w291844839: its car park and forecourts, up to the Bazar's west edge.
 */
const BLOCK_LUBARTOWSKA = area("lubartowska-bazar", SETTS, [
  603, 398, 603.5, 396.5, 605.75, 395, 605.75, 394, 607, 392.5, 619, 388.25, 623, 386.25, 632.5, 383.25, 633.25, 383.25, 635, 385.25, 641.25, 388, 659,
  387.25, 659.5, 386.75, 668, 442, 668.5, 443.5, 671.4, 446.57, 672.09, 450.44, 671.5, 452.5, 670, 453.75, 667, 454, 665.25, 453.5, 664, 454.75, 658.5,
  455.5, 643, 459.25, 634, 462.5, 632, 461.75, 629.5, 463, 627.5, 462.5, 625.25, 460, 618.5, 441.5, 614.5, 441.25, 612.75, 439.5, 608.5, 427, 609.25,
  424, 608.25, 422.5, 608, 420.5, 609.5, 418, 603.25, 402.5,
], "kostka i parking wokół Społem między Lubartowską a Bazarem na ortofoto PZGiK, w OSM landuse=retail w291844839 bez nawierzchni");

/**
 * The east edge of the LSUM's yard (`landuse=commercial` w1094207955) along the street, round the
 * house w227690851; the chunk's west edge cuts it at x 520.
 */
const YARD_LSUM = area("podworze-lsm", SETTS, [
  517, 418.5, 517.5, 417, 519, 415.5, 520.5, 415, 526, 414, 527.5, 414.5, 528.75, 416, 530.5, 422, 529.75, 425, 530.75, 426, 531.75, 432.5, 528.5, 433,
  528.5, 435, 526, 436, 527, 439.25, 529.5, 438.75, 530.25, 456.25, 533.5, 456.25, 533.25, 458, 532.5, 458.75, 533.5, 461, 533.5, 463, 530.5, 462.25,
  530.75, 472, 520.25, 473.25, 519.5, 473.75, 519.5, 476.25, 517.5, 475, 517, 473.5, 517, 462.5, 518, 460.75, 517, 458.5, 517, 448.5, 517.5, 447.5,
  517, 446, 517, 429, 518, 427.25, 517, 425,
], "asfalt i parking podwórza Lubelskiej Spółdzielni Usług Mleczarskich na ortofoto PZGiK, w OSM landuse=commercial w1094207955 bez nawierzchni");

/** Pieces of the strip between the shops' front on Lubartowska (x 616-630, z 476-498) and the pavement. */
const FRONT_LUBARTOWSKA_A = area("lubartowska-pierzeja-a", SETTS, [
  618, 477.5, 619, 476.5, 623.5, 476, 624.5, 477, 625, 479.5, 624, 480.5, 622.5, 480.5, 620, 481.5, 619.25, 481,
], "pas kostki między pierzeją sklepów a chodnikiem Lubartowskiej na ortofoto PZGiK, w OSM bez nawierzchni");

const FRONT_LUBARTOWSKA_B = area("lubartowska-pierzeja-b", SETTS, [
  615.5, 479, 616.5, 478, 617.5, 478.25, 619, 481, 619.5, 483.5, 620.5, 485, 621, 487.5, 623.5, 493, 623.5, 494, 624, 494.5, 623.75, 495.25, 624.5,
  496, 624.25, 497, 623.5, 497.5, 622.5, 497.25, 622, 496.5, 622.25, 495.75, 621, 494, 621, 493, 620, 491.5, 619.5, 489, 618.5, 487.5, 618.5, 486.5,
  617.5, 485, 617.5, 484, 616.5, 482.5,
], "pas kostki między pierzeją sklepów a chodnikiem Lubartowskiej na ortofoto PZGiK, w OSM bez nawierzchni");

const FRONT_LUBARTOWSKA_C = area("lubartowska-pierzeja-c", SETTS, [
  620.5, 483, 621, 482.25, 624, 481.5, 624.5, 481, 626.25, 481.5, 627, 484.5, 629, 488.5, 629.5, 491, 630.5, 492.5, 630.5, 494.5, 629, 496.25, 626.5,
  497.5, 625.25, 497, 624, 493, 623, 491.5, 622.5, 489, 621.5, 487.5, 621.5, 486.5, 620.5, 484.5,
], "pas kostki między pierzeją sklepów a chodnikiem Lubartowskiej na ortofoto PZGiK, w OSM bez nawierzchni");

/**
 * The lawn west of the kiosks w227679373 and w227679388 by the car park w227679484: grass under the
 * trees on the orthophoto, as a bed of the map.
 */
const LAWN_KIOSKS = area("trawnik-przy-kioskach", LAWN, [
  635, 570, 635.5, 569.25, 638, 568, 639, 568, 639.5, 567.5, 641, 567.75, 641, 581, 638.5, 581, 637.25, 580, 637, 578.5, 635.5, 575.5, 635.75, 572.5,
], "trawnik pod drzewami na zachód od kiosków przy parkingu w227679484 na ortofoto PZGiK, w OSM bez obszaru");

/** The pavement round the same kiosks, east of the lawn, to the footway by the street. */
const FRONT_KIOSKS = area("kioski-przy-parkingu", SETTS, [
  641, 568, 641.75, 568.5, 642.25, 570, 646.25, 568.25, 645.25, 565.5, 644, 565.5, 642.68, 563.7, 643.15, 563.51, 646.27, 562.26, 644.99, 559.1,
  644.68, 558.33, 647, 558.25, 648.25, 559.5, 649.5, 563.5, 650.5, 565, 650.5, 566, 651.5, 567.5, 651.5, 570.5, 651, 571, 651, 573, 650.25, 574.5,
  647.5, 577.25, 646.5, 577.5, 646, 578.25, 642.5, 580, 641.5, 581, 641, 581,
], "kostka wokół kiosków przy parkingu w227679484 na ortofoto PZGiK, w OSM bez nawierzchni");

/** The strips along the shops by Ruska (w407019272 among them), between their walls and the street. */
const RUSKA_A = area("ruska-a", SETTS, [
  678, 572.5, 679, 571.5, 680, 571.5, 681.5, 570.5, 685.5, 569.5, 687, 568.5, 689.5, 568, 691, 567, 692, 567, 695.5, 565.5, 699.5, 565.5, 700.5, 566.5,
  700.5, 567.5, 699.5, 568.5, 698.5, 568.5, 697, 569.5, 696, 569.5, 695.5, 570, 693, 570.5, 691.5, 571.5, 687.5, 572.5, 686, 573.5, 683.5, 574, 680.5,
  575.5, 678.75, 575,
], "pas kostki i miejsc postojowych przed sklepami przy Ruskiej na ortofoto PZGiK, w OSM bez nawierzchni");

const RUSKA_B = area("ruska-b", SETTS, [
  674, 579.5, 675.5, 577.75, 677, 577.5, 679.5, 576, 680.5, 576, 682.5, 575, 683.25, 575.25, 685, 574, 687.5, 573.5, 689, 572.5, 693, 571.5, 694.5,
  570.5, 697, 570, 698.5, 569, 699.5, 569, 701.5, 568, 703, 568, 704.5, 567, 705.5, 567, 709, 565.5, 710.25, 565.75, 710, 566.75, 713.75, 578, 713.5,
  578.75, 712.25, 575.5, 709.75, 576.75, 709.5, 580.25, 710, 580.75, 709.5, 581, 686, 581, 685.25, 580, 684.75, 580, 684, 581, 675, 581, 674.25, 580.5,
], "pas kostki i miejsc postojowych przed sklepami przy Ruskiej na ortofoto PZGiK, w OSM bez nawierzchni");

/** The added areas east of the Dworzec Autobusowy, then those of this file. */
export const PODZAMCZE_AREAS: readonly AddedArea[] = [
  ...DWORZEC_EAST_AREAS,
  YARD_NADSTAWNA_4,
  CORNER_NADSTAWNA_4,
  YARD_NADSTAWNA_1_3,
  WEST_NADSTAWNA_1_3,
  BAY_SZKOLNA,
  LAWN_SZKOLNA,
  STOP_SZKOLNA,
  EDGE_DWORZEC,
  BLOCK_LUBARTOWSKA,
  YARD_LSUM,
  FRONT_LUBARTOWSKA_A,
  FRONT_LUBARTOWSKA_B,
  FRONT_LUBARTOWSKA_C,
  LAWN_KIOSKS,
  FRONT_KIOSKS,
  RUSKA_A,
  RUSKA_B,
];
