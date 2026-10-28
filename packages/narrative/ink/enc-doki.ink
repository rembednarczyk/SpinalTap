// Seki Senshi, ADR-0032: street encounters in Doki Tessen (see enc-shinsekai.ink for the rules).

// Tomo was laid off by an algorithm this morning. Nobody told the gate, so he keeps working.
=== enc_doki_laidoff ===
Przy kontenerach doker w kamizelce Tessen pali papierosa i patrzy w telefon, jakby ten go obraził.
TOMO: Dwadzieścia dwa lata w porcie. Dziś rano algorytm napisał, że moje stanowisko „przestaje być optymalne”.
TOMO: Ale bramka dalej mnie wpuszcza. Nikt jej nie powiedział. Więc przychodzę i pracuję. Za darmo, jak się okazuje.
-> ask

= ask
* [Czemu nie pójdziesz do domu?]
    SEKI: Czemu nie pójdziesz do domu?
    TOMO: A co tam będę robił? Żona myśli, że jestem w pracy. Jestem w pracy. Wszystko się zgadza.
    -> ask
* [Skoro bramka cię wpuszcza, wpuści i mnie?]
    SEKI: Skoro bramka cię wpuszcza, wpuści i mnie?
    TOMO: Ha. Moja karta otwiera bramę przy dźwigu do końca miesiąca. Bierz kopię. Niech Tessen zapłaci za ten błąd.
    ~ set_flag("enc_doki_laidoff_badge")
    ~ change_rep("tessen", -1)
    -> END
* [Napisz do nich skargę. Głośno.]
    SEKI: Napisz do nich skargę. Głośno.
    TOMO: Skargi czyta ten sam algorytm. Odpisze mi, że skarga też przestaje być optymalna. Ale dzięki.
    ~ set_flag("enc_doki_laidoff_complaint")
    -> END

// A Tessen guard is at war with a cyber gull that steals the crew's sandwiches.
=== enc_doki_gull ===
Na nabrzeżu strażnik Tessen celuje pałką w niebo. Nad nim krąży mewa z metalowym dziobem i diodą w oku.
STRAZNIK: Znowu ona! Trzecia kanapka dzisiaj. Z tuńczykiem. Wie, które są z tuńczykiem.
STRAZNIK: To dron ptasi z dawnego programu odstraszania. Program zamknęli, ptak został i zaczął pracować na swoje.
-> ask

= ask
* [Strącasz mewę jednym strzałem.]
    Mewa spada do wody z pluskiem i krótkim komunikatem o błędzie.
    ~ set_flag("enc_doki_gull_shot")
    ~ change_rep("tessen", 2)
    STRAZNIK: No proszę. Nie widziałem cię tu, ale jak mnie ktoś zapyta, to jesteś w porządku.
    -> END
* [Rzucasz mewie resztkę jego kanapki.]
    Mewa łapie kęs w locie, zatacza koło nad dźwigiem i siada ci na ramieniu. Waży więcej, niż wygląda.
    ~ set_flag("enc_doki_gull_friend")
    STRAZNIK: Ty ją karmisz?! Teraz będzie przychodzić po dwie!
    -> END
* [Ten ptak ma lepszy kontrakt niż ty?]
    SEKI: Ten ptak ma lepszy kontrakt niż ty?
    STRAZNIK: Ma lepszy. Nikt go nie kontroluje, nie płaci składek i je za darmo. Czasem mu zazdroszczę.
    -> ask

// Someone knocks from inside a container. The manifest says "spare parts".
=== enc_doki_container ===
W alejce między kontenerami słychać pukanie. Trzy krótkie, trzy długie, trzy krótkie. Z jednego kontenera, z plombą Tessen.
GLOS: Halo? Ktoś tam jest? Nie mamy już wody. Jest nas sześcioro.
-> ask

= ask
* [Kto was tu zamknął?]
    SEKI: Kto was tu zamknął?
    GLOS: Pośrednik z Tessen. Obiecał pracę w zakładzie. Zakład okazał się kontenerem, a praca czekaniem.
    -> ask
* [Zrywasz plombę i otwierasz drzwi.]
    Drzwi skrzypią. W środku sześć osób w kombinezonach, mrużą oczy przed światłem lamp portowych.
    ~ set_flag("enc_doki_container_opened")
    ~ change_rep("tessen", -3)
    ~ change_rep("civilians", 3)
    GLOS: Dziękujemy. Nie wiemy, gdzie iść, ale wiemy, że stąd.
    -> END
* [Dam znać Genzō. On ma łodzie.]
    SEKI: Dam znać Genzō. On ma łodzie.
    GLOS: Ktokolwiek to jest, niech się pospieszy. I niech przyniesie wodę.
    ~ set_flag("enc_doki_container_genzo")
    ~ change_rep("fixers", 1)
    -> END
* [Odchodzisz od kontenera.]
    Pukanie słychać jeszcze przez dwie alejki. Potem przestajesz je słyszeć, choć nie wiesz, czy ono przestało.
    -> END
