/**
 * How alike a 2077 sign name and a real name are, for the `venue-names` test (ADR-0064 stage 4,
 * decision of 1.11: further parodies). Names are compared as they sound: a parody may play on the
 * real name, but never differ from it by a letter, sound the same or repeat a word of it, the
 * words every shop of a kind uses aside.
 */

/** Lower case, no diacritics, `ph`→f, `qu`→k, v→w, x→ks, c→k outside cz/ch, y→i, doubled letters once. */
export const phonetic = (s: string): string[] =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/gi, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) =>
      w
        .replace(/ph/g, "f")
        .replace(/qu/g, "k")
        .replace(/v/g, "w")
        .replace(/x/g, "ks")
        .replace(/c(?![zh])/g, "k")
        .replace(/y/g, "i")
        .replace(/(.)\1+/g, "$1"),
    );

/** Words any venue of its kind may carry, real or 2077, in their phonetic spelling. */
export const COMMON_WORDS: ReadonlySet<string> = new Set(
  [
    "bank", "apteka", "kantor", "kawiarnia", "kawa", "cafe", "piekarnia", "cukiernia", "bar", "pub", "kebab", "pizza", "sklep", "salon", "salony", "studio", "optyk",
    "fryzjer", "fryzjerskie", "galeria", "ksiegarnia", "sushi", "ramen", "bistro", "restauracja", "trattoria", "lody", "jubiler", "barber", "tattoo", "shop", "medyczny",
    "sztuki", "delikatesy", "garmazerka", "klub", "club", "centrum", "upominki", "dewocjonalia", "kosmetyka", "lodziarnia", "drogeria", "kwiaciarnia", "spa",
    "burger", "piwa", "wodki", "ksiazki", "czekolady", "pijalnia", "bez", "pod", "nad", "dla", "przy", "the",
  ].flatMap(phonetic),
);

/** Edit distance of two words. */
export const levenshtein = (a: string, b: string): number => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row.push(Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = row;
  }
  return prev[b.length]!;
};

/**
 * Why `name` is too like `real`, or null: its words glued contain the real name's own words
 * glued; or a word of it is a real word, contains one, or is one letter off a real word of four
 * letters and more (two off one of seven and more). Words of two letters and fewer, and the
 * common words of a kind, do not count.
 */
export const likeness = (name: string, real: string): string | null => {
  const own = phonetic(real).filter((w) => w.length > 2 && !COMMON_WORDS.has(w));
  if (own.length === 0) return null;
  const words = phonetic(name);
  const glued = words.join("");
  const gluedReal = own.join("");
  if (gluedReal.length >= 4 && glued.includes(gluedReal)) return `${name} contains ${real}`;
  for (const f of own) {
    for (const n of words.filter((w) => w.length > 2 && !COMMON_WORDS.has(w))) {
      if (f.length < 4 ? n === f : n.includes(f) || levenshtein(n, f) <= (f.length >= 7 ? 2 : 1)) return `${name}: ${n} ~ ${f} (${real})`;
    }
  }
  return null;
};
