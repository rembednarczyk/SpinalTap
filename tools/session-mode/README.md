# Tryb nieobecności (`--asleep` / `--waken`)

Decyzja użytkownika z 17.11. Hook `UserPromptSubmit` z `.claude/settings.json` uruchamia `hook.sh` przy każdym prompcie.

- `--asleep` w prompcie (osobne słowo) włącza tryb: powstaje plik stanu `.claude/asleep` z czasem włączenia (poza gitem).
- Póki plik istnieje, każdy prompt, także wybudzenie pętli, dostaje kontekst z regułą: bez pytań do użytkownika, wybór opcji rekomendowanej i wpis w `docs/backlog.md` z dopiskiem „rekomendowana, pod nieobecność”.
- `--waken` usuwa plik i prosi o podsumowanie decyzji podjętych pod nieobecność.
- Gdy w prompcie są obie flagi, liczy się ostatnia.

Zasady z `docs/agenci-zasady.md` i `CLAUDE.md` obowiązują bez zmian. Ścieżkę pliku stanu można podmienić zmienną `SEKI_SESSION_MODE_STATE` (testy).

Sprawdzenie ręczne: `echo '{"prompt":"--asleep"}' | CLAUDE_PROJECT_DIR=/tmp/x tools/session-mode/hook.sh`.
