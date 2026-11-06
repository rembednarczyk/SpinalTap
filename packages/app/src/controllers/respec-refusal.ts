import { type DomainState, type Locale, type RespecFailure, SHOPS, respecPrice, respecRefusal, shopTerms } from "@seki/core";
import { type MessageKey, formatNumber, translate } from "@seki/ui";

/** The catalog key of what to do about each refusal (G-366: the toast tells her the way out). */
const HINT: Readonly<Record<RespecFailure, MessageKey>> = {
  refused: "respec.refused.terms",
  "insufficient-funds": "respec.refused.funds",
  "empty-slot": "respec.refused.nothing",
};

/**
 * Why Mori would refuse the respec now, as the text of the counter's toast in `locale`, or null
 * when it goes through: the core rule the simulation charges by (ADR-0059), checked before the
 * command so the refusal says what to do instead of the generic purchase failure.
 */
export const respecRefusalText = (domain: DomainState, locale: Locale): string | null => {
  const terms = shopTerms(domain.reputation[SHOPS.clinic.owner]);
  const reason = respecRefusal(domain.wallet, domain.progression, terms);
  if (!reason) return null;
  return translate(locale, HINT[reason], { price: `${formatNumber(locale, respecPrice(domain.progression.level, terms))} €$` });
};
