#!/usr/bin/env bash
# Ciężkie zadanie (build, e2e, zrzuty, hashes:check, osm:build/props) w jednym z dwóch miejsc
# zamka na maszynę (decyzja użytkownika 15.11: dwa naraz zamiast jednego; 4 rdzenie, ok. 8 GB
# wolnej pamięci). Bierze pierwsze wolne z /tmp/seki-heavy.lock i /tmp/seki-heavy-2.lock;
# zwraca kod wyjścia polecenia.
#   bash tools/heavy.sh <polecenie> [argumenty...]   (kopia poza repo: /home/user/bin/seki-heavy)
# SEKI_HEAVY_MERGE=1: trzecie miejsce tylko dla scaleń orkiestratora (`pnpm merge:main`, decyzja
# użytkownika 15.11), żeby kolejka PR-ów nie czekała na testy agentów; jedno scalenie naraz.
set -u
[ $# -gt 0 ] || { echo "użycie: tools/heavy.sh <polecenie> [argumenty...]" >&2; exit 2; }
# Already inside a slot (a heavy script calling heavy steps, or `seki-heavy pnpm topo:review`):
# run directly. Taking a second slot from inside the first waited on itself (15.11, topo:review).
if [ -n "${SEKI_HEAVY_SLOT:-}" ]; then exec "$@"; fi
locks="/tmp/seki-heavy.lock /tmp/seki-heavy-2.lock"
[ -n "${SEKI_HEAVY_MERGE:-}" ] && locks="/tmp/seki-heavy-merge.lock"
# Wait for a slot goes to SEKI_HEAVY_LOG (decision of the user 16.11: measure the queue before
# changing the number of agents). One line per task: start, seconds waited, slot, command.
export SEKI_HEAVY_T0="$(date +%s)"
export SEKI_HEAVY_LOG="${SEKI_HEAVY_LOG:-/tmp/seki-heavy-wait.log}"
while :; do
  for lock in $locks; do
    SEKI_HEAVY_SLOT="$lock" flock -n -E 200 "$lock" bash -c \
      'printf "%s wait=%ss slot=%s cmd=%s\n" "$(date +%FT%T)" "$(( $(date +%s) - SEKI_HEAVY_T0 ))" "$SEKI_HEAVY_SLOT" "$*" >> "$SEKI_HEAVY_LOG" 2>/dev/null; exec "$@"' heavy "$@"
    rc=$?
    [ "$rc" -ne 200 ] && exit "$rc"
  done
  sleep 3
done
