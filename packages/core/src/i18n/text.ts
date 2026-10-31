/**
 * A text for the player as the domain hands it over (ADR-0056): a catalog key, or a key with
 * named parameters. Core and sim never hold sentences; app and ui turn a key into text in the
 * player's language. A parameter that is a `TextRef` is translated too (a site inside an
 * objective); a string parameter is put in as it is (a clock, a name).
 */
export interface TextRef {
  readonly key: string;
  readonly params?: Readonly<Record<string, TextParam>>;
}

export type TextParam = string | number | TextRef;

/** A bare key, or a key with parameters. */
export type DomainText = string | TextRef;

/** A key with parameters, `textRef("contract.objective.eliminate", { targets: 3 })`. */
export const textRef = (key: string, params?: Readonly<Record<string, TextParam>>): TextRef => (params ? { key, params } : { key });
