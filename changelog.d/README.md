# Wpisy do dziennika zmian

Każdy PR z funkcją albo poprawką widoczną w grze dodaje tu **własny plik** zamiast edytować `CHANGELOG.md`. Dzięki temu PR-y nie mają konfliktów w dzienniku i nie restartują przez to CI.

- Nazwa: `<data>-<krótki-opis>.md`, np. `2026-11-01-szyldy-lokali.md`.
- Treść: jedna linia po polsku, bez myślnika na początku, z numerem glitcha albo ADR-u, np. `Szyldy lokali z nazwami 2077 (ADR-0064 etap 4).`
- `pnpm changelog` (`tools/changelog/changelog.mjs`) przenosi wpisy do sekcji „Nieopublikowane” w `CHANGELOG.md`, pod datą z nazwy pliku, i usuwa pliki. Robi to orkiestrator na `main` po scaleniu kilku PR-ów, jednym commitem.
