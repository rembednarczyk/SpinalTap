import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, isLocale } from "../src";

describe("locale (ADR-0056)", () => {
  it("defaults to English and knows only the shipped languages", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES).toEqual(["en", "pl"]);
    for (const l of LOCALES) expect(isLocale(l)).toBe(true);
    for (const v of ["de", "EN", "", null, undefined, 1]) expect(isLocale(v)).toBe(false);
  });
});
