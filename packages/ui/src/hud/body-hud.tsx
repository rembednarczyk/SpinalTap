import type { BuffId } from "@seki/core";
import { keyLabel } from "../menus/key-label";
import { useT, useText } from "../i18n/use-t";
import { useUi } from "../use-ui";

const BUFF_ICON: Readonly<Record<BuffId, string>> = {
  regen: "✚",
  quick_cooldown: "⟳",
  steady: "◎",
};

/** Timed buffs from food and drinks (ADR-0032): an icon, the name and the seconds left. */
export const BuffIcons = () => {
  const t = useT();
  const tx = useText();
  const buffs = useUi((s) => s.buffs);
  if (buffs.length === 0) return null;
  return (
    <ul className="buffs" aria-label={t("buffs.label")} data-testid="buffs">
      {buffs.map((b) => (
        <li key={b.id} className={`buff buff--${b.id}${b.left <= 5 ? " buff--ending" : ""}`} data-testid={`buff-${b.id}`} title={tx(b.name)}>
          <span className="buff__icon" aria-hidden="true">
            {BUFF_ICON[b.id]}
          </span>
          <span className="buff__name">{tx(b.name)}</span>
          <span className="buff__left">{b.left} s</span>
          <span
            className="buff__bar"
            style={{
              transform: `scaleX(${b.total > 0 ? Math.min(1, b.left / b.total) : 0})`,
            }}
          />
        </li>
      ))}
    </ul>
  );
};

/** The dash (legs cyberware): ready, or the cooldown running out as a ring. */
export const DashIcon = () => {
  const t = useT();
  const dash = useUi((s) => s.dash);
  const code = useUi((s) => s.controls.find((c) => c.action === "dash")?.codes[0]);
  if (!dash) return null;
  const ready = dash.cooldown <= 0;
  const share = dash.total > 0 ? 1 - Math.min(1, dash.cooldown / dash.total) : 1;
  return (
    <div className={`dash${ready ? " dash--ready" : ""}`} data-testid="dash" aria-label={ready ? t("dash.ready") : t("dash.cooldown", { seconds: dash.cooldown.toFixed(1) })}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="dash__track" cx="18" cy="18" r="15" />
        <circle className="dash__ring" cx="18" cy="18" r="15" pathLength={100} strokeDasharray={`${Math.round(share * 100)} 100`} />
        <path className="dash__glyph" d="M9 18 H21 M17 13 L22 18 L17 23 M12 13 L17 18 L12 23" />
      </svg>
      <span className="dash__state">{ready ? keyLabel(code ?? "AltLeft") : `${dash.cooldown.toFixed(1)} s`}</span>
    </div>
  );
};

/** Who the player passes for, next to the health bar; blinks red once the disguise is blown. */
export const DisguiseBadge = () => {
  const disguise = useUi((s) => s.disguise);
  const t = useT();
  if (!disguise) return null;
  return (
    <div className={`disguise${disguise.blown ? " disguise--blown" : ""}`} data-testid="disguise" role={disguise.blown ? "alert" : undefined}>
      <span className="disguise__icon" aria-hidden="true">
        {disguise.blown ? "!" : "◐"}
      </span>
      <span className="disguise__label">{disguise.blown ? t("disguise.blownBadge", { disguise: disguise.label }) : disguise.label}</span>
    </div>
  );
};

/** Hooks found during the contract, under the objective: other ways through. */
export const HookList = () => {
  const t = useT();
  const hooks = useUi((s) => s.contractHooks);
  if (hooks.length === 0) return null;
  return (
    <ul className="hud__hooks" data-testid="contract-hooks" aria-label={t("contract.hooks")}>
      {hooks.map((h) => (
        <li key={h.id} className="hud__hook">
          <span aria-hidden="true">⌖</span> {h.text}
        </li>
      ))}
    </ul>
  );
};
