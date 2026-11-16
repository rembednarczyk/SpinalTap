#!/usr/bin/env bash
# Pakiet do przeglądu kuratora topografii jednym poleceniem (backlog „Usprawnienia procesu” 15.11:
# każdy przegląd powtarzał ręcznie te same kroki).
#
#   pnpm topo:review [--base REF] [--out DIR] [--no-hashes]
#
# Uruchom w worktree gałęzi zmiany. Zbiera porównanie z bazą (domyślnie merge-base z origin/main):
#  1. zmienione pliki mapy (import, treść lublin, sceny, mapcity, dane, ortofoto);
#  2. pnpm orto:diff BASE HEAD (nawierzchnia, teren, pokłady) + JSON;
#  3. pnpm scan:diff BASE . (klucze skanu, które doszły i odeszły);
#  4. pnpm hashes:check (złote hashe), chyba że --no-hashes;
# i pisze DIR/topo-review.md z listą kontrolną kuratora. Nic nie zmienia w repo.
# Ciężkie kroki idą przez tools/heavy.sh (docs/agenci-zasady.md); wywołane spod seki-heavy biegną od razu.
set -uo pipefail

base=""
out=""
hashes=1
while [ $# -gt 0 ]; do
  case "$1" in
    --base) base="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    --no-hashes) hashes=0; shift ;;
    *) echo "topo:review: nieznany argument: $1" >&2; exit 2 ;;
  esac
done

git fetch -q origin main 2>/dev/null || true
[ -n "$base" ] || base=$(git merge-base HEAD origin/main)
branch=$(git rev-parse --abbrev-ref HEAD)
head=$(git rev-parse --short HEAD)
[ -n "$out" ] || out="${TMPDIR:-/tmp}/topo-review-${branch//\//-}-$head"
mkdir -p "$out"
heavy() { bash "$(git rev-parse --show-toplevel)/tools/heavy.sh" "$@"; }

map_re='^(tools/osm-import/|tools/orto/|tools/gugik/|data/|packages/sim/src/content/lublin/|packages/engine/src/renderer/mapcity/|packages/sim/src/content/.*(scene|site)|tools/glitch-scan/test/baseline/)'
git diff --name-only "$base"...HEAD > "$out/changed-all.txt"
grep -E "$map_re" "$out/changed-all.txt" > "$out/changed-map.txt" || true
if [ -s "$out/changed-map.txt" ]; then
  xargs -a "$out/changed-map.txt" git diff --stat "$base"...HEAD -- > "$out/changed-map-stat.txt"
else
  echo "(brak zmian w plikach mapy)" > "$out/changed-map-stat.txt"
fi

echo "topo:review: orto:diff $base..HEAD"
heavy pnpm -s orto:diff "$base" HEAD --out "$out/orto.json" > "$out/orto.txt" 2>&1
orto_rc=$?
echo "topo:review: scan:diff"
pnpm -s scan:diff "$base" . > "$out/scan.txt" 2>&1
scan_rc=$?
hash_rc="pominięte"
if [ "$hashes" = 1 ]; then
  echo "topo:review: hashes:check"
  heavy pnpm -s hashes:check > "$out/hashes.txt" 2>&1
  hash_rc=$?
fi

section() { echo; echo "## $1"; echo; echo '```'; head -c 6000 "$2" 2>/dev/null; echo; echo '```'; }
{
  echo "# Pakiet przeglądu topografii: $branch @ $head"
  echo
  echo "Baza: \`$(git rev-parse --short "$base")\`. Pliki mapy zmienione: $(wc -l < "$out/changed-map.txt") z $(wc -l < "$out/changed-all.txt"). Kody wyjścia: orto:diff $orto_rc, scan:diff $scan_rc, hashes:check $hash_rc."
  section "Zmienione pliki mapy" "$out/changed-map-stat.txt"
  section "orto:diff (pełny wynik: orto.json)" "$out/orto.txt"
  section "scan:diff (klucze, które doszły i odeszły)" "$out/scan.txt"
  [ "$hashes" = 1 ] && section "hashes:check" "$out/hashes.txt"
  cat <<'EOF'

## Lista kontrolna kuratora (CLAUDE.md, „Topografia Lublina”)
- [ ] Każde nowe odstępstwo od OSM, NMT i ortofoto jest celowe z powodem (wpis T) albo zgłoszone jako glitch.
- [ ] Nowe klucze skanu: każdy wyjaśniony (prawdziwa usterka do poprawy albo fałszywy alarm z uzasadnieniem w commicie).
- [ ] Zmienione złote hashe: zmiana świadoma i opisana w commicie.
- [ ] Miejsca z największą zmianą w orto:diff obejrzane na ortofoto (nakładka) i na zrzucie z gry z modelami.
- [ ] Zabytki i osie widokowe bez nowych przesłon.
- [ ] Werdykt: ZGODNE / ODSTĘPSTWO CELOWE (wpis T) / ODSTĘPSTWO NIEZAMIERZONE (lista poprawek: miejsce, oczekiwana wartość, źródło), gotowe polecenia `rej.py`.
EOF
} > "$out/topo-review.md"
echo "topo:review: $out/topo-review.md"
