#!/usr/bin/env bash
# Scala origin/main do bieżącej gałęzi i przelicza tablice mapy jednym poleceniem
# (refleksja 15.11, punkt 2: kilkanaście ręcznych scaleń z konfliktem w props.generated.ts).
#
#   pnpm merge:main [--push]
#
# Kroki:
#  1. git fetch origin main, git merge --no-edit origin/main;
#  2. konflikt tylko w plikach *.generated.ts: bierze wersję main; konflikt w innym pliku:
#     przerywa scalanie (git merge --abort) i wypisuje pliki; potem zawsze przelicza tablice
#     (pnpm osm:build && pnpm osm:props): tablice nie mają już odcisku wejść (ADR-0083, 16.11),
#     a tylko przeliczenie mówi, czy scalenie tekstowe dało to, co daje generator;
#  3. pnpm hashes:check i test skanu glitchy (tools/glitch-scan/test/glitch-scan.test.ts);
#  4. commit scalenia z podsumowaniem; --push wypycha gałąź zwykłym git push.
# Ciężkie kroki idą przez tools/heavy.sh: dwa miejsca zamka na maszynę (docs/agenci-zasady.md).
set -euo pipefail

push=0
for a in "$@"; do
  case "$a" in
    --push) push=1 ;;
    *) echo "nieznany argument: $a" >&2; exit 2 ;;
  esac
done

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" = "HEAD" ] || [ "$branch" = "main" ]; then
  echo "merge:main: stań na gałęzi roboczej (teraz: $branch)" >&2
  exit 2
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "merge:main: drzewo ma niezacommitowane zmiany" >&2
  exit 2
fi

heavy() { bash "$(git rev-parse --show-toplevel)/tools/heavy.sh" "$@"; }

git fetch -q origin main
if git merge-base --is-ancestor origin/main HEAD; then
  echo "merge:main: $branch ma już origin/main"
  exit 0
fi

regen=0
if ! git merge --no-edit -q origin/main >/dev/null 2>&1; then
  mapfile -t conflicts < <(git diff --name-only --diff-filter=U)
  other=()
  for f in "${conflicts[@]}"; do
    case "$f" in
      *.generated.ts) git checkout --theirs -- "$f"; git add -- "$f"; regen=1 ;;
      *) other+=("$f") ;;
    esac
  done
  if [ "${#other[@]}" -gt 0 ]; then
    git merge --abort
    echo "merge:main: konflikty poza tablicami, rozwiąż ręcznie:" >&2
    printf '  %s\n' "${other[@]}" >&2
    exit 1
  fi
fi

# Tablice przeliczamy po każdym scaleniu, także bez konfliktu (ADR-0083): tekstowe scalenie dwóch
# zmian wejść albo tablic może dać wynik niezgodny z generatorem, a odcisku wejść, który by to
# pokazał bez przeliczania, tablice już nie mają (16.11). `regen`: konflikt w tablicach albo
# przeliczenie zmieniło scalone tekstowo tablice.
heavy pnpm -s osm:build >/dev/null
heavy pnpm -s osm:props >/dev/null
git diff --quiet -- packages/sim/src/content/lublin || regen=1
git add -A packages/sim/src/content/lublin

heavy pnpm -s hashes:check
heavy pnpm exec vitest run tools/glitch-scan/test/glitch-scan.test.ts --reporter=dot >/tmp/merge-main-scan.log 2>&1 || {
  echo "merge:main: skan glitchy czerwony po scaleniu, szczegóły w /tmp/merge-main-scan.log" >&2
  exit 1
}

if git rev-parse -q --verify MERGE_HEAD >/dev/null; then
  git commit -q --no-edit
elif [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git commit -q -m "chore: tablice mapy przeliczone po scaleniu origin/main"
fi
main=$(git rev-parse --short origin/main)
echo "merge:main: $branch scalona z origin/main $main$([ "$regen" = 1 ] && echo ', tablice przeliczone'); hashes:check i skan zielone"
[ "$push" = 1 ] && git push -q origin "HEAD:$branch" && echo "merge:main: wypchnięte"
exit 0
