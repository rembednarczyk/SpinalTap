// Seki Senshi, ADR-0032: street encounters on Podzamcze (district id targ, ADR-0042; see enc-shinsekai.ink for the rules).

// Kiku reads fortunes from a cracked AR deck. The cards show other people's memories.
=== enc_targ_fortune ===
Between the stalls sits a woman in a headscarf studded with LEDs. On her little table lies a deck of AR cards, one of them cracked in half.
KIKU: Sit down, child. The cards told me you'd come. Or someone in your jacket would.
-> ask

= ask
* [Read my fortune. What do you see? #tone:main]
    SEKI: Read my fortune. What do you see?
    Kiku turns a card. The hologram shows a roof in the rain and two figures by the edge. The card dies before you can get a good look.
    KIKU: Strange. This card shows the past, and it should show the future. Your past is still ahead of you, child.
    ~ set_flag("enc_targ_fortune_read")
    -> END
* [Where'd you get those cards? #tone:optional]
    SEKI: Where did you get those cards?
    KIKU: From a Kagami container that fell off a truck. Every card is a piece of someone's memory. I just give them meaning.
    -> ask
* [I don't believe in fortunes. #tone:leave]
    SEKI: I don't believe in fortune-telling.
    KIKU: The cards don't believe in you either. A draw. Go with the gods, or whoever you walk with.
    -> END

// Daigo's synthetic chicken has escaped. It is worth more than his stall.
=== enc_targ_chicken ===
A hen is racing between customers' legs. Its feathers shine like foil, and an antenna sticks out of its rump.
DAIGO: Catch her! That's no ordinary hen, that's a Premium Chicken, licensed!
DAIGO: She lays certified eggs. Without her I'm a guy with an empty cage and a bank loan.
-> chase

= chase
* [You catch the hen mid-flight. #tone:main]
    You lunge. The hen dodges like a pro, but lands right in your hands and clucks at you in indignant binary.
    ~ set_flag("enc_targ_chicken_caught")
    ~ change_rep("civilians", 2)
    DAIGO: My girl! Here, take an egg. The certificate's inside. Don't ask how they got it in there.
    -> END
* [Why does she run? #tone:optional]
    SEKI: Why does she keep running?
    DAIGO: Because she's smarter than me. The company gave her the same processor as a cash register.
    -> chase
* [You watch the hen run off under the viaduct. #tone:main]
    The hen hops up the stairs to the viaduct and stands for a moment against the Zamek like a poster. Then she's gone.
    ~ set_flag("enc_targ_chicken_free")
    DAIGO: Freedom. She always talked about it. Well, clucked. What do I tell the bank now?
    -> END

// Akane pays her late husband's debt to Hebi. This month she is short.
=== enc_targ_debt ===
By the east wall of the market hall, on the Ruska side, a woman in an apron counts coins in her palm. A Hebi boy with a tablet stands over her.
POBORCA: You're a hundred twenty short. Your husband knew what he was signing up for when he borrowed.
AKANE: My husband's been dead a year. He signed up for a lot of things. I never signed up for anything.
-> ask

= ask
* { hebi_stance == "friendly" } [She's with me. Give her a month. #tone:persuade]
    SEKI: She's with me. Give her a month.
    POBORCA: If you say so. A month. But Kenji will hear it came from you.
    ~ set_flag("enc_targ_debt_delayed")
    ~ change_rep("civilians", 2)
    AKANE: I don't know who you are, but thank you. I've got a pickle stall, if you ever need one.
    -> END
* [You rest a hand on your grip. He sees it. #tone:aggressive]
    POBORCA: Easy. I'm just counting. Counting's not a crime.
    POBORCA: Fine. I'll write down I found nobody home. But this isn't over, understand?
    ~ set_flag("enc_targ_debt_scared")
    ~ change_rep("hebi", -3)
    ~ change_rep("civilians", 3)
    AKANE: They'll be back. But maybe in a month, not tomorrow. That's something.
    -> END
* [How much did he owe? #tone:optional]
    SEKI: How much did he owe?
    AKANE: Three hundred at the start. After a year of paying, it's a thousand. The Hebi have interesting math.
    -> ask
* [You walk away. Not your business. #tone:leave]
    Behind you, you hear coins clinking as they're tipped onto the tablet.
    -> END

// Riko sings under a hologram of a face that is not quite hers any more.
=== enc_targ_idol ===
By the north row a girl is singing. Above her floats a hologram of an idol who looks just like her, only younger and happier.
RIKO: Buy a record? I don't have records. I've got a download code and good will.
-> ask

= ask
* [Who's in that hologram? #tone:optional]
    SEKI: Who's in that hologram?
    RIKO: Me. Five years ago, before the label sold my face to another girl. Now she plays the Lublin Festival on Plac Litewski. I play Podzamcze.
    -> ask
* [Sing the one from before the label. #tone:main]
    SEKI: Sing the one you sang before the label.
    Riko switches off the hologram. She sings quieter, no backing track. A few stallholders stop weighing their goods.
    ~ set_flag("enc_targ_idol_song")
    ~ change_rep("civilians", 1)
    RIKO: Nobody's asked me for that one in five years. Here, that's the code. The real one.
    -> END
* [You drop something in her tin and move on. #tone:leave]
    RIKO: Thanks! Come back tomorrow, I'll be here with the same set and the same face.
    -> END
