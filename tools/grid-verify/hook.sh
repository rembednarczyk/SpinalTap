#!/usr/bin/env bash
# Hook Stop nowej siatki (`.claude/skills/nowa-siatka/SKILL.md`): póki trwa praca nad siatką (`.claude/grid-active`,
# zapisany przez `pnpm grid:verify <nazwa> --start`), sesja nie kończy tury bez aktualnego raportu
# `reports/grid-<nazwa>.json` z rozstrzygniętymi wszystkimi punktami. Raport z innego commita albo z innym stanem
# drzewa się nie liczy. Wyłączenie: `pnpm grid:verify <nazwa> --stop`. Czyta JSON hooka ze stdin.
set -euo pipefail

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
active="$root/.claude/grid-active"
[ -f "$active" ] || exit 0
[ "$(jq -r '.stop_hook_active // false')" = "true" ] && exit 0

name="$(head -n 1 "$active" | tr -d '[:space:]')"
report="$root/reports/grid-$name.json"
head="$(git -C "$root" rev-parse HEAD)"
dirty=false
[ -n "$(git -C "$root" status --porcelain)" ] && dirty=true

block() { jq -n --arg r "$1" '{decision: "block", reason: $r}'; exit 0; }

[ -f "$report" ] || block "Siatka $name: brak raportu. Uruchom pnpm grid:verify $name (z --full przed PR-em) i rozstrzygnij punkty."
if [ "$(jq -r '.head' "$report")" != "$head" ] || [ "$(jq -r '.brudne' "$report")" != "$dirty" ]; then
  block "Siatka $name: raport jest z innego stanu repozytorium. Uruchom ponownie pnpm grid:verify $name."
fi
left="$(jq -r '[.punkty[] | select(.status != "ok" and .status != "zrobione" and .status != "przyjete") | "- \(.faza): \(.opis) [\(.status)]"] | join("\n")' "$report")"
[ -z "$left" ] || block "Siatka $name: punkty do rozstrzygnięcia (napraw, zgłoś glitch albo zapisz decyzję z odnośnikiem w docs/siatki/$name.json):
$left"
exit 0
