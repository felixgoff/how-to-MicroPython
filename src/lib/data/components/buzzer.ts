import { nextToPico } from "$lib/wiring/geometry.js";
import type { ComponentGuide } from "./types.js";

const signal = nextToPico(21); // GP16
const ground = nextToPico(23); // GND

export const buzzer: ComponentGuide = {
	slug: "buzzer",
	title: "Buzzer",
	tagline: "Spela toner, pip och hela melodier genom att välja frekvens med PWM.",
	tags: ["PWM", "Frekvens"],
	facts: [
		{ label: "Styrs med", value: "PWM" },
		{ label: "Stift i exemplet", value: "GP16 (stift 21)" },
		{ label: "Typ", value: "Passiv piezobuzzer" },
		{ label: "Hörbart område", value: "ca 100–5000 Hz" },
	],
	needs: [
		{ item: "Raspberry Pi Pico WH", note: "med micro-USB-sladd" },
		{ item: "Kopplingsdäck" },
		{ item: "Passiv buzzer", note: "grönt kretskort på undersidan" },
		{ item: "3 kopplingssladdar", note: "hane–hane" },
	],
	how: [
		"En piezobuzzer innehåller en tunn skiva som böjer sig när det kommer spänning. Slår man av och på spänningen snabbt vibrerar skivan – och vibrationer i luften är ljud. Hur många gånger per sekund det sker, frekvensen, bestämmer tonhöjden: 440 Hz är ett A.",
		"Det finns två sorter. En aktiv buzzer har en egen tongenerator och piper med en fast ton så fort den får ström. En passiv buzzer måste få en svängande signal utifrån, men kan därför spela vilken ton som helst. Den här guiden använder en passiv buzzer.",
		"PWM sköter svängningen åt oss: freq() väljer tonen och duty_u16() hur länge stiftet är på i varje period. 50 % (32768) ger starkast ton, 0 gör buzzern tyst.",
	],
	diagram: {
		description:
			"Pico WH på ett kopplingsdäck. En orange sladd går från GP16, stift 21, till buzzerns plusben. Buzzerns minusben och Picons GND, stift 23, är kopplade med svarta sladdar till minusskenan.",
		railLabels: { "top-": "GND" },
		parts: [{ id: "buzzer", kind: "buzzer", plus: { col: 27, row: "c" }, minus: { col: 29, row: "c" } }],
		modules: [],
		wires: [
			{ id: "signal", from: signal, to: { col: 27, row: "a" }, color: "orange" },
			{ id: "ground-pico", from: ground, to: { col: 19, row: "top-" }, color: "black" },
			{ id: "ground-buzzer", from: { col: 29, row: "a" }, to: { col: 29, row: "top-" }, color: "black" },
		],
		steps: [
			{
				title: "Pico WH på kopplingsdäcket",
				text: "Picon sitter över mittspåret. Den här gången används den övre stiftraden: stift 21 längst till höger är GP16. Kolumnen ovanför stiftet hänger ihop med det.",
				show: [],
				strips: [signal],
				focus: [{ col: 21, row: "c" }],
				callout: { at: { col: 21, row: "c" }, text: "GP16 · stift 21" },
			},
			{
				title: "Sätt i buzzern",
				text: "Buzzern har ett + på ovansidan och oftast ett längre plusben. Sätt plusbenet i kolumn 28 och minusbenet i kolumn 30.",
				show: ["buzzer"],
				strips: [
					{ col: 27, row: "c" },
					{ col: 29, row: "c" },
				],
				focus: [
					{ col: 27, row: "c" },
					{ col: 29, row: "c" },
				],
			},
			{
				title: "Signal från GP16",
				text: "En orange sladd från hålet ovanför GP16 till buzzerns plusben. Det är genom den här sladden PWM-signalen – tonen – kommer.",
				show: ["signal"],
				strips: [signal, { col: 27, row: "a" }],
				callout: { at: signal, text: "GP16" },
			},
			{
				title: "Jord till båda",
				text: "Koppla Picons GND (stift 23) till minusskenan, och buzzerns minusben till samma skena. Nu har strömmen en väg tillbaka.",
				show: ["ground-pico", "ground-buzzer"],
				strips: [{ col: 0, row: "top-" }],
				callout: { at: ground, text: "GND · stift 23" },
			},
			{
				title: "Klart att testa",
				text: "Tips: vänd på buzzern. Syns ett grönt kretskort på undersidan är den passiv och kan spela melodier. Är undersidan helt svart är den troligen aktiv och piper bara med en ton.",
				show: [],
			},
		],
	},
	connections: [
		{ from: "Buzzerns + (långa benet)", to: "GP16 (stift 21)" },
		{ from: "Buzzerns −", to: "GND (stift 23)" },
	],
	code: {
		filename: "buzzer.py",
		source: `from machine import Pin, PWM
import time

buzzer = PWM(Pin(16))

# Tonernas frekvens i hertz (svenska tonnamn: H är engelskans B)
toner = {"C": 262, "D": 294, "E": 330, "F": 349, "G": 392, "A": 440, "H": 494}

# Början på "Broder Jakob"
melodi = ["C", "D", "E", "C", "C", "D", "E", "C", "E", "F", "G", "E", "F", "G"]

def spela(ton, langd):
    buzzer.freq(toner[ton])
    buzzer.duty_u16(32768)      # 50 % pulskvot ger starkast ton
    time.sleep(langd)
    buzzer.duty_u16(0)          # tyst en kort stund mellan tonerna
    time.sleep(0.05)

for ton in melodi:
    spela(ton, 0.3)

buzzer.deinit()                 # stäng av PWM helt
print("Klart!")
`,
		notes: [
			{ lines: "4", text: "PWM(Pin(16)) gör GP16 till en PWM-utgång – rätt verktyg för att skapa en ton." },
			{ lines: "7", text: "En ordlista (dict) kopplar tonnamn till frekvenser, så att melodin kan skrivas med bokstäver." },
			{ lines: "12–17", text: "En egen funktion spelar en ton: välj frekvens, slå på ljudet, vänta, och tysta en kort stund så att tonerna inte flyter ihop." },
			{ lines: "22", text: "deinit() stänger av PWM. Annars fortsätter buzzern låta även när programmet är slut!" },
		],
	},
	pitfalls: [
		{
			title: "Den piper men spelar inte melodin",
			text: "Du har troligen en aktiv buzzer. Den har en egen tongenerator och låter likadant oavsett frekvens. Byt till en passiv – eller använd den till larmsignaler med Pin.on()/off().",
		},
		{
			title: "Det låter även när programmet har stoppats",
			text: "PWM fortsätter i bakgrunden tills någon stänger av det. Avsluta med buzzer.duty_u16(0) eller buzzer.deinit().",
		},
		{
			title: "Inget ljud alls",
			text: "Kontrollera att duty_u16() inte är 0 och att frekvensen är inom det hörbara, ungefär 100–5000 Hz. Kontrollera också att + sitter mot GP16.",
		},
		{
			title: "Svagt eller skrapigt ljud",
			text: "En pulskvot nära 50 % (32768) ger starkast ton. Väldigt låga frekvenser under ca 100 Hz låter mest som knaster i en liten piezobuzzer.",
		},
	],
	sim: {
		parts: [{ id: "buzzer", kind: "buzzer", pin: 16 }],
	},
};
