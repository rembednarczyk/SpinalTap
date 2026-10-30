/**
 * One catalog entry (ADR-0056): a plain text, or plural forms picked by `Intl.PluralRules` for
 * the `count` parameter. English needs `one` and `other`; Polish also `few` and `many`.
 */
export type PluralMessage = Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> & { readonly other: string };

export type Message = string | PluralMessage;

/** Named parameters, `{name}` in the text. */
export type MessageParams = Readonly<Record<string, string | number>>;
