// Seki Senshi, ADR-0032: street encounters on Krakowskie Przedmieście (district id shinsekai-7, ADR-0042). `ENCOUNTERS` in the sim content
// says where and when each one starts; the sim plays each knot once. A choice leaves a flag
// `enc_<district>_<name>_<outcome>` (the reward or the memory of it) and sometimes a reputation change.

// Nobu bet his cyber arm at the PACHINKO parlour and lost it to the machine.
=== enc_s7_pachinko ===
Na ławce przed PACHINKO, przy deptaku, siedzi starszy facet z pustym rękawem. Z ramienia sterczą mu kable.
NOBU: Panienko, pani wygląda na kogoś, kto rozmawia z maszynami.
NOBU: Postawiłem rękę. Prawą, z odzysku. Automat ją wygrał i trzyma w podajniku, jak trofeum.
-> ask

= ask
* [Jak można przegrać własną rękę? #tone:optional]
    SEKI: Jak można przegrać własną rękę?
    NOBU: Szło mi. Przez całą godzinę mi szło. Potem przestało, a ręka już była na stole.
    -> ask
* [Spróbuję ją wyciągnąć z automatu. #tone:hack]
    SEKI: Spróbuję ją wyciągnąć z automatu.
    Wsuwasz palec w gniazdo serwisowe. Automat piszczy, gra fanfarę i wypluwa dłoń, a za nią garść żetonów.
    ~ set_flag("enc_s7_pachinko_hand")
    ~ change_rep("civilians", 2)
    NOBU: Rusza się! Kciuk się rusza! Żetony są twoje, w Neon Koi biorą je zamiast drobnych.
    -> END
* [Zostaw ją tam. Może to znak, żeby przestać. #tone:main]
    SEKI: Zostaw ją tam. Może to znak, żeby przestać.
    ~ set_flag("enc_s7_pachinko_left")
    NOBU: Znak to był w zeszłym tygodniu, jak przegrałem nogę. Odegrałem ją. Lewą ręką.
    -> END

// A salaryman asleep on the pavement at four in the morning, tie and briefcase still on.
=== enc_s7_salaryman ===
Na chodniku śpi facet w garniturze. Teczka pod głową, krawat zawiązany jak do zdjęcia. Optyka miga mu na czerwono: dwanaście nieodebranych połączeń od „Szef”.
-> look

= look
* [Hej. Wstawaj, zanim ktoś cię oskubie. #tone:main]
    SEKI: Hej. Wstawaj, zanim ktoś cię oskubie.
    SARARIMAN: Pani dziekan? Raport dla UMCS Corp będzie na dziewiątą, przysięgam.
    SARARIMAN: Och. Pani nie jest dziekanem. To dobrze. Dziekan by mnie od razu zwolnił.
    ~ set_flag("enc_s7_salaryman_woken")
    ~ change_rep("civilians", 2)
    SARARIMAN: Dziękuję. Mam tylko kartę na ramen, ale niech pani weźmie. Lepiej, żeby ktoś z niej skorzystał.
    -> END
* [Sięgasz po jego portfel. #tone:aggressive]
    Portfel jest cienki. W środku karta na ramen u Fumiko i zdjęcie dziecka w mundurku.
    ~ set_flag("enc_s7_salaryman_robbed")
    ~ change_rep("civilians", -3)
    SARARIMAN: Mmm. Mamo, jeszcze pięć minut.
    -> END
* [Zostawiasz go. Każdy ma prawo do snu. #tone:leave]
    Odchodzisz. Za plecami słyszysz, jak dzwoni po raz trzynasty.
    -> END

// Hina lost her robot cat. It went to the car wash, because the car wash is warm.
=== enc_s7_neko ===
Dziewczynka w żółtej pelerynie zagląda pod każdą ławkę i każdy samochód przy deptaku.
HINA: Widziała pani kota? Srebrny, na baterię. Mruczy jak lodówka.
-> ask

= ask
* [Jak się nazywa? #tone:optional]
    SEKI: Jak się nazywa?
    HINA: Pan Kot. Tata mówi, że to głupie imię, ale tata nazwał mnie Hina, więc nie ma prawa głosu.
    -> ask
* [Sprawdzę w myjni. Tam jest ciepło. #tone:main]
    SEKI: Sprawdzę w myjni. Tam jest ciepło.
    Pod szczotkami myjni leży srebrny kot i mruczy do suszarki. Na twój widok przestaje i patrzy, jakby czekał na wyjaśnienia.
    HINA: Jest tam? Niech pani powie, że jest!
    -> found
* [Kot na baterię wróci, jak mu się skończy prąd. #tone:leave]
    SEKI: Kot na baterię wróci, jak mu się skończy prąd.
    HINA: Jak mu się skończy prąd, to nigdzie nie wróci. Dorośli są czasem bardzo głupi.
    -> END

= found
* [Oddajesz kota Hinie. #tone:main]
    HINA: Pan Kot! Gdzie byłeś? Nie odpowiadaj, wiem, w myjni.
    ~ set_flag("enc_s7_neko_returned")
    ~ change_rep("civilians", 3)
    HINA: Proszę. Znalazłam to wczoraj pod wrakiem. Błyszczy, więc chyba jest cenne.
    -> END
* [Wyciągasz z kota baterię na części. #tone:aggressive]
    Bateria wychodzi z cichym kliknięciem. Kot zastyga w pół mruknięcia.
    ~ set_flag("enc_s7_neko_battery")
    ~ change_rep("civilians", -4)
    HINA: Dlaczego on się nie rusza? Proszę pani? Dlaczego on się nie rusza?
    -> END

// Shiro sold the memories of his wife to Kagami. Now he writes poems about a woman he cannot see.
=== enc_s7_poet ===
Pod latarnią na Placu Litewskim stoi chudy mężczyzna z kartką. Czyta na głos, choć nikt nie słucha.
SHIRO: „Miała parasol w kolorze, którego nie pamiętam. Śmiała się z czegoś, czego nie pamiętam.”
SHIRO: Sprzedałem ją Kagami. Wspomnienia o żonie, cały pakiet, z dopłatą za ślub. Zostały mi wiersze.
-> ask

= ask
* [Ile ci za nią zapłacili? #tone:optional]
    SEKI: Ile ci za nią zapłacili?
    SHIRO: Tyle, że starczyło na jej leczenie. Nie starczyło, żeby wyzdrowiała. Tego też nie pamiętam, ale mam rachunki.
    -> ask
* [Przeczytaj jeszcze raz. Słucham. #tone:main]
    SEKI: Przeczytaj jeszcze raz. Słucham.
    SHIRO: „Miała parasol.” Tylko tyle mi zostało. Dziękuję, że ktoś to usłyszał dwa razy.
    ~ set_flag("enc_s7_poet_listened")
    ~ change_rep("civilians", 1)
    { has_memory("operating_table"):
        Coś w tobie drga. Stół, światło, ktoś liczy od dziesięciu w dół. Odpychasz to.
    }
    -> END
* [Kagami wciąż kupuje? #tone:main]
    SEKI: Kagami wciąż kupuje?
    SHIRO: Zawsze. Punkt skupu jest za kliniką, bez szyldu. Kolejka ustawia się przed świtem.
    ~ set_flag("enc_s7_poet_kagami")
    SHIRO: Nie idź tam. Albo idź, ale zapisz sobie najpierw, kim jesteś.
    -> END
