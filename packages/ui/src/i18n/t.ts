import type { Locale } from "@seki/core";
import { type MessageKey, en } from "./en";
import type { Message, MessageParams } from "./message";
import { pl } from "./pl";

export type { MessageKey } from "./en";

const CATALOGS: Readonly<Record<Locale, Readonly<Record<MessageKey, Message>>>> = { en, pl };

const pluralRules = new Map<Locale, Intl.PluralRules>();
const rulesFor = (locale: Locale): Intl.PluralRules => {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules;
};

/** Puts named parameters into `{name}` slots; a slot without a parameter stays as it is. */
const interpolate = (text: string, params?: MessageParams): string =>
  params ? text.replace(/\{(\w+)\}/g, (slot, name: string) => (params[name] === undefined ? slot : String(params[name]))) : text;

/** One message as text in `locale`: the plural form for `params.count`, then the parameters. */
export const formatMessage = (locale: Locale, message: Message, params?: MessageParams): string => {
  if (typeof message === "string") return interpolate(message, params);
  const count = typeof params?.count === "number" ? params.count : 0;
  return interpolate(message[rulesFor(locale).select(count)] ?? message.other, params);
};

/** Text for a key in a language: `translate("pl", "slots.slot", { n: 2 })`. */
export const translate = (locale: Locale, key: MessageKey, params?: MessageParams): string => formatMessage(locale, CATALOGS[locale][key], params);

export type Translate = (key: MessageKey, params?: MessageParams) => string;

/** A translator bound to one language, as `useT()` hands it to components. */
export const translator = (locale: Locale): Translate => (key, params) => translate(locale, key, params);

/** Is `key` in the catalogs? For keys built from ids (a control's action, a colour token). */
export const isMessageKey = (key: string): key is MessageKey => Object.hasOwn(en, key);
