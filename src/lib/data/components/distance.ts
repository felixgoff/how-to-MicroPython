import { nextToPico } from "$lib/wiring/geometry.js";
import type { ComponentGuide } from "./types.js";

const vbus = nextToPico(40); // VBUS, 5 V
const ground = nextToPico(38); // GND
const trig = nextToPico(22); // GP17
const echo = nextToPico(21); // GP16

export const distance: ComponentGuide = {
	slug: "avstand",
	title: "HC-SR04 Avståndssensor",
	tagline: "Mät avstånd med ultraljud – precis som en fladdermus eller en backsensor på en bil.",
	tags: ["Digital", "Pulstid", "5 V"],
	facts: [
		{ label: "Stift i exemplet", value: "TRIG GP17, ECHO GP16" },
		{ label: "Matning", value: "5 V från VBUS" },
		{ label: "Mätområde", value: "2–400 cm" },
		{ label: "Behöver också", value: "1 kΩ och 2 kΩ motstånd" },
	],
	needs: [
		{ item: "Raspberry Pi Pico WH", note: "med micro-USB-sladd" },
		{ item: "Kopplingsdäck" },
		{ item: "HC-SR04", note: "den vanliga 5 V-versionen" },
		{ item: "Motstånd 1 kΩ", note: "brun–svart–röd" },
		{ item: "Motstånd 2 kΩ", note: "röd–svart–röd (eller två 1 kΩ i serie)" },
		{ item: "8 kopplingssladdar", note: "4 st hona–hane till modulen" },
	],
	how: [
		"Sensorn har två ”ögon”: en högtalare (T) som skickar ut en kort ljudpuls på 40 kHz – för högt för människor att höra – och en mikrofon (R) som lyssnar efter ekot.",
		"Picon startar en mätning genom att sätta TRIG hög i 10 mikrosekunder. Sensorn skickar då ljudpulsen och sätter ECHO hög tills ekot kommer tillbaka. Ju längre bort föremålet är, desto längre är ECHO hög. time_pulse_us() mäter just den tiden.",
		"Ljudet går 343 m/s, alltså 0,0343 cm per mikrosekund. Eftersom ljudet ska både dit och tillbaka delas sträckan med två: avstånd = tid × 0,0343 / 2.",
		"HC-SR04 behöver 5 V för att fungera, och då skickar ECHO också ut 5 V. Picons stift tål bara 3,3 V. Därför går ECHO genom en spänningsdelare med 1 kΩ och 2 kΩ, som sänker spänningen till 5 × 2/3 ≈ 3,3 V.",
	],
	diagram: {
		description:
			"Pico WH på ett kopplingsdäck med 5 volt från VBUS, stift 40, på plusskenan och GND på minusskenan. En HC-SR04 sitter ovanför kopplingsdäcket. VCC går till plusskenan och GND till minusskenan. TRIG går med en grön sladd till GP17, stift 22. ECHO går till en spänningsdelare av ett 1 kilo-ohms och ett 2 kilo-ohms motstånd, och mittpunkten går med en orange sladd till GP16, stift 21.",
		railLabels: { "top+": "5 V", "top-": "GND" },
		parts: [
			{
				id: "r1",
				kind: "resistor",
				from: { col: 33, row: "c" },
				to: { col: 37, row: "c" },
				ohms: "1 kΩ",
				bands: ["brown", "black", "red", "gold"],
			},
			{
				id: "r2",
				kind: "resistor",
				from: { col: 37, row: "e" },
				to: { col: 41, row: "e" },
				ohms: "2 kΩ",
				bands: ["red", "black", "red", "gold"],
			},
		],
		modules: [{ id: "sensor", kind: "hcsr04", col: 25, pins: ["VCC", "TRIG", "ECHO", "GND"] }],
		wires: [
			{ id: "power", from: vbus, to: { col: 2, row: "top+" }, color: "red" },
			{ id: "ground", from: ground, to: { col: 4, row: "top-" }, color: "black" },
			{ id: "module-power", from: { module: "sensor", pin: "VCC" }, to: { col: 25, row: "top+" }, color: "red" },
			{ id: "module-ground", from: { module: "sensor", pin: "GND" }, to: { col: 28, row: "top-" }, color: "black" },
			{ id: "trig", from: { module: "sensor", pin: "TRIG" }, to: trig, color: "green" },
			{ id: "echo", from: { module: "sensor", pin: "ECHO" }, to: { col: 33, row: "a" }, color: "yellow" },
			{ id: "divider-ground", from: { col: 41, row: "a" }, to: { col: 41, row: "top-" }, color: "black" },
			{ id: "echo-safe", from: { col: 37, row: "a" }, to: echo, color: "orange" },
		],
		steps: [
			{
				title: "Pico WH på kopplingsdäcket",
				text: "Sensorn behöver två GP-stift: GP17 (stift 22) för att starta en mätning och GP16 (stift 21) för att läsa svaret. Båda sitter längst till höger i den övre raden.",
				show: [],
				strips: [trig, echo],
				focus: [
					{ col: 20, row: "c" },
					{ col: 21, row: "c" },
				],
				callout: { at: { col: 20, row: "c" }, text: "GP17 · stift 22" },
			},
			{
				title: "5 V från VBUS",
				text: "HC-SR04 behöver 5 V. VBUS, stift 40, ger 5 V direkt från USB-sladden. Röd sladd därifrån till plusskenan, och svart från GND, stift 38, till minusskenan.",
				show: ["power", "ground"],
				strips: [
					{ col: 0, row: "top+" },
					{ col: 0, row: "top-" },
				],
				callout: { at: vbus, text: "VBUS · 5 V · stift 40" },
			},
			{
				title: "Ta fram sensorn",
				text: "Stiften heter VCC, TRIG, ECHO och GND. T-ögat skickar ljudet och R-ögat tar emot ekot.",
				show: ["sensor"],
				focus: [
					{ module: "sensor", pin: "VCC" },
					{ module: "sensor", pin: "TRIG" },
					{ module: "sensor", pin: "ECHO" },
					{ module: "sensor", pin: "GND" },
				],
			},
			{
				title: "Ström till sensorn",
				text: "VCC till plusskenan (5 V) och GND till minusskenan.",
				show: ["module-power", "module-ground"],
				strips: [
					{ col: 0, row: "top+" },
					{ col: 0, row: "top-" },
				],
			},
			{
				title: "TRIG till GP17",
				text: "En grön sladd från TRIG till GP17. Picons 3,3 V räcker gott för att starta sensorn, så här behövs inget extra.",
				show: ["trig"],
				strips: [trig],
				callout: { at: trig, text: "GP17 (TRIG)" },
			},
			{
				title: "Spänningsdelare på ECHO",
				text: "ECHO skickar ut 5 V – för mycket för Picon. Koppla ECHO till ett 1 kΩ-motstånd, och från motståndets andra ände ett 2 kΩ-motstånd till minusskenan. Spänningen mellan dem blir 5 V × 2/3 ≈ 3,3 V.",
				show: ["echo", "r1", "r2", "divider-ground"],
				strips: [
					{ col: 33, row: "c" },
					{ col: 37, row: "c" },
					{ col: 41, row: "e" },
				],
			},
			{
				title: "Mittpunkten till GP16",
				text: "En orange sladd från punkten mellan motstånden till GP16. Nu får Picon en säker 3,3 V-signal när ekot kommer tillbaka.",
				show: ["echo-safe"],
				strips: [{ col: 37, row: "a" }, echo],
				callout: { at: echo, text: "GP16 (ECHO)" },
			},
			{
				title: "Klart att testa",
				text: "Rikta sensorn mot en vägg eller en bok och flytta den närmare och längre bort. Mjuka och sneda ytor ger sämre eko.",
				show: [],
			},
		],
	},
	connections: [
		{ from: "VCC", to: "VBUS, 5 V (stift 40)" },
		{ from: "TRIG", to: "GP17 (stift 22)" },
		{ from: "ECHO", to: "1 kΩ → GP16 (stift 21), med 2 kΩ till GND" },
		{ from: "GND", to: "GND (stift 38)" },
	],
	code: {
		filename: "avstand.py",
		source: `from machine import Pin, time_pulse_us
import time

trig = Pin(17, Pin.OUT)
echo = Pin(16, Pin.IN)

def mat_avstand():
    trig.low()
    time.sleep_us(2)
    trig.high()
    time.sleep_us(10)            # en 10 µs puls startar mätningen
    trig.low()
    tid = time_pulse_us(echo, 1, 30000)   # hur länge ECHO är hög, i µs
    if tid < 0:
        return None              # inget eko inom 30 ms
    return tid * 0.0343 / 2      # 0,0343 cm/µs, fram och tillbaka

while True:
    cm = mat_avstand()
    if cm is None:
        print("Utom räckhåll")
    else:
        print("Avstånd:", round(cm, 1), "cm")
    time.sleep(0.5)
`,
		notes: [
			{ lines: "4–5", text: "TRIG är en utgång som Picon styr, ECHO en ingång som sensorn styr." },
			{ lines: "8–12", text: "En kort låg nivå, sedan exakt 10 µs hög: det är signalen som får sensorn att skicka en ljudpuls." },
			{ lines: "13", text: "time_pulse_us() väntar på att ECHO blir hög och mäter hur många mikrosekunder den stannar hög. Efter 30 ms ger den upp." },
			{ lines: "14–15", text: "Ett negativt värde betyder att inget eko kom tillbaka – föremålet är för långt bort eller absorberar ljudet." },
			{ lines: "16", text: "Tid gånger ljudets hastighet ger sträckan. Delat med två eftersom ljudet går både dit och tillbaka." },
		],
	},
	pitfalls: [
		{
			title: "ECHO utan spänningsdelare",
			text: "5 V direkt in på ett GP-stift kan skada Picon, även om det verkar fungera en stund. Använd alltid 1 kΩ + 2 kΩ – eller köp HC-SR04P, som klarar 3,3 V.",
		},
		{
			title: "Sensorn matas med 3,3 V",
			text: "Den vanliga HC-SR04 behöver 5 V. På 3,3 V blir mätningarna opålitliga eller uteblir helt. Använd VBUS (stift 40) när Picon sitter i USB.",
		},
		{
			title: "Avståndet blir dubbelt så långt",
			text: "Glömt att dela med två? Ljudet går både fram och tillbaka, så tiden motsvarar dubbla avståndet.",
		},
		{
			title: "Negativa värden eller ”Utom räckhåll”",
			text: "time_pulse_us() ger −1 eller −2 när ingen puls kom inom tidsgränsen. Kontrollera ECHO-kopplingen, och att föremålet är mellan 2 cm och 4 m bort.",
		},
		{
			title: "Hoppiga mätvärden",
			text: "Mjuka ytor som tyg absorberar ljudet, och sneda ytor studsar bort det. Vänta minst 60 ms mellan mätningarna så att gamla ekon hinner dö ut.",
		},
	],
	sim: {
		devices: [{ kind: "hcsr04", trig: 17, echo: 16 }],
		controls: ["distance"],
	},
};
