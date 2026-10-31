import { useEffect } from "react";
import type { ContractBadge, Locale } from "@seki/core";
import { formatNumber, useLocale } from "../i18n/number";
import { useT } from "../i18n/use-t";
import { useContractIntents, useUi } from "../use-ui";

/** Icon (24 px SVG path) of each badge; the name and the meaning are `badge.<id>` and `badge.<id>.hint` (ADR-0056). */
export const BADGE_ICON: Readonly<Record<ContractBadge, string>> = {
  ghost:
    "M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12 Z M12 9 A3 3 0 1 1 11.99 9 Z M4 20 L20 4",
  no_alarm: "M6 17 V11 A6 6 0 0 1 18 11 V17 Z M10 20 H14 M4 20 L20 4",
  clean:
    "M12 3 A9 9 0 1 1 11.99 3 Z M12 10 A2 2 0 1 1 11.99 10 Z M12 1 V5 M12 19 V23 M1 12 H5 M19 12 H23",
  untouched: "M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z",
  swift: "M13 2 L4 14 H11 L10 22 L20 9 H13 Z",
  netrunner:
    "M7 7 H17 V17 H7 Z M10 3 V7 M14 3 V7 M10 17 V21 M14 17 V21 M3 10 H7 M3 14 H7 M17 10 H21 M17 14 H21",
};

export const BadgeIcon = ({ badge }: { badge: ContractBadge }) => (
  <svg className="badge-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d={BADGE_ICON[badge]} />
  </svg>
);

const money = (locale: Locale, n: number) => `${formatNumber(locale, n)} €$`;

/** "m:ss". */
export const formatSeconds = (s: number): string => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** Seconds the card stays up when nobody closes it. */
const CARD_SECONDS = 15;

/**
 * End-of-contract card (ADR-0028): rank, the badges earned (with the fixer's style marked),
 * the pay split into the rate, the condition bonus and the style bonus, and the time. Waits
 * until the conversation that paid it is over; Enter, the button or 15 s close it.
 */
export const DebriefCard = () => {
  const debrief = useUi((s) => s.debrief);
  const talking = useUi((s) => s.dialogue !== null);
  const intents = useContractIntents();
  const shown = debrief !== null && !talking;
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => intents.dismissDebrief(), CARD_SECONDS * 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "NumpadEnter")
        intents.dismissDebrief();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [shown, intents]);

  if (!shown) return null;
  const total = debrief.reward + debrief.bonus + debrief.styleBonus;
  return (
    <section
      className="debrief"
      data-testid="debrief"
      aria-label={t("debrief.label")}
    >
      <header className="debrief__head">
        <div>
          <div className="debrief__eyebrow">
            {t("debrief.done")}
            {debrief.fixer ? ` · ${debrief.fixer}` : ""}
          </div>
          <div className="debrief__title">{debrief.title}</div>
        </div>
        <div
          className={`debrief__rank debrief__rank--${debrief.rank}`}
          data-testid="debrief-rank"
          aria-label={t("debrief.rank", { rank: debrief.rank })}
        >
          {debrief.rank}
          <span className="debrief__rank-text">
            {t(`rank.${debrief.rank}`)}
          </span>
        </div>
      </header>
      {debrief.variation && (
        <p className="debrief__variation" data-testid="debrief-variation">
          {debrief.variation.labels.join(" · ")}
          {debrief.variation.twist && (
            <b className="debrief__twist"> · {debrief.variation.twist}</b>
          )}
        </p>
      )}
      <ul className="debrief__badges">
        {debrief.badges.map((b) => (
          <li
            key={b.id}
            className={`debrief__badge${b.earned ? " debrief__badge--earned" : ""}${b.style ? " debrief__badge--style" : ""}`}
            data-testid={`badge-${b.id}`}
            title={t(`badge.${b.id}.hint`)}
          >
            <BadgeIcon badge={b.id} />
            <span className="debrief__badge-label">{t(`badge.${b.id}`)}</span>
            <span className="debrief__badge-state">{b.earned ? "✓" : "✗"}</span>
            {b.style && (
              <span className="debrief__badge-style">{t("debrief.style")}</span>
            )}
          </li>
        ))}
      </ul>
      <dl className="debrief__pay">
        <div>
          <dt>{t("debrief.rate")}</dt>
          <dd>{money(locale, debrief.reward)}</dd>
        </div>
        <div>
          <dt>{t("debrief.bonus")}</dt>
          <dd>
            {debrief.bonus > 0 ? `+${money(locale, debrief.bonus)}` : "—"}
          </dd>
        </div>
        <div>
          <dt>
            {t("debrief.styleBonus")}
            {debrief.fixer ? ` (${debrief.fixer})` : ""}
          </dt>
          <dd>
            {debrief.styleBonus > 0
              ? `+${money(locale, debrief.styleBonus)}`
              : "—"}
          </dd>
        </div>
        <div className="debrief__total">
          <dt>{t("debrief.total")}</dt>
          <dd data-testid="debrief-total">{money(locale, total)}</dd>
        </div>
        <div>
          <dt>{t("debrief.time")}</dt>
          <dd>{formatSeconds(debrief.seconds)}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="debrief__close"
        onClick={() => intents.dismissDebrief()}
      >
        {t("debrief.next")} <kbd>Enter</kbd>
      </button>
    </section>
  );
};

/** The condition bonus next to the objective: kept (✓) or lost for good (✗, struck through). */
export const BonusIndicator = () => {
  const bonus = useUi((s) => s.contractBonus);
  const t = useT();
  const locale = useLocale();
  if (!bonus) return null;
  return (
    <div
      className={`hud__bonus${bonus.kept ? "" : " hud__bonus--lost"}`}
      data-testid="contract-bonus"
      aria-label={t(bonus.kept ? "debrief.bonusKept" : "debrief.bonusLost")}
    >
      <BadgeIcon badge={bonus.badge} />
      <span className="hud__bonus-label">{bonus.label}</span>
      <span className="hud__bonus-pay">+{money(locale, bonus.bonus)}</span>
      <span className="hud__bonus-state">{bonus.kept ? "✓" : "✗"}</span>
    </div>
  );
};
