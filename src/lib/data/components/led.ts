import { nextToPico } from "$lib/wiring/geometry.js";
import type { ComponentGuide } from "./types.js";

const signal = nextToPico(20); // GP15
const ground = nextToPico(18); // GND

export const led: ComponentGuide = {
	slug: "led",
	title: "LED-lampa",
	tagline: "Tänd, släck och dimma en lysdiod – det första programmet de flesta skriver.",
	tags: ["Digital utgång", "PWM"],
	facts: [
		{ label: "Styrs med", value: "Pin, PWM" },
		{ label: "Stift i exemplet", value: "GP15 (stift 20)" },
		{ label: "Spänning", value: "3,3 V från GP-stiftet" },
		{ label: "Behöver också", value: "330 Ω motstånd" },
	],
	needs: [
		{ item: "Raspberry Pi Pico WH", note: "med micro-USB-sladd" },
		{ item: "Kopplingsdäck" },
		{ item: "Lysdiod, 5 mm", note: "valfri färg" },
		{ item: "Motstånd 330 Ω", note: "färgkod orange–orange–brun" },
		{ item: "2 kopplingssladdar", note: "hane–hane" },
	],
	how: [
		"En lysdiod (LED, light-emitting diode) släpper bara igenom ström åt ett håll: in genom det långa benet, anoden (+), och ut genom det korta, katoden (−). Vänder du den fel lyser den inte – men den går inte heller sönder.",
		"En lysdiod har nästan inget eget motstånd. Utan ett motstånd i serie skulle strömmen bli för stor och skada både lysdioden och Picons stift. Med 330 Ω blir strömmen ungefär (3,3 V − 2 V) / 330 Ω ≈ 4 mA, vilket räcker gott för att den ska lysa.",
		"Ett GP-stift kan bara vara på (3,3 V) eller av (0 V). För att dimma lysdioden används PWM, pulsbreddsmodulering: stiftet slås av och på tusentals gånger per sekund. Ögat hinner inte se blinkandet utan uppfattar ett medelvärde – är stiftet på halva tiden lyser lysdioden ungefär halvstarkt.",
	],
	diagram: {
		description:
			"Pico WH på ett kopplingsdäck. En gul sladd går från GP15, stift 20, till lysdiodens långa ben. Lysdiodens korta ben går via ett 330 ohms motstånd till minusskenan, och en svart sladd går från GND, stift 18, till minusskenan.",
		railLabels: { "bot-": "GND" },
		parts: [
			{ id: "led", kind: "led", color: "#ef4444", anode: { col: 26, row: "g" }, cathode: { col: 27, row: "g" } },
			{
				id: "resistor",
				kind: "resistor",
				from: { col: 27, row: "i" },
				to: { col: 27, row: "bot-" },
				ohms: "330 Ω",
				bands: ["orange", "orange", "brown", "gold"],
			},
		],
		modules: [],
		wires: [
			{ id: "signal", from: signal, to: { col: 26, row: "j" }, color: "yellow" },
			{ id: "ground", from: ground, to: { col: 19, row: "bot-" }, color: "black" },
		],
		steps: [
			{
				title: "Pico WH på kopplingsdäcket",
				text: "Tryck ner Picon över mittspåret så att stiftraderna hamnar på var sin sida. Varje kolumn med fem hål hänger ihop under plasten – den upplysta kolumnen är alltså kopplad till stift 20, som heter GP15. Lägg märke till att GP-numret och stiftnumret inte är samma sak.",
				show: [],
				strips: [signal],
				focus: [{ col: 21, row: "h" }],
				callout: { at: { col: 21, row: "h" }, text: "GP15 · stift 20" },
			},
			{
				title: "Sätt i lysdioden",
				text: "Det långa benet (anoden, +) går i kolumn 27 och det korta (katoden, −) i kolumn 28. Benen måste sitta i olika kolumner – sitter båda i samma kolumn kortsluts lysdioden och den lyser aldrig.",
				show: ["led"],
				strips: [
					{ col: 26, row: "g" },
					{ col: 27, row: "g" },
				],
				focus: [
					{ col: 26, row: "g" },
					{ col: 27, row: "g" },
				],
			},
			{
				title: "Motstånd till minusskenan",
				text: "Sätt 330 Ω-motståndet från katodens kolumn ned till den blå minusskenan. Det begränsar strömmen så att varken lysdioden eller Picon tar skada. Motstånd har ingen riktning, så det spelar ingen roll hur det vänds.",
				show: ["resistor"],
				strips: [{ col: 27, row: "i" }, { col: 0, row: "bot-" }],
			},
			{
				title: "Signal från GP15",
				text: "En gul sladd från hålet under stift 20 (GP15) till anodens kolumn. När koden sätter GP15 hög kommer det 3,3 V ut på stiftet, och strömmen går genom lysdioden.",
				show: ["signal"],
				strips: [signal, { col: 26, row: "j" }],
				callout: { at: signal, text: "GP15" },
			},
			{
				title: "Jord från Picon",
				text: "En svart sladd från stift 18 (GND) till minusskenan sluter kretsen: GP15 → lysdiod → motstånd → GND. Utan en väg tillbaka till jord kan ingen ström gå.",
				show: ["ground"],
				strips: [ground, { col: 0, row: "bot-" }],
				callout: { at: ground, text: "GND · stift 18" },
			},
			{
				title: "Klart att testa",
				text: "Kontrollera en gång till: långa benet mot GP15, motståndet mot GND. Anslut sedan USB-sladden, öppna koden nedan i Kodlabbet och tryck på Kör på Picon – eller testa den direkt i simulatorn längst ned på sidan.",
				show: [],
			},
		],
	},
	connections: [
		{ from: "Lysdiodens långa ben (+)", to: "GP15 (stift 20)" },
		{ from: "Lysdiodens korta ben (−)", to: "330 Ω → GND (stift 18)" },
	],
	code: {
		filename: "led.py",
		source: `from machine import Pin, PWM
import time

led = Pin(15, Pin.OUT)

# Del 1: blinka tre gånger
for i in range(3):
    led.on()
    time.sleep(0.3)
    led.off()
    time.sleep(0.3)

# Del 2: tona upp och ner med PWM
pwm = PWM(Pin(15))
pwm.freq(1000)

while True:
    for styrka in range(0, 65536, 2048):
        pwm.duty_u16(styrka)
        time.sleep(0.02)
    for styrka in range(65535, -1, -2048):
        pwm.duty_u16(styrka)
        time.sleep(0.02)
`,
		notes: [
			{ lines: "4", text: "Pin(15, Pin.OUT) gör GP15 till en utgång. Siffran är GP-numret – inte stiftnumret, som är 20." },
			{ lines: "7–11", text: "on() sätter stiftet till 3,3 V och off() till 0 V. sleep() pausar programmet i sekunder." },
			{ lines: "14–15", text: "PWM(Pin(15)) tar över samma stift. freq(1000) betyder att stiftet slås av och på 1000 gånger per sekund – för snabbt för ögat." },
			{ lines: "17–23", text: "duty_u16() väljer hur stor del av tiden stiftet är på: 0 är släckt och 65535 full styrka. Looparna räknar upp och sedan ned igen." },
		],
	},
	pitfalls: [
		{
			title: "Lysdioden lyser inte alls",
			text: "Oftast sitter den åt fel håll. Det långa benet ska mot GP-stiftet och det korta mot GND. Vänd på den – en lysdiod tål att sitta fel en stund.",
		},
		{
			title: "Båda benen i samma kolumn",
			text: "De fem hålen i en kolumn är ihopkopplade. Sitter båda benen i samma kolumn går strömmen förbi lysdioden. Flytta ena benet ett hål i sidled.",
		},
		{
			title: "Inget motstånd",
			text: "Utan motstånd kan lysdioden lysa väldigt starkt en kort stund och sedan gå sönder, och Picons stift kan skadas. Använd alltid ett motstånd på 220–1000 Ω.",
		},
		{
			title: "Fel stiftnummer i koden",
			text: "Pin(15) betyder GP15, som sitter på det fysiska stift 20. Blandar du ihop dem styr koden ett helt annat stift. Titta på pinouten på introduktionssidan.",
		},
		{
			title: "Ljusstyrkan ändras knappt",
			text: "duty_u16() tar värden från 0 till 65535, inte 0 till 100. duty_u16(100) är bara 0,15 % av full styrka – nästan släckt.",
		},
	],
	sim: {
		parts: [{ id: "led", kind: "led", pin: 15, color: "red" }],
	},
};
