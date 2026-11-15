#!/usr/bin/env bash
# Ciężkie zadanie (build, e2e, zrzuty, hashes:check, osm:build/props) w jednym z dwóch miejsc
# zamka na maszynę (decyzja użytkownika 15.11: dwa naraz zamiast jednego; 4 rdzenie, ok. 8 GB
# wolnej pamięci). Bierze pierwsze wolne z /tmp/seki-heavy.lock i /tmp/seki-heavy-2.lock;
# zwraca kod wyjścia polecenia.
#   bash tools/heavy.sh <polecenie> [argumenty...]   (kopia poza repo: /home/user/bin/seki-heavy)
set -u
[ $# -gt 0 ] || { echo "użycie: tools/heavy.sh <polecenie> [argumenty...]" >&2; exit 2; }
# Already inside a slot (a heavy script calling heavy steps, or `seki-heavy pnpm topo:review`):
# run directly. Taking a second slot from inside the first waited on itself (15.11, topo:review).
if [ -n "${SEKI_HEAVY_SLOT:-}" ]; then exec "$@"; fi
while :; do
  for lock in /tmp/seki-heavy.lock /tmp/seki-heavy-2.lock; do
    SEKI_HEAVY_SLOT="$lock" flock -n -E 200 "$lock" "$@"
    rc=$?
    [ "$rc" -ne 200 ] && exit "$rc"
  done
  sleep 3
done
