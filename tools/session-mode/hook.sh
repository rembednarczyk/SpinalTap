#!/usr/bin/env bash
# Tryb nieobecności użytkownika (decyzja z 17.11): hook UserPromptSubmit.
# `--asleep` w prompcie włącza tryb (plik stanu), `--waken` go wyłącza.
# Póki tryb trwa, każdy prompt (także wybudzenia pętli) dostaje regułę:
# decyzje rekomendowane, zapis w backlogu. Czyta JSON hooka ze stdin.
set -euo pipefail

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
state="${SEKI_SESSION_MODE_STATE:-$root/.claude/asleep}"
prompt="$(jq -r '.prompt // ""')"

# Ostatnia z flag w prompcie wygrywa; flaga to osobne słowo.
last="$(printf '%s\n' "$prompt" | grep -oE '(^|[[:space:]])--(asleep|waken)([[:space:]]|$)' | tail -n 1 | tr -d '[:space:]' || true)"

rules() {
  cat <<TXT
Tryb nieobecności (--asleep) trwa od $(cat "$state"). Użytkownik śpi albo jest poza sesją.
- Nie zadawaj pytań (AskUserQuestion) i nie czekaj na odpowiedź. Przy każdej decyzji dla użytkownika wybierz opcję, którą sam rekomendujesz.
- Każdy taki wybór zapisz w docs/backlog.md: data, pytanie, wybór, powód i dopisek „rekomendowana, pod nieobecność”.
- Zasady z docs/agenci-zasady.md i CLAUDE.md obowiązują bez zmian. Zrzuty z modelami i APK wysyłaj jak zwykle (SendUserFile), żeby czekały na użytkownika.
- Raporty rund pisz krótko; użytkownik przeczyta je po powrocie. Tryb kończy prompt z --waken.
TXT
}

emit() { jq -n --arg ctx "$1" --arg msg "$2" '{systemMessage: $msg, hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}'; }

case "$last" in
  --asleep)
    mkdir -p "$(dirname "$state")"
    [ -f "$state" ] || date '+%Y-%m-%d %H:%M %Z' > "$state"
    emit "$(rules)" "Tryb nieobecności włączony (--asleep)."
    ;;
  --waken)
    if [ -f "$state" ]; then
      since="$(cat "$state")"
      rm -f "$state"
      emit "Tryb nieobecności (--asleep) wyłączony; trwał od $since. Użytkownik wrócił: pytania znów zadawaj jak zwykle. Na początku odpowiedzi podsumuj krótko decyzje podjęte pod nieobecność (wpisy w docs/backlog.md z dopiskiem „rekomendowana, pod nieobecność”)." "Tryb nieobecności wyłączony (--waken)."
    else
      emit "Użytkownik podał --waken, ale tryb nieobecności nie był włączony." "Tryb nieobecności nie był włączony."
    fi
    ;;
  *)
    if [ -f "$state" ]; then emit "$(rules)" "Tryb nieobecności trwa (--waken kończy)."; fi
    ;;
esac
