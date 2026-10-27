# ADR-0009: Audio syntezowane w WebAudio

## Decyzja
`SynthAudio` implementuje `AudioPort` na surowym WebAudio: każde `AudioCue` to przepis z oscylatorów i szumu (`CUES`). Ambient deszczu to zapętlony, filtrowany szum. Kontekst audio odblokowuje pierwszy gest użytkownika.

## Konsekwencje
Zero plików audio w M0. Wymiana na próbki (i silnik audio Babylona dla dźwięku przestrzennego) dotyczy wyłącznie `engine/src/audio`.
