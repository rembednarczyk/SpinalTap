#!/usr/bin/env bash
# Pobiera APK z artefaktu CI do katalogu sesji i sprząta stare paczki (backlog „Usprawnienia
# procesu” 15.11: APK po każdym scaleniu pobierany ręcznie, stare paczki zapełniały dysk).
#
#   bash tools/apk-fetch.sh <download_url> <sha> <katalog> [--keep N]
#
# <download_url>: krótko ważny link z download_workflow_run_artifact (GitHub MCP, artefakt
# seki-senshi-apk z workflow android.yml). Plik trafia do <katalog>/<sha>/; zostaje N
# najnowszych paczek (domyślnie 2), starsze katalogi są usuwane. Wypisuje ścieżkę APK.
set -euo pipefail
[ $# -ge 3 ] || { echo "użycie: apk-fetch.sh <download_url> <sha> <katalog> [--keep N]" >&2; exit 2; }
url=$1; sha=${2:0:7}; root=$3; keep=2
[ "${4:-}" = "--keep" ] && keep=${5:?--keep wymaga liczby}
case "$sha" in *[!0-9a-f]*|"") echo "apk-fetch: sha ma być szesnastkowy" >&2; exit 2 ;; esac
dir="$root/$sha"
mkdir -p "$dir"
curl -sSf -A "SekiSenshi-topo/1.0" -o "$dir/apk.zip" "$url"
unzip -o -q "$dir/apk.zip" -d "$dir"
rm -f -- "$dir/apk.zip"
apk=$(find "$dir" -maxdepth 1 -name '*.apk' | head -1)
[ -n "$apk" ] || { echo "apk-fetch: w artefakcie nie ma pliku .apk" >&2; exit 1; }
# Starsze paczki: zostaje $keep najnowszych katalogów (z bieżącym).
ls -1dt "$root"/*/ 2>/dev/null | tail -n +$((keep + 1)) | while read -r old; do
  rm -rf -- "${old%/}"
done
echo "$apk"
