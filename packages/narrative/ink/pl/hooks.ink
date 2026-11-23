// Seki Senshi, ADR-0032: observation hooks, `hook_<kind>_<n>`, for the hook table in the sim content.
// Each one is an overheard guard line (bark), a mail on a terminal or the contents of a shard.
// One or two lines, no choices. Each reveals a systemic way through: a gap in a rotation, a code,
// a habit of the target. Mails and shards are narration, so they carry no speaker prefix.

// eliminate: Kaito's sites on Krakowskie Przedmieście and under the Grodzka footbridge in Stare Miasto.
// The bark plays at every one of the five sites (`carrier: { post: 1 }`), so it names none of them.
=== hook_eliminate_1 ===
HEBI: Szef co godzinę odchodzi sam za róg. Mówi, że dzwoni do matki, a wraca pachnący sake.
-> END

=== hook_eliminate_2 ===
Shard, nagranie głosowe: „Zmiana warty o drugiej. Kto stoi od ulicy, idzie wtedy po ramen, a szef przez dziesięć minut zostaje z jednym chłopakiem”.
-> END

// delivery: Kaito's cold modules for Hana.
=== hook_delivery_1 ===
Mail na terminalu. Od: chłodnia Neon Koi. Temat: moduły. „Paczka trzyma temperaturę w cieniu. Do Alchemii najkrócej przez Plac Łokietka i w dół Lubartowskiej. Przez Stare Miasto nadłożysz drogi, a pod kładką na Grodzkiej stoją Hebi”.
-> END

=== hook_delivery_2 ===
HEBI: Kurierów łapiemy pod kładką na Grodzkiej, nie tutaj. Przy wózku Hany tylko patrzymy, bo Kenji nie lubi świadków.
-> END

// retrieve: Hana's crate at the Hebi stash in the air-raid shelter under Alchemia's lower square.
=== hook_retrieve_1 ===
HEBI: Skrzynki pilnujemy we dwóch, ale po północy Daisuke idzie do Fumiko na ramen. Wraca po kwadransie, jak nie ma kolejki.
-> END

=== hook_retrieve_2 ===
HEBI: Dwa, dwa, zero, siedem. Dwa dwa zero siedem. Jak jeszcze raz zapomnę kodu do bramy schronu, Daisuke zamknie mnie z robotami.
-> END

// protect: Hebi coming for Oyaji's stall. _1 fits the raid across the square, _2 the one down the path from Świętoduska.
=== hook_protect_1 ===
HEBI: Do starego idziemy przez plac, jak zawsze. Po co zmieniać coś, co działa.
-> END

=== hook_protect_2 ===
Mail na terminalu Hany. Od: nieznany. Temat: Oyaji. „Hebi wejdą przez galerię: drzwiami trzonów na drugim piętrze, potem ostatnimi schodami ruchomymi do food hallu. Z ogrodu na dachu widać całe atrium, a oni nigdy nie patrzą w górę”.
-> END

// escort: Mika's way from the yard to the boat.
=== hook_escort_1 ===
STRAZNIK: Jak księgowa ruszy na nabrzeże, czekamy przy biurze. Rozkaz jest taki, żeby nikt nie stał na molo, bo tam nas widać z wody.
-> END

=== hook_escort_2 ===
Mail na terminalu ochrony Tessen. Temat: grafik nocny. „Wschodnia alejka placu kontenerowego bez obsady między 1:00 a 3:00, patrol przeniesiony pod biuro”.
-> END

// infiltrate: the manifests on the desk in the Tessen office.
=== hook_infiltrate_1 ===
Mail na terminalu. Od: administracja Nabrzeża. Temat: drzwi biura. „Kod do bocznych drzwi od strony hali zmieniony na 4177. Proszę nie zapisywać go na karteczkach”. Kod jest zapisany na karteczce.
-> END

=== hook_infiltrate_2 ===
STRAZNIK: Ten od drzwi biura co pół godziny wychodzi zapalić w przejście między wieżą a halą. Myśli, że kamera tam nie sięga. Ma rację.
-> END

// hack: holding the Tessen terminal on the quay by the pier against the wave and the sniper on row N's roof.
=== hook_hack_1 ===
Shard, raport serwisowy karabinu: „Strzelec na dachu hali po trzecim strzale wymienia ogniwo. Cztery sekundy bez lasera”.
-> END

=== hook_hack_2 ===
STRAZNIK: Z dachu hali nic nie widać pod schodami wieży. Jak ktoś się tam schowa, snajper może sobie najwyżej popatrzeć.
-> END

=== hook_sabotage_1 ===
STRAZNIK: Obchód hali schodzi korytarzem północnym do serwerowni co drugie okrążenie. Poza tym tylko mija drzwi.
-> END

=== hook_sabotage_2 ===
TECHNIK: Nowa na nocce? Weź szafkę czternaście w piwnicy, jest niczyja. Zamek nie działa od wiosny.
-> END
