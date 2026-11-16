import { describe, expect, it } from "vitest";
import { COVER, type Colour, classify, classifySite } from "../src/classify.ts";

/** The classes of a finished site's land (G-872): its flights read one by one. */
describe("classifySite", () => {
  const grey: Colour = [100, 98, 100];

  it("takes a lawn from a summer flight's green, paving from its light", () => {
    const summerGreen: Colour[] = [grey, grey, [100, 106, 100]];
    expect(classify(summerGreen)).toBe(COVER.asphalt);
    expect(classifySite(summerGreen)).toBe(COVER.green);
    const summerLight: Colour[] = [[100, 100, 100], [100, 100, 100], [160, 158, 155]];
    expect(classify(summerLight)).toBe(COVER.asphalt);
    expect(classifySite(summerLight)).toBe(COVER.paving);
  });

  it("takes the leaf-off flight's green where both summers are in the building's shade, else leaves it to the plot round it", () => {
    const shadedSummers: Colour[] = [[90, 100, 85], [40, 45, 60], [45, 48, 62]];
    expect(classify(shadedSummers)).toBe(COVER.asphalt);
    expect(classifySite(shadedSummers)).toBe(COVER.green);
    const unread: Colour[] = [[60, 60, 70], [45, 45, 55], [50, 50, 60]];
    expect(classify(unread)).toBe(COVER.asphalt);
    expect(classifySite(unread)).toBe(COVER.shadow);
  });

  it("makes green under crowns a lawn and keeps what the flights together read", () => {
    const crowns: Colour[] = [[100, 102, 98], [50, 110, 40], [55, 115, 45]];
    expect(classify(crowns)).toBe(COVER.canopy);
    expect(classifySite(crowns)).toBe(COVER.green);
    expect(classifySite([[170, 165, 155], [160, 158, 150], [165, 160, 150]])).toBe(COVER.paving);
    expect(classifySite([[95, 100, 80], [60, 95, 45], [70, 105, 50]])).toBe(COVER.green);
  });
});
