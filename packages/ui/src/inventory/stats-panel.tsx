import type { CharacterStatsVm } from "../store/ui-store";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const one = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 1 });

/** HP, armor per zone, crits and the aim cone of the weapon in hand, as the game counts them. */
export const StatsPanel = ({ stats }: { stats: CharacterStatsVm | null }) => {
  if (!stats) return null;
  const a = stats.armor;
  return (
    <dl className="inv__stats" data-testid="stats-panel">
      <div className="inv__stat">
        <dt>HP</dt>
        <dd>
          {Math.ceil(stats.hp)}/{stats.maxHp}
        </dd>
      </div>
      <div className="inv__stat" title="Pancerz: głowa, tors, ręce, nogi">
        <dt>Pancerz</dt>
        <dd>
          G{one(a.head)} T{one(a.torso)} R{one(a.arm)} N{one(a.leg)}
        </dd>
      </div>
      <div className="inv__stat">
        <dt>Kryt</dt>
        <dd>
          {pct(stats.critChance)} ×{one(stats.critMultiplier)}
        </dd>
      </div>
      <div className="inv__stat">
        <dt>Rozrzut</dt>
        <dd>{stats.spread === null ? "brak" : `${one(stats.spread)}°`}</dd>
      </div>
    </dl>
  );
};
