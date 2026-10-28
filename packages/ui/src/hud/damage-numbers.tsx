import { useUi } from "../use-ui";

/**
 * Damage numbers by the crosshair (off by default; per hit or a running total per target in
 * the settings). They rise and fade; a critical one is amber and bigger.
 */
export const DamageNumbers = () => {
  const mode = useUi((s) => s.settings.damageNumbers);
  const numbers = useUi((s) => s.damageNumbers);
  if (mode === "off" || numbers.length === 0) return null;
  return (
    <div className="dmg" data-testid="damage-numbers" aria-hidden="true">
      {numbers.map((n, i) => (
        <span
          key={`${n.id}-${n.rev}`}
          className={`dmg__n${n.critical ? " dmg__n--crit" : ""}`}
          // Each new number a little to the side of the last, so a burst stays readable.
          style={{ left: `${((i % 3) - 1) * 26}px` }}
        >
          {Math.round(n.amount)}
        </span>
      ))}
    </div>
  );
};
