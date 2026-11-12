# Animacje z Mixamo: lista do pobrania

Decyzja użytkownika 12.11: źródłem animacji ruchu jest Mixamo (konto Adobe użytkownika). Pozycja w [backlogu](backlog.md) „Animacje ruchu”, realizacja po mapowaniu, pierwszy priorytet; szczegóły techniczne trafią do ADR-u.

Nazwy to hasła do wyszukania w Mixamo: biblioteka bywa zmieniana, więc jeśli dokładnej nazwy nie ma, bierzemy najbliższy wariant i zapisujemy, co pobrano (plik `tools/animations/manifest.json` przy imporcie). Licencja: animacje wolno używać w grze, nie wolno udostępniać samych plików animacji; przy imporcie sprawdzamy aktualny regulamin Adobe i trzymamy pliki wyłącznie w buildzie gry.

## Ustawienia pobierania
- Postać w Mixamo: domyślna **Y Bot** (wszystkie klipy na tym samym szkielecie; retarget na VRM robimy raz u nas).
- **Format:** FBX Binary (.fbx). **Skin:** pierwszy plik „With Skin” (wzorzec szkieletu), wszystkie kolejne „Without Skin”. **Frames per second:** 30. **Keyframe Reduction:** none.
- **In Place:** zaznaczone dla wszystkich klipów chodu i biegu (gra sama przesuwa postać; animacja nie może jej przesuwać).
- Nazwa pliku: grupa_nazwa, np. `ruch_walk_strafe_left.fbx`.

## A. Ruch podstawowy (blend space, stojąco)
1. Idle (2–3 warianty: spokojny, rozglądanie się, przestępowanie z nogi na nogę)
2. Walking (do przodu)
3. Walking Backwards
4. Left Strafe Walking, Right Strafe Walking (w bok)
5. Walking diagonalnie, jeśli są (Walk Forward Left/Right, Walk Backward Left/Right); jeśli nie, mieszamy przód z bokiem
6. Standard Run, Running Backward, Left Strafe, Right Strafe (bieg w bok)
7. Fast Run / Sprint
8. Start Walking, Stop Walking, Run To Stop (przejścia, opcjonalnie)
9. Turn Left 90 / Turn Right 90 (obrót w miejscu), Left Turn / Right Turn w biegu (opcjonalnie)

## B. Kucanie i skradanie (ADR-0069)
1. Stand To Crouch, Crouch To Stand
2. Crouching Idle
3. Crouched Walking (przód), Crouch Walk Back
4. Crouched Sneaking Left / Right albo Crouch Strafe Left / Right (w bok w kucki)
5. Sneaking / Sneak Walk (skradanie na stojąco)
6. Crouch Turn Left / Right (opcjonalnie)

## C. Skok, upadek, drabiny, przeszkody (ADR-0021)
1. Jumping (w miejscu), Running Jump
2. Falling Idle, Falling To Landing / Hard Landing
3. Climbing Ladder, Climbing Up Wall (wejście na krawędź, opcjonalnie)
4. Climbing To Top (zejście z drabiny na górze)
5. Jumping Over / Vault Over Obstacle (opcjonalnie)

## D. Broń palna (ADR-0015, ADR-0019)
Pistolet:
1. Pistol Idle, Pistol Aim (celowanie)
2. Pistol Walk, Pistol Walk Backward, Pistol Strafe (lewo, prawo), Pistol Run
3. Pistol Crouch Idle / Pistol Kneeling Idle, Pistol Crouch Walk (jeśli jest)
4. Shooting (strzał z pistoletu), Reloading (pistolet)
5. Draw Pistol / Holster Pistol (wyciąganie i chowanie)

Karabin:
1. Rifle Idle, Rifle Aiming Idle
2. Rifle Walk, Walking Backwards (rifle), Strafe Left / Right (rifle), Rifle Run
3. Rifle Crouch Walk, Crouching Idle (rifle)
4. Firing Rifle, Reloading (rifle)
5. Draw Rifle / Put Away Rifle

Strzelba (jeśli osobna): Shotgun Idle, Shoot Shotgun, Shotgun Reload.

## E. Walka wręcz i obezwładnienie (ADR-0019, ADR-0075)
1. Punching (2–3 ciosy), Cross Punch, Hook
2. Melee: Stab / Knife Attack, Sword Slash (pod pałkę/ostrze), Kick
3. Block / Blocking, Dodge (unik w bok i do tyłu)
4. Hit Reaction (trafienie z przodu, z tyłu), Big Hit / Knocked Down
5. Takedown / chwyt od tyłu: szukać haseł Choke, Grab, Stealth Kill (dwa klipy: atakujący i ofiara, jeśli są w parze)
6. Getting Up (wstawanie po powaleniu)
7. Dying / Death (2 warianty: do przodu i do tyłu); ragdoll zostaje (ADR-0075)

## F. Hakowanie i interakcje
1. Typing (klawiatura stojąco), Texting / Talking On Phone (telefon, ADR telefonu)
2. Button Pushing, Opening A Door / Opening (drzwi), Pick Up / Picking Up Object
3. Looting / Searching (przeszukanie ciała lub skrzynki)
4. Hand Raising / Waving (gest), Pointing
5. Drinking (bar Neon Koi), Eating (opcjonalnie)

## G. Rozmowa i emocje (dialogi, NPC)
1. Talking (3–4 warianty), Arguing, Agreeing / Head Nod Yes, Shaking Head No
2. Thinking, Looking Around, Waiting / Bored
3. Angry Gesture, Laughing, Surprised
4. Sad Idle, Injured Idle / Injured Walk (niski poziom zdrowia)

## H. Tłum i życie miasta (ADR-0040, ADR-0041, ADR-0058 etap 8)
1. Sitting Idle (ławka), Sit Down / Stand Up (siadanie i wstawanie)
2. Sitting Talking, Sitting Drinking
3. Leaning On Wall (opieranie o ścianę), Smoking Idle (opcjonalnie, styl cyberpunk)
4. Standing Conversation (para), Phone Call
5. Dancing (2–3 warianty: klub, ulica), Bar Idle
6. Walking variations (zmęczony, pewny siebie, z torbą: Carrying), Old Man Walk (starsze postacie, ADR-0076)
7. Kneeling / Crouching Pick Up (zakupy, targ)

## I. Pojazdy i metro (opcjonalnie)
1. Sitting In Car / Driving (gdyby gracz albo NPC siedzieli w aucie)
2. Standing Idle trzymając się poręczy (wagon metra), Sitting (ławka w wagonie)

## Kolejność importu
Najpierw A i B (zgłoszenie: chód w bok, chód w kucki), potem D (broń w ruchu, bo dziś się z tym łączy), potem C, E, F; G i H wtedy, gdy etap tłumu i dialogów będzie gotowy na klipy.
