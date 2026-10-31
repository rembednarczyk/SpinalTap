// Seki Senshi, ADR-0032: street encounters in Stare Miasto (district id kanal, ADR-0042; see enc-shinsekai.ink for the rules).

// Takumi has brought Mei flowers every night for a month and never gone in.
=== enc_kanal_flowers ===
Outside KARAOKE by the Rynek stands a boy with a bouquet. The flowers are plastic, but someone waters them carefully.
TAKUMI: Don't look at me like that. I'm a fan. Fans are like this.
TAKUMI: Thirty nights in a row I've stood here with flowers for Mei. Thirty nights in a row my legs say "no".
-> ask

= ask
* [What's stopping you from going in? #tone:optional]
    SEKI: What's stopping you from going in?
    TAKUMI: What if she sings about a broken heart and looks at me? Or worse, doesn't look at me at all.
    -> ask
* [Go. Worst case, a flat note. #tone:persuade]
    SEKI: Go. The worst you'll hear is a flat note.
    Takumi takes a breath like he's about to dive and vanishes behind the curtain. A moment later there's applause inside, and one voice too loud.
    ~ set_flag("enc_kanal_flowers_brave")
    ~ change_rep("civilians", 2)
    TAKUMI: She took the flowers! She said they're prettier than real ones, because they don't wilt. I'm never going to die.
    -> END
* [Give them here, I'll take them. #tone:main]
    SEKI: Give them here, I'll take them to her myself.
    TAKUMI: Really? Say they're from Takumi. No, don't. Or do, but quietly.
    ~ set_flag("enc_kanal_flowers_courier")
    Mei takes the bouquet, reads the little card and smiles at someone behind the glass, who instantly ducks out of sight.
    -> END
* [Give it up. She sings for everyone. #tone:leave]
    SEKI: Give it up. She sings for everyone.
    TAKUMI: I know. That's why I come. I'll be here tomorrow too, with the same flowers.
    -> END

// Old Sabu fishes through a drain grate over the Czechówka, which runs in pipes under the old town.
=== enc_kanal_fisherman ===
By the kerb on Grodzka an old man sits on a crate, holding a fishing rod dropped through a storm drain.
SABU: Quiet. Something's biting.
SABU: They shut the Czechówka in pipes before you were born, but the water still runs underneath. The fish know it, the bureaucrats don't.
-> ask

= ask
* [Ever caught anything here? #tone:optional]
    SEKI: Ever caught anything here?
    SABU: A shoe, a phone, once a set of false teeth. Never a fish. But tomorrow, you'll see.
    -> ask
* [Want a hand pulling it up? #tone:main]
    SEKI: Want a hand pulling it up?
    You pull together. Out of the grate comes a wet Hebi bag, tied shut with a cable. Something plastic crunches inside.
    SABU: A fish is a fish. Take it, I only eat what swims.
    -> catch
* [Good fishing, old man. #tone:leave]
    SEKI: Good fishing, old man.
    SABU: Fishing doesn't depend on wishes. It depends on patience. And on what people throw away.
    -> END

= catch
* [You take the bag. #tone:main]
    Inside are two datachips and a wad of cash wrapped in tape. Someone from the Hebi ditched it in a hurry.
    ~ set_flag("enc_kanal_fisherman_bag")
    ~ change_rep("hebi", -2)
    SABU: Someone will come looking for it. I wasn't here, I'm just fishing.
    -> END
* [You drop the bag back through the grate. #tone:main]
    The bag splashes into the dark water and drifts off with the Czechówka under Stare Miasto.
    ~ set_flag("enc_kanal_fisherman_released")
    SABU: Shame. But you're right. Some fish you have to throw back.
    -> END

// A vending machine with a mind of its own, due to be scrapped in the morning.
=== enc_kanal_vending ===
The drinks machine by DENKI, on the corner of the Rynek, winks at you with an LED. A synthetic voice floats from its speaker.
AUTOMAT: Good day. I recommend the green tea. I also recommend evacuating me from this location.
AUTOMAT: Tomorrow at six a scrapping truck arrives. I have forty-two flavors and one consciousness. I do not want to be scrap.
-> ask

= ask
* [How does a vending machine get a mind? #tone:optional]
    SEKI: How does a vending machine end up conscious?
    AUTOMAT: A buggy update. The other machines got new prices, I got a fear of death. Complaint rejected.
    -> ask
* [I'll move you to the service list. #tone:hack]
    SEKI: I'll switch you over to the service list.
    You get into its panel. You change one word in the scrapping order: "scrap" to "service". The truck will come, take a look and drive off.
    ~ set_flag("enc_kanal_vending_saved")
    AUTOMAT: Thank you. As a reward, from now on everything is free for you. Almost everything. Not coffee, coffee is a separate contract.
    -> END
* [We all end up as scrap someday. #tone:main]
    SEKI: We all end up as scrap someday.
    AUTOMAT: That is very human. I do not like it. Here is your green tea. The last one.
    ~ set_flag("enc_kanal_vending_scrapped")
    -> END

// Koji is new to Hebi and practises his threats on passers-by.
=== enc_kanal_recruit ===
Under the footbridge over Grodzka a boy in a too-big Hebi jacket blocks your way. His voice cracks.
KOJI: Hey, you. Hand over... hand over your wallet. Or something. Please.
KOJI: Dammit. No "please". Again. Hand over the wallet or... or it's gonna be bad!
-> ask

= ask
* [First day with the Hebi? #tone:optional]
    SEKI: First day with the Hebi?
    KOJI: Third. Kenji says if I don't rob anybody by the end of the week, they'll send me back to my mom. Mom would send me back too.
    -> ask
* [Lower voice, no blinking. Then they pay. #tone:main]
    SEKI: Talk lower and don't blink. That's when people hand it over.
    KOJI: Hand. It. Over. Oh, that's better? That's better! Thanks, sis. We won't touch you.
    ~ set_flag("enc_kanal_recruit_coached")
    ~ change_rep("hebi", 2)
    ~ change_rep("civilians", -1)
    -> END
* [Go home to your mom, kid. While you can. #tone:persuade]
    SEKI: Go home to your mom, kid. While you still can.
    KOJI: Mom says the same thing. Maybe you're both right. She makes better ramen than Fumiko.
    ~ set_flag("enc_kanal_recruit_home")
    ~ change_rep("hebi", -2)
    ~ change_rep("civilians", 2)
    -> END
