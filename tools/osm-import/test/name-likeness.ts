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

/** The consonants of a word: KEFCE and KFC are one skeleton. */
const skeleton = (w: string): string => w.replace(/[aeiou]/g, "");

/** Length of the longest run of letters two words share. */
export const sharedRun = (a: string, b: string): number => {
  let best = 0;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    let k = 0;
    while (a[i + k] !== undefined && a[i + k] === b[j + k]) k++;
    best = Math.max(best, k);
  }
  return best;
};

/** Whether a word of a name plays on a word of the real one, as the rules of 1.11 have it. */
const near = (n: string, f: string): boolean => {
  if (f.length < 4) return n === f || (f.length === 3 && (levenshtein(n, f) <= 1 || skeleton(n) === skeleton(f)));
  return n.includes(f) || levenshtein(n, f) <= (f.length >= 6 ? 2 : 1) || (f.length >= 5 && sharedRun(n, f) >= 5);
};

/**
 * Why `name` is too like `real`, or null. The words are compared in their phonetic spelling,
 * the common words of a kind and words of two letters aside: the name glued contains the real
 * one's own words glued; or a word of it contains a real word, is a letter off one of four or
 * five letters (two off one of six and more), shares a run of five letters with it (a diminutive,
 * a word grown from the mark's root) or, for a mark of three letters, is a letter off it or has
 * its consonants. A real name of common words only is compared whole, glued.
 */
export const likeness = (name: string, real: string): string | null => {
  const all = phonetic(real);
  const own = all.filter((w) => w.length > 2 && !COMMON_WORDS.has(w));
  const words = phonetic(name);
  const glued = words.join("");
  if (own.length === 0) {
    const whole = all.join("");
    return whole.length >= 4 && (glued.includes(whole) || levenshtein(glued, whole) <= 2) ? `${name} is ${real}` : null;
  }
  const gluedReal = own.join("");
  if (gluedReal.length >= 4 && glued.includes(gluedReal)) return `${name} contains ${real}`;
  for (const f of own) {
    for (const n of words.filter((w) => w.length > 2 && !COMMON_WORDS.has(w))) {
      if (near(n, f)) return `${name}: ${n} ~ ${f} (${real})`;
    }
  }
  return null;
};

/**
 * Motifs of logos, slogans and marks put into other words (the verifier's list of 1.11): a name
 * with a word starting with each stem of an entry recalls the mark without naming it.
 */
export const MOTIFS: readonly (readonly [stems: readonly string[], mark: string])[] = [
  [["zlot", "luk"], "McDonald's: the golden arches"],
  [["siren"], "Starbucks: the siren"],
  [["zubr"], "Pekao, and a beer: the bison"],
  [["skarbon"], "PKO BP: the money box"],
  [["zaba"], "Żabka: the frog"],
  [["zabk"], "Żabka: the frog"],
  [["zabi"], "Żabka: the frog"],
  [["rzekot"], "Żabka: the frog"],
  [["lew", "bank"], "Alior: the lion at a bank"],
  [["lwa", "bank"], "Alior: the lion at a bank"],
  [["lwi", "bank"], "Alior: the lion at a bank"],
  [["tisiakle"], "Millennium: the millennium"],
  [["blizni"], "Gemini: the twins"],
  [["plomie"], "Oriflame: the flame"],
  [["plomik"], "Oriflame: the flame"],
  [["roslin", "piekn"], "Yves Rocher: its slogan"],
  [["krol", "burger"], "Burger King: the king at burgers"],
  [["krol", "kotlet"], "Burger King: the king at burgers"],
  [["king", "burger"], "Burger King: the king at burgers"],
];

/** The motif a name recalls, or null. */
export const motifOf = (name: string): string | null => {
  const words = phonetic(name);
  return MOTIFS.find(([stems]) => stems.every((s) => words.some((w) => w.startsWith(s))))?.[1] ?? null;
};
