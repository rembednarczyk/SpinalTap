// Seki Senshi, ADR-0032: street encounters on Nabrzeże Bystrzycy (district id doki, ADR-0042; see enc-shinsekai.ink for the rules).

// Tomo was laid off by an algorithm this morning. Nobody told the gate, so he keeps working.
=== enc_doki_laidoff ===
By the containers under the Tessen warehouses a docker in a hi-vis vest smokes and stares at his phone as if it insulted him.
TOMO: Twenty-two years on the riverside. This morning an algorithm wrote that my position "is no longer optimal".
TOMO: But the gate still lets me in. Nobody told it. So I come and I work. For free, it turns out.
-> ask

= ask
* [Why not go home? #tone:optional]
    SEKI: Why don't you go home?
    TOMO: And do what there? My wife thinks I'm at work. I am at work. It all adds up.
    -> ask
* [If the gate lets you in, will it let me? #tone:persuade]
    SEKI: If the gate lets you in, will it let me in too?
    TOMO: Ha. My card opens the gate by the crane till the end of the month. Take a copy. Let Tessen pay for that mistake.
    ~ set_flag("enc_doki_laidoff_badge")
    ~ change_rep("tessen", -1)
    -> END
* [File a complaint. A loud one. #tone:main]
    SEKI: File a complaint with them. A loud one.
    TOMO: Complaints are read by the same algorithm. It'll write back that my complaint is no longer optimal either. But thanks.
    ~ set_flag("enc_doki_laidoff_complaint")
    -> END

// A Tessen guard is at war with a cyber gull that steals the crew's sandwiches.
=== enc_doki_gull ===
On the riverside a Tessen guard is aiming his baton at the sky. Above him circles a gull with a metal beak and an LED for an eye.
STRAZNIK: Her again! Third sandwich today. Tuna. She knows which ones are tuna.
STRAZNIK: It's a bird drone from an old deterrence program. They shut the program down, the bird stayed and went freelance.
-> ask

= ask
* [You drop the gull with one shot. #tone:aggressive]
    The gull falls into the water with a splash and a short error message.
    ~ set_flag("enc_doki_gull_shot")
    ~ change_rep("tessen", 2)
    STRAZNIK: Well, look at that. I never saw you here, but if anyone asks, you're all right.
    -> END
* [You toss the gull the rest of his sandwich. #tone:main]
    The gull catches the bite mid-air, circles the crane and lands on your shoulder. It weighs more than it looks.
    ~ set_flag("enc_doki_gull_friend")
    STRAZNIK: You're feeding her?! Now she'll come for two!
    -> END
* [That bird's got a better contract than you? #tone:optional]
    SEKI: So that bird's got a better contract than you?
    STRAZNIK: Better, yeah. Nobody checks on it, it pays no dues and it eats for free. Sometimes I envy it.
    -> ask

// Someone knocks from inside a container. The manifest says "spare parts".
=== enc_doki_container ===
In the alley between the containers you hear knocking. Three short, three long, three short. From one container, with a Tessen seal.
GLOS: Hello? Is someone there? We're out of water. There are six of us.
-> ask

= ask
* [Who locked you in? #tone:optional]
    SEKI: Who locked you in here?
    GLOS: A Tessen middleman. He promised work at a plant. The plant turned out to be a container, and the work was waiting.
    -> ask
* [You break the seal and open the doors. #tone:main]
    The doors creak. Inside, six people in coveralls squint against the light of the lamps by the river.
    ~ set_flag("enc_doki_container_opened")
    ~ change_rep("tessen", -3)
    ~ change_rep("civilians", 3)
    GLOS: Thank you. We don't know where to go, but we know it's away from here.
    -> END
* [I'll tell Genzō. He has boats. #tone:main]
    SEKI: I'll let Genzō know. He has boats.
    GLOS: Whoever that is, tell them to hurry. And to bring water.
    ~ set_flag("enc_doki_container_genzo")
    ~ change_rep("fixers", 1)
    -> END
* [You walk away from the container. #tone:leave]
    You can hear the knocking for two more alleys. Then you stop hearing it, though you don't know if it stopped.
    -> END
