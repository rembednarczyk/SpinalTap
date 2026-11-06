import { type CyberwareId, type ImplantGrade, deckStats, isGradedImplant } from "@seki/core";
import { formatNumber, useLocale } from "../i18n/number";
import { useT } from "../i18n/use-t";

/**
 * What a cyberdeck of this grade does (decision of 6.11 after ADR-0059 stage 6): its RAM, the share
 * it takes off the upload and the share it adds to RAM recovery. Nothing for other implants.
 */
export const DeckLine = ({ id, grade, className = "inv__meta" }: { readonly id: CyberwareId; readonly grade: ImplantGrade; readonly className?: string }) => {
  const t = useT();
  const locale = useLocale();
  if (!isGradedImplant(id)) return null;
  const deck = deckStats(id, grade);
  const pct = (share: number): string => formatNumber(locale, Math.round(share * 1000) / 10, { maximumFractionDigits: 1 });
  return (
    <div className={className} data-testid="deck-stats">
      {t("inventory.detail.deck", { ram: deck.ram, upload: pct(1 - deck.uploadScale), regen: pct(deck.regenScale - 1) })}
    </div>
  );
};
