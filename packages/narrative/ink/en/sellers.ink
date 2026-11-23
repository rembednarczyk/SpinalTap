// Seki Senshi, ADR-0101: small talk with Alchemia's sellers, every open shop of the gallery and the front
// and every open kitchen of the food hall without a keeper of the story. One knot per trade or kitchen,
// a stitch per voice (`v1`..): the simulation gives each shop of a trade a voice of its own (`sellers.ts`).
// A greeting by the time of day, warmer once she is a regular (a flag per voice, set on the first talk),
// three topics (the goods, a rumour of the district, the seller), a goodbye. No knot pays or hands out items.

VAR seller_voice = 0
VAR seller_goods = false
VAR seller_gossip = false
VAR seller_self = false

// Every seller's opening, as a tunnel: the topics afresh, the street's view of her, the greeting by the hour
// (a regular's once `met` is set), then `met` set.
=== seller_open(met) ===
~ seller_goods = false
~ seller_gossip = false
~ seller_self = false
{ civilians_tier == "hostile":
    LADA: I don't serve your kind. Gallery security keeps your picture by the till.
    -> END
}
{
- has_flag(met) && time_of_day == "night":
    LADA: You again. At night only regulars and trouble come in here, and so far you're the first kind.
- has_flag(met) && time_of_day == "dawn":
    LADA: You, at this hour? The till's barely awake, but it's always open for regulars.
- has_flag(met) && time_of_day == "day":
    LADA: Oh, a regular. No queue for you.
- has_flag(met):
    LADA: Back before dark. Smart. In an hour the gallery fills up with people who buy nothing.
- time_of_day == "night":
    LADA: At night? Keep your voice down, the security cameras hear better than they see.
- time_of_day == "dawn":
    LADA: Dawn, and you're already up. The first customer of the day brings luck or the other thing.
- time_of_day == "day":
    LADA: Hello there. Look around, just know not everything that glows is for sale.
- else:
    LADA: Evening. The neon's warmed up, the prices haven't yet.
}
~ set_flag(met)
->->

// Pharmacies: MEDIFARM, MEDIX, APTEKA NOVA, FARMA PLUS.
=== seller_pharmacy ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_pharmacy_1") ->
LADA: Pharmacy. Plasters, lung filters, pills for the sleep you won't get anyway.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_pharmacy_2") ->
LADA: Welcome to the pharmacy, where a prescription is just a suggestion.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_pharmacy_3") ->
LADA: Open all night. Almost all night, security cuts the power at four.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_pharmacy_4") ->
LADA: Tell me what hurts. I'll read the rest in your pupils.
-> talk

= talk
+ { not seller_goods } [What've you got, with a script or without? #tone:optional]
    ~ seller_goods = true
    SEKI: What've you got, with a script or without?
    {
    - seller_voice == 1:
        LADA: Inhalers for the smog off the Bystrzyca and drops for neon-burnt eyes. Nothing for implants, take that to Mori on the deptak.
    - seller_voice == 2:
        LADA: Painkillers in three strengths: for the day, for the night, and for a talk with the Hebi.
    - seller_voice == 3:
        LADA: Electrolytes for the ones dancing till dawn on Krakowskie, melatonin for the ones living upstairs from them.
    - else:
        LADA: Synthetic caffeine, a patch for chrome, something for a sake hangover. The last one sells best.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: After the rain people cough black. They say it's the Tessen stacks by the river. Tessen says it's the weather.
    - seller_voice == 2:
        LADA: The Hebi come in for dressings every Friday. They pay cash, and nobody asks where the wounds came from.
    - seller_voice == 3:
        LADA: Somebody bought out all the implant-rejection meds. Cash, a mask, the patch of a company nobody here knows.
    - else:
        LADA: Kagami billboards promise to remember for you. I sell pills to forget. Competition.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: Twelve hours behind the glass, then twelve of sleep on pills. The sums add up.
    - seller_voice == 2:
        LADA: Pharmacy at UMCS ended in the third year. The counter teaches the rest.
    - seller_voice == 3:
        LADA: My mother had a pharmacy on Lubartowska. Lubartowska's still standing. The pharmacy isn't.
    - else:
        LADA: I just work the counter in shifts. The owner lives in Wieniawa and nobody here has ever seen him.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: Drink bottled water. The tap water in the Old Town still remembers the Czechówka's pipes.
    - seller_voice == 2:
        LADA: Stay healthy. Around here that's the priciest stock there is.
    - seller_voice == 3:
        LADA: Come back healthy. Or at least come back.
    - else:
        LADA: Mind the escalators. The third step from the top bites.
    }
    -> END

// Tattoo studios: IREZUMI, INKSPOT, SUMI INK, BLACK LOTUS.
=== seller_tattoo ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_tattoo_1") ->
LADA: Studio. Sterile needles, glowing ink, a sober client. I guarantee two out of three.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_tattoo_2") ->
LADA: Sit down if you've got the nerve. Stand if all you've got is questions.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_tattoo_3") ->
LADA: Ink, not hologram. Everything here is for keeps.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_tattoo_4") ->
LADA: Two weeks' waiting list, but I'll find you half an hour. Or not.
-> talk

= talk
+ { not seller_goods } [What could you ink on me? #tone:optional]
    ~ seller_goods = true
    SEKI: What could you ink on me?
    {
    - seller_voice == 1:
        LADA: Reactive ink: asleep by day, lit up under neon. On skin with chrome I use another, the usual kind flakes.
    - seller_voice == 2:
        LADA: Koi carp, the Brama Krakowska, the Lublin goat. Tourists from Warsaw go for the goat.
    - seller_voice == 3:
        LADA: Barcodes for those who want the scanners to read them, and static for those who don't.
    - else:
        LADA: Calligraphy, ornaments off the Old Town tenements, Japanese that actually means something.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: The Hebi order snakes on their forearms here. The ones who leave come back to cover them. Always at night.
    - seller_voice == 2:
        LADA: Word in Neon Koi is the fixer's hiring again. People like you usually end up back here after, with scars to cover.
    - seller_voice == 3:
        LADA: Tessen banned tattoos for its guards on the Nabrzeże. Now I put them where the uniform covers.
    - else:
        LADA: Somebody paints the Wieża Trynitarska on the gallery walls at night. Security paints over it each morning, and he comes back. Respect.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: First tattoo done with a sewing needle in a cellar in Podzamcze. The hand shook back then. Now only the clients shake.
    - seller_voice == 2:
        LADA: Twenty years of tattooing. The last ten mostly covering what somebody else botched.
    - seller_voice == 3:
        LADA: The studio came from my uncle. With the debts, and with the cat that sleeps in the client's chair.
    - else:
        LADA: Comics once, skin now. Paper paid worse and didn't scream.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: Think the design over. Skin remembers longer than people do.
    - seller_voice == 2:
        LADA: Come back with an idea, not with vodka.
    - seller_voice == 3:
        LADA: Ointment for a week. And no swimming in the Bystrzyca. Ever.
    - else:
        LADA: If you change your mind, the needle will wait.
    }
    -> END

// Pawnshops: LOMBARD, SKUP.
=== seller_pawn ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_pawn_1") ->
LADA: Pawnshop. Everything has its price, and I know it better than the owner does.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_pawn_2") ->
LADA: Buying gold, silver and memories. Joke. I don't take memories, they don't resell.
-> talk

= talk
+ { not seller_goods } [What do you buy, and what do you sell? #tone:optional]
    ~ seller_goods = true
    SEKI: What do you buy, and what do you sell?
    {
    - seller_voice == 1:
        LADA: Watches, rejected implants, rings from divorces. I ask no questions and write no receipts.
    - else:
        LADA: A pistol with no numbers, a laptop with someone else's history, a medal from times nobody talks about.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: The market from under the viaduct on Tysiąclecia moved in here with all its debts. The Hebi came in the package.
    - else:
        LADA: Yesterday somebody brought in a signet ring with the Kagami crest. Next morning two suits came and bought it back. At double the price.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: My father ran a second-hand shop on Ruska. I've got a pawnshop in a mall. Social mobility.
    - else:
        LADA: Bailiff auctions once, a pawnshop now. Same job, less paperwork.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: When you're in need, you know where I stand. Everybody is, sooner or later.
    - else:
        LADA: Don't sell anything you can't buy back.
    }
    -> END

// Synthetic food: SYNTHMART, SOYA MAX, KONBINI, NOODLE BOX.
=== seller_synth_food ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_synth_food_1") ->
LADA: Konbini, round the clock. Everything off a printer, nothing off a field.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_synth_food_2") ->
LADA: Cheap synthetics. Real food's upstairs in the food hall, and it costs like an implant.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_synth_food_3") ->
LADA: Hot water's free, the rest costs credits.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_synth_food_4") ->
LADA: Markdowns after eight, but by then only the sauces are left.
-> talk

= talk
+ { not seller_goods } [What in here is actually edible? #tone:optional]
    ~ seller_goods = true
    SEKI: What in here is actually edible?
    {
    - seller_voice == 1:
        LADA: Cebularz from mushroom protein, onigiri with algae from the reservoir, canned coffee that tastes like canned coffee.
    - seller_voice == 2:
        LADA: Powdered soup, noodle bricks, insect crisps. Lublin insects, certified.
    - seller_voice == 3:
        LADA: Instant ramen in nine flavours. All of them taste of MSG, just in different colours.
    - else:
        LADA: Protein bars for mercs, soy milk for kids, sake in pouches for everyone.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: Deliveries come by drone, because the Tessen trucks on the Nabrzeże are stuck in traffic with their own trucks.
    - seller_voice == 2:
        LADA: Oyaji up in the food hall sells more than knives. Everybody knows, nobody says.
    - seller_voice == 3:
        LADA: The roof terrace leaks straight onto the third floor. The waiters set out buckets and pretend they're fountains.
    - else:
        LADA: Down in the car park the warehouse robots drive around at night with nobody telling them to. Security won't go down after ten.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: Night shifts, since machines work the till by day. At night the machines are scared of the Hebi.
    - seller_voice == 2:
        LADA: Staff eat for free. After a year that stops being a perk.
    - seller_voice == 3:
        LADA: There's no work after the polytechnic. There's always work after ramen.
    - else:
        LADA: Three generations of this shop. Grandpa sold potatoes, I sell something pretending to be potatoes.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: Enjoy. More or less.
    - seller_voice == 2:
        LADA: Don't take anything with a green sticker. Green means yesterday.
    - seller_voice == 3:
        LADA: Careful, it's hot. The cup too.
    - else:
        LADA: See you tomorrow. There's always a tomorrow, and a markdown.
    }
    -> END

// Electronics: VOLTAGE, OMNIBYTE, CYBERDECK.
=== seller_electronics ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_electronics_1") ->
LADA: Electronics. New, used, and the kind you're better off not knowing where it's from.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_electronics_2") ->
LADA: Looking for something in particular, or just warming up by the servers?
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_electronics_3") ->
LADA: Everything with a plug, everything on a battery, everything for sale.
-> talk

= talk
+ { not seller_goods } [What tech have you got? #tone:optional]
    ~ seller_goods = true
    SEKI: What tech have you got?
    {
    - seller_voice == 1:
        LADA: Cables, sensors, satellite modems, screens rolled up like posters. Warranty lasts to the door.
    - seller_voice == 2:
        LADA: Decks, memory cards with headroom, filters for the Tessen cameras. Those last ones from under the counter.
    - else:
        LADA: Delivery drones after a crash, fixed and repainted. They fly almost straight.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: The gallery network drops every evening at the same time. Somebody upstairs pulls down something huge, and nobody knows what.
    - seller_voice == 2:
        LADA: The cameras on the deptak got hooked to a new network. Now they see what they shouldn't, too.
    - else:
        LADA: After the night of the blockade half the neighbourhood bought antennas here. Nobody believed what Tessen Info was saying.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: Soldering since I was a kid. First radio put together from parts out of a skip under the Brama Krakowska.
    - seller_voice == 2:
        LADA: Used to fix phones on Krakowskie. Then came phones that don't open.
    - else:
        LADA: Dad's shop, dad's debts, dad's customers. Only the stock is new.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: Don't plug in anything you don't understand. I'll sell it to you anyway.
    - seller_voice == 2:
        LADA: Come back when something starts smoking.
    - else:
        LADA: Stay away from water. You and your gear.
    }
    -> END

// Florists: PLASTIFLORA, BONSAI.
=== seller_florist ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_florist_1") ->
LADA: Florist. The plastic ones don't wilt, the real ones cost a fortune.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_florist_2") ->
LADA: Bonsai, moss, ferns. Green as the Saxon Garden after rain, only cheaper and no ducks.
-> talk

= talk
+ { not seller_goods } [Anything alive in here? #tone:optional]
    ~ seller_goods = true
    SEKI: Anything alive in here?
    {
    - seller_voice == 1:
        LADA: Printed roses, orchids on mains power, bonsai with a sensor that tells you when to water.
    - else:
        LADA: Potted trees with humidity sensors. Moss for the walls, so your flat breathes for you.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: Somebody planted real tomatoes in the roof garden. Security guards them better than the tills.
    - else:
        LADA: Every tree on Plac Litewski has three cameras on it. Supposedly because of people cutting them down for firewood in winter.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: I've loved flowers since I was a kid, and been allergic just as long. Plastic's the compromise.
    - else:
        LADA: I used to work the park in Czechow. They closed the park, my hands stayed in the dirt.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: Take one at least. Even a fake flower changes a room.
    - else:
        LADA: Water in moderation. Same goes for coffee.
    }
    -> END

// Repair shops: FIXPOINT, REBOOT, CHIPFIX, DATAFIX.
=== seller_repair ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_repair_1") ->
LADA: Repairs. If it breaks, I fix it. If it doesn't, wait, it will.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_repair_2") ->
LADA: Repairs for now, for tomorrow, or for never. Prices from right to left.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_repair_3") ->
LADA: Want something fixed, or just to complain? I charge for both.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_repair_4") ->
LADA: Leave the gear, take a number, come back in a week. Or wait, it's quiet today.
-> talk

= talk
+ { not seller_goods } [What do you fix? #tone:optional]
    ~ seller_goods = true
    SEKI: What do you fix?
    {
    - seller_voice == 1:
        LADA: Phones, decks, prostheses, microwaves. Once they brought in a drone with a Hebi stuck inside. The Hebi was fixable too.
    - seller_voice == 2:
        LADA: I swap implant batteries, clean ports, straighten screens after a drop off the viaduct.
    - seller_voice == 3:
        LADA: Power supplies, cables, prosthesis hinges. Parts for anything made before seventy.
    - else:
        LADA: I recover data off cards someone tried to snap, burn or drown in the Bystrzyca.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: The gallery lifts stop between floors when somebody downstairs plays music too loud. Don't ask why. It's been tested.
    - seller_voice == 2:
        LADA: Someone from Tessen brings in gear stickered company property. Pays double so nobody reads the stickers.
    - seller_voice == 3:
        LADA: On the Nabrzeże the Tessen crane runs even at night. They say it loads something nobody ordered.
    - else:
        LADA: The ALCHEMIA neon over the door drinks as much power as half of Czechow. If it goes dark, the city's in trouble.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: Hands for the work, a head for counting debts. Both come in handy.
    - seller_voice == 2:
        LADA: Twenty years at the plant in Zemborzyce. They automated the plant. Couldn't automate me.
    - seller_voice == 3:
        LADA: Once it was soldering boards in a factory. Now it's whatever people bring in a carrier bag.
    - else:
        LADA: A spanner in hand since fourteen. School ended, the spanner stayed.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: Bring it in before it dies completely. Works out cheaper.
    - seller_voice == 2:
        LADA: If something's knocking, don't knock it harder.
    - seller_voice == 3:
        LADA: Drop in. Something always breaks.
    - else:
        LADA: Look after yourself. You I can't fix.
    }
    -> END

// Implant shops: NEUROTEK, CHROMEDOC, SYNAPSE.
=== seller_implants ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_implants_1") ->
LADA: Certified implants. The certificate's an implant too, but that's another conversation.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_implants_2") ->
LADA: Welcome to the future. Sixty months of payments, twelve months' warranty.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_implants_3") ->
LADA: Chrome with a warranty, chrome without. The difference is the price and the sleep.
-> talk

= talk
+ { not seller_goods } [What chrome have you got in stock? #tone:optional]
    ~ seller_goods = true
    SEKI: What chrome have you got in stock?
    {
    - seller_voice == 1:
        LADA: Eyes with zoom, fingers with sensors, ports under the skull. Mori on the deptak does the fitting, this is just the shop.
    - seller_voice == 2:
        LADA: Reflex boosters from Tessen surplus, memory chips, knees for running up escalators.
    - else:
        LADA: A cybereye with night vision, a blood filter for sake, synthetic skin in forty shades.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: More and more people come in with implants they don't remember buying. They say it's stress.
    - seller_voice == 2:
        LADA: Kagami clinics are opening branches in every district. Free, if you sign the consent form. Nobody reads the form.
    - else:
        LADA: The barman in Neon Koi collects rumours better than I collect implants. Ask him about the Old Town ripperdocs.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: I sell chrome and haven't got a gram of it in me. Somebody here has to stay human.
    - seller_voice == 2:
        LADA: Used to work the machines at the hospital on Jaczewskiego. The hospital went to a corporation, the machine people went behind counters.
    - else:
        LADA: I've got one implant, in the ear. I can hear a till from the other end of the gallery.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: Don't buy eyes on credit. Then all they look at is the bills.
    - seller_voice == 2:
        LADA: Come back in one piece. Ideally the one you came in with.
    - else:
        LADA: If anything starts itching under the skin, come back right away, not in a week.
    }
    -> END

// Exchanges: BITKANTOR, KOINEX, KANTOR, BITBANK.
=== seller_crypto ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_crypto_1") ->
LADA: Exchange. Credits, gold, corporate tokens. Zloty only as souvenirs.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_crypto_2") ->
LADA: Anonymous exchange, open commission. The only open thing in this place.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_crypto_3") ->
LADA: The day's rate is on the screen. Your rate is in my head.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_crypto_4") ->
LADA: Credits for cash, cash for credits. Honest, for a mall.
-> talk

= talk
+ { not seller_goods } [What's the rate on credits today? #tone:optional]
    ~ seller_goods = true
    SEKI: What's the rate on credits today?
    {
    - seller_voice == 1:
        LADA: Tessen credits are climbing since the Nabrzeże went back to three shifts. Kagami tokens, better hold than sell.
    - seller_voice == 2:
        LADA: Wallets on a chip, cloud safes that aren't in any cloud, just in a cellar.
    - seller_voice == 3:
        LADA: Credits, gallery loyalty points, food hall lunch vouchers. I change anything for anything.
    - else:
        LADA: Gold in one-gram bars. A Lublin classic: everyone has a little, nobody brags.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: The Hebi change the same sum here every week. They think nobody's counting. Counting is my job.
    - seller_voice == 2:
        LADA: Somebody's buying up the debts of people on Krakowskie. Not collecting, just holding. Waiting for something.
    - seller_voice == 3:
        LADA: The cash machine by the Świętoduska entrance sometimes pays out twice. The queue starts at five in the morning.
    - else:
        LADA: The fixer at Neon Koi pays his people in credits, not cash. It leaves a trail, but only on his side.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: Maths at UMCS, then a bank, then this exchange. Each step a floor lower.
    - seller_voice == 2:
        LADA: Nights only. By day the rates move too fast for people.
    - seller_voice == 3:
        LADA: It started with selling phone cards at the station. Same scale, pricier cards.
    - else:
        LADA: Family from Wieniawa, school in Warsaw, an exchange in Alchemia. That's fate.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: The rate will change before you reach the stairs. It always does.
    - seller_voice == 2:
        LADA: Don't keep everything on one chip. Chips go missing. So do people.
    - seller_voice == 3:
        LADA: Count your change at the counter. Past the door nobody gives it back.
    - else:
        LADA: Come back when you're richer. Or poorer, I'll serve you then too.
    }
    -> END

// Clothes shops: KAWAII WEAR, NEONSKIN, NIGHT SILK, SHIBUYA.
=== seller_clothing ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_clothing_1") ->
LADA: Clothes. Jackets with a mesh that stops rain and stares.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_clothing_2") ->
LADA: Tokyo fashion, sewn in Bronowice. Nobody will notice.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_clothing_3") ->
LADA: Everything in your size, and if not, I'll take it in.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_clothing_4") ->
LADA: Shibuya in Lublin. Sounds stupid, sells great.
-> talk

= talk
+ { not seller_goods } [What's the street wearing these days? #tone:optional]
    ~ seller_goods = true
    SEKI: What's the street wearing these days?
    {
    - seller_voice == 1:
        LADA: Coats that shrug off acid rain, boots for the wet slabs of the deptak, hoods the cameras can't see under.
    - seller_voice == 2:
        LADA: Jackets with LEDs, kevlar skirts, T-shirts with slogans I don't understand and don't want to.
    - seller_voice == 3:
        LADA: Outfits for a night at the club and a night on the roofs. Same jacket, different gun pocket.
    - else:
        LADA: Hoodies where implant cooling doesn't steam. For extra it steams pink.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: They're collecting signatures against the new cameras on the deptak again. The one collecting has a camera on his forehead.
    - seller_voice == 2:
        LADA: Kids from Czechow wear the Hebi name on their sleeves so nobody bothers them. The Hebi aren't amused.
    - seller_voice == 3:
        LADA: Gallery security got new uniforms. They look like Tessen without the patches. Maybe that's no accident.
    - else:
        LADA: The idol from the Lublin Festival bought a jacket here. Since then half of Plac Litewski wears the same one.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: Half the stock I sew at night in the back room. The other half comes from Lodz and falls apart in the wash.
    - seller_voice == 2:
        LADA: Designs for corporations once. Now I sell what corporations don't want.
    - seller_voice == 3:
        LADA: Grandma sewed dresses on Lubartowska. I sew jackets that survive Lubartowska.
    - else:
        LADA: The shop's been mine for a year. Before that it was someone who didn't pay the Hebi for too long.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: Dress dark. In this city bright colours draw the wrong eyes.
    - seller_voice == 2:
        LADA: Try something on next time. The mirror's honest, only the lighting lies.
    - seller_voice == 3:
        LADA: Don't wear new things to a job. Jobs like to get dirty.
    - else:
        LADA: If I see you on the deptak in my clothes, you get a discount.
    }
    -> END

// VR rooms and arcades: DREAMDECK, HOLODROM, ARCADIA.
=== seller_vr ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_vr_1") ->
LADA: VR parlour. An hour in another life, paid up front.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_vr_2") ->
LADA: The headsets are clean, the chairs nearly. Pick who you want to be.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_vr_3") ->
LADA: Welcome to the arcade. Cabinets with real buttons, headsets for the lazy.
-> talk

= talk
+ { not seller_goods } [What's playing in the headsets today? #tone:optional]
    ~ seller_goods = true
    SEKI: What's playing in the headsets today?
    {
    - seller_voice == 1:
        LADA: The sea, mountains, Lublin without rain. The last one sells best.
    - seller_voice == 2:
        LADA: Races down Krakowskie, dates, wars. There's even one where you just sleep.
    - else:
        LADA: Old cabinets from Japan and new headsets from China. Grandads play one, grandkids the other.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: Kids from Kalinowszczyzna sit here sixteen hours at a stretch. Their parents think they're at school, the school thinks they're at home.
    - seller_voice == 2:
        LADA: Somebody put a program on the servers where you walk old Lublin, before the corporations. They delete it every week and it comes back.
    - else:
        LADA: Last week someone fainted in a headset at station three. Said afterwards he'd seen memories he never had.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: I hardly ever put the headset on. Watching the customers walk out is enough.
    - seller_voice == 2:
        LADA: Writing games once. Now making sure nobody throws up on the chairs.
    - else:
        LADA: The high score on the cabinet by the door is mine. Unbeaten for eleven years, because nobody plays it.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: Come back when you stop liking it out there. Everybody does.
    - seller_voice == 2:
        LADA: Careful on the way out. Real stairs don't have railings made of data.
    - else:
        LADA: Drop in for a game. First token's on the house.
    }
    -> END

// Gun shops: HAGANE ARMS, TETSU, OKAMI ARMS (Oyaji's on P3 is a keeper of the story).
=== seller_arms ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_arms_1") ->
LADA: Arms with a gallery licence. Security issues the licences, and security shops here.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_arms_2") ->
LADA: Blades, barrels, armour. Gift-wrapped on request.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_arms_3") ->
LADA: Personal protection. No questions about from whom.
-> talk

= talk
+ { not seller_goods } [What have you got for self-defence? #tone:optional]
    ~ seller_goods = true
    SEKI: What have you got for self-defence?
    {
    - seller_voice == 1:
        LADA: Pistols, stunners, vests. Ammo only with a vest, that's the policy.
    - seller_voice == 2:
        LADA: Knives forged in Krasnik, because somebody there still knows how. Surplus armour, patched, but certified.
    - else:
        LADA: Compact pistols that pass the metro gates, and ones that don't need to.
    }
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    {
    - seller_voice == 1:
        LADA: The Hebi don't buy here. They buy from Oyaji upstairs and think nobody knows.
    - seller_voice == 2:
        LADA: The Tessen guards on the Nabrzeże got new rifles. Nobody handed the old ones in. Makes you wonder where they are.
    - else:
        LADA: Kaito from Neon Koi buys only one thing here: silence. Suppressors, to be clear.
    }
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    {
    - seller_voice == 1:
        LADA: Ten years in the army, five in Tessen security, one here. The quietest year.
    - seller_voice == 2:
        LADA: Gunsmithing runs in the family. Grandpa fixed hunters' shotguns. I fix what people hunt people with.
    - else:
        LADA: I haven't fired in years. I sell to the ones who still have to.
    }
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    {
    - seller_voice == 1:
        LADA: Only shoot if you have to. Ammo's getting dearer.
    - seller_voice == 2:
        LADA: Keep your finger off the trigger. And out of trouble.
    - else:
        LADA: Come back alive and I'll serve you again.
    }
    -> END

// The food hall's KAWA on P3.
=== seller_coffee ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_coffee_1") ->
LADA: Coffee. The real kind, from smuggled beans, and the other kind, printed, for those who don't ask.
-> talk

= talk
+ { not seller_goods } [What's cooking today? #tone:optional]
    ~ seller_goods = true
    SEKI: What's cooking today?
    LADA: Espresso, flat white, oat milk coffee. And a cebularz, because this is still Lublin.
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    LADA: From the food hall windows you can see the deptak all the way to the Brama Krakowska. At night I count how many neons die before dawn.
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    LADA: Barista's a job for life, or till the first burnt hand. Both hands still here, for now.
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    LADA: Next coffee's stronger. You look like you need it.
    -> END

// The food hall's THAI on P3.
=== seller_thai ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_thai_1") ->
LADA: Thai food on the third floor of a Lublin mall. The chilli's real, the rest is local.
-> talk

= talk
+ { not seller_goods } [What's cooking today? #tone:optional]
    ~ seller_goods = true
    SEKI: What's cooking today?
    LADA: Pad thai with rice noodles from Hrubieszow, a curry so hot you'll forget the rain.
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    LADA: Cooks all over the food hall pay someone for protection. Not the Hebi. Someone in a suit who never eats a thing.
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    LADA: Mother from Bangkok, father from Kalinowszczyzna. The cooking's hers, the humour's his.
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    LADA: If it's too hot, don't drink water. Drink coconut milk. Or cry.
    -> END

// The food hall's GYROS on P3.
=== seller_greek ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_greek_1") ->
LADA: Gyros, while the meat is still almost meat.
-> talk

= talk
+ { not seller_goods } [What's cooking today? #tone:optional]
    ~ seller_goods = true
    SEKI: What's cooking today?
    LADA: Gyros of synthetic lamb, tzatziki with real garlic, chips fried in oil that remembers better days.
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    LADA: Evenings, they dance by the lanterns in the roof courtyard. Security looks the other way, since security bought the lanterns.
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    LADA: Grandpa came from Thessaloniki and set up a stand by the station. The stand's still there, grandpa isn't, the spit's the same.
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    LADA: Come back hungry. That's the only way to come here.
    -> END

// The food hall's WOK on P3.
=== seller_wok ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_wok_1") ->
LADA: Wok. Big flame, bigger portions, short wait.
-> talk

= talk
+ { not seller_goods } [What's cooking today? #tone:optional]
    ~ seller_goods = true
    SEKI: What's cooking today?
    LADA: Fried noodles, egg rice from the vertical farm in Zemborzyce, hydroponic veg. All out of one wok.
    -> talk
+ { not seller_gossip } [What's the word around here? #tone:optional]
    ~ seller_gossip = true
    SEKI: What's the word around here?
    LADA: When the power goes out down in the gallery, the gas up here still works. Then the whole food hall turns up here and suddenly everyone's friends.
    -> talk
+ { not seller_self } [And you? Been behind this counter long? #tone:optional]
    ~ seller_self = true
    SEKI: And you? Been behind this counter long?
    LADA: The wok's my father's, the knife my mother's, the debts my own.
    -> talk
+ [I'll drop by again. #tone:leave]
    SEKI: I'll drop by again.
    LADA: Mind the stairs. After one of my portions people walk slower.
    -> END
