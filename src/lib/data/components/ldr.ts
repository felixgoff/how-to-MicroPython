import { nextToPico } from "$lib/wiring/geometry.js";
import type { ComponentGuide } from "./types.js";

const power = nextToPico(36); // 3V3(OUT)
const ground = nextToPico(38); // GND
const adc = nextToPico(31); // GP26 / ADC0

export const ldr: ComponentGuide = {
	slug: "ldr",
	title: "LDR (Fotoresistor)",
	tagline: "Mät hur ljust det är med en fotoresistor och Picons analoga ingång.",
	tags: ["Analog ingång", "ADC", "Spänningsdelare"],
	facts: [
		{ label: "Läses med", value: "ADC" },
		{ label: "Stift i exemplet", value: "GP26 / ADC0 (stift 31)" },
		{ label: "Mätvärde", value: "0–65535" },
		{ label: "Behöver också", value: "10 kΩ motstånd" },
	],
	needs: [
		{ item: "Raspberry Pi Pico WH", note: "med micro-USB-sladd" },
		{ item: "Kopplingsdäck" },
		{ item: "Fotoresistor (LDR)" },
		{ item: "Motstånd 10 kΩ", note: "färgkod brun–svart–orange" },
		{ item: "5 kopplingssladdar", note: "hane–hane" },
	],
	how: [
		"En fotoresistor (LDR, light-dependent resistor) är ett motstånd som ändrar sig med ljuset: i mörker är resistansen hög, runt en megaohm, och i starkt ljus bara någon kiloohm.",
		"Picon kan inte mäta resistans direkt – bara spänning. Därför kopplas LDR:en i serie med ett fast motstånd på 10 kΩ mellan 3,3 V och jord. Det kallas en spänningsdelare: spänningen i punkten mellan dem beror på hur resistansen fördelas. Mer ljus ger lägre resistans i LDR:en och därmed högre spänning i mittpunkten.",
		"Mittpunkten kopplas till en ADC-ingång (analog-till-digital-omvandlare). Picon har tre sådana på kanten: GP26, GP27 och GP28. read_u16() ger ett tal från 0 (0 V) till 65535 (3,3 V).",
	],
	diagram: {
		description:
			"Pico WH på ett kopplingsdäck. 3V3, stift 36, går till plusskenan och GND, stift 38, till minusskenan. Fotoresistorn sitter mellan plusskenan och en mittpunkt, och ett 10 kilo-ohms motstånd går från mittpunkten till minusskenan. En grön sladd går från mittpunkten till GP26, stift 31.",
		railLabels: { "top+": "3,3 V", "top-": "GND" },
		parts: [
			{ id: "ldr", kind: "ldr", a: { col: 26, row: "c" }, b: { col: 29, row: "c" } },
			{
				id: "resistor",
				kind: "resistor",
				from: { col: 29, row: "d" },
				to: { col: 33, row: "d" },
				ohms: "10 kΩ",
				bands: ["brown", "black", "orange", "gold"],
			},
		],
		modules: [],
		wires: [
			{ id: "power", from: power, to: { col: 6, row: "top+" }, color: "red" },
			{ id: "ground", from: ground, to: { col: 4, row: "top-" }, color: "black" },
			{ id: "ldr-power", from: { col: 26, row: "a" }, to: { col: 26, row: "top+" }, color: "red" },
			{ id: "resistor-ground", from: { col: 33, row: "a" }, to: { col: 33, row: "top-" }, color: "black" },
			{ id: "signal", from: { col: 29, row: "a" }, to: adc, color: "green" },
		],
		steps: [
			{
				title: "Pico WH på kopplingsdäcket",
				text: "Bara tre stift på Picon kan läsa analoga värden: GP26, GP27 och GP28. Här används GP26, som också heter ADC0 och sitter på stift 31 i den övre raden.",
				show: [],
				strips: [adc],
				focus: [{ col: 11, row: "c" }],
				callout: { at: { col: 11, row: "c" }, text: "GP26 · ADC0 · stift 31" },
			},
			{
				title: "Ström till skenorna",
				text: "En röd sladd från 3V3(OUT), stift 36, till plusskenan och en svart från GND, stift 38, till minusskenan. Använd 3,3 V – inte VBUS på 5 V – för ADC-ingången tål högst 3,3 V.",
				show: ["power", "ground"],
				strips: [
					{ col: 0, row: "top+" },
					{ col: 0, row: "top-" },
				],
				callout: { at: power, text: "3V3(OUT) · stift 36" },
			},
			{
				title: "Sätt i fotoresistorn",
				text: "Fotoresistorn har inget plus eller minus. Sätt ena benet i kolumn 27 och det andra i kolumn 30, och koppla kolumn 27 till plusskenan.",
				show: ["ldr", "ldr-power"],
				strips: [
					{ col: 26, row: "c" },
					{ col: 29, row: "c" },
				],
				focus: [
					{ col: 26, row: "c" },
					{ col: 29, row: "c" },
				],
			},
			{
				title: "Motstånd till jord",
				text: "10 kΩ-motståndet går från kolumn 30 till kolumn 34, som kopplas till minusskenan. Nu sitter LDR:en och motståndet i serie mellan 3,3 V och jord – en spänningsdelare.",
				show: ["resistor", "resistor-ground"],
				strips: [
					{ col: 29, row: "d" },
					{ col: 33, row: "d" },
				],
			},
			{
				title: "Mittpunkten till GP26",
				text: "En grön sladd från mittpunkten, kolumn 30, till GP26. Spänningen här ändras med ljuset och är det Picon mäter.",
				show: ["signal"],
				strips: [{ col: 29, row: "a" }, adc],
				callout: { at: adc, text: "GP26 (ADC0)" },
			},
			{
				title: "Klart att testa",
				text: "Kör koden och håll handen över fotoresistorn – värdet ska sjunka. Lys på den med en ficklampa så stiger det.",
				show: [],
			},
		],
	},
	connections: [
		{ from: "LDR, ena benet", to: "3,3 V (stift 36)" },
		{ from: "LDR, andra benet", to: "GP26 / ADC0 (stift 31)" },
		{ from: "10 kΩ, från samma punkt", to: "GND (stift 38)" },
	],
	code: {
		filename: "ljus.py",
		source: `from machine import ADC
import time

ldr = ADC(26)                    # GP26 = ADC0

while True:
    varde = ldr.read_u16()       # 0 (0 V) till 65535 (3,3 V)
    procent = varde * 100 // 65535
    print("Ljus:", procent, "%")
    if procent < 30:
        print("  Mörkt – dags att tända lampan!")
    time.sleep(0.5)
`,
		notes: [
			{ lines: "4", text: "ADC(26) läser den analoga ingången på GP26. Du kan också skriva ADC(0) – det är samma kanal." },
			{ lines: "7", text: "read_u16() ger alltid ett tal från 0 till 65535, oavsett hur många bitar omvandlaren egentligen har." },
			{ lines: "8", text: "Omräkning till procent. // är heltalsdivision, så resultatet blir ett heltal." },
			{ lines: "10–11", text: "Ett gränsvärde gör mätningen till ett beslut – så fungerar en skymningsbrytare." },
		],
	},
	pitfalls: [
		{
			title: "Värdet ändras inte",
			text: "Kontrollera att signalen går till GP26, GP27 eller GP28. Andra stift kan inte läsa analoga värden, och ADC() ger fel eller bara brus.",
		},
		{
			title: "Värdet ligger nära max hela tiden",
			text: "Troligen saknas 10 kΩ-motståndet till jord, eller så sitter det i fel kolumn. Utan det finns ingen spänningsdelare och ingången dras upp mot 3,3 V.",
		},
		{
			title: "Mörkt ger högt värde",
			text: "Då har LDR:en och motståndet bytt plats. Det fungerar också, men värdet blir omvänt. Byt plats på dem eller vänd på logiken i koden.",
		},
		{
			title: "Värdet når aldrig 0 eller 65535",
			text: "Det är normalt. En fotoresistor har aldrig oändlig eller noll resistans. Mät hur det ser ut i ditt klassrum och välj gränsvärdet därefter.",
		},
		{
			title: "5 V på ADC-ingången",
			text: "ADC-ingångarna tål högst 3,3 V. Koppla spänningsdelaren till 3V3(OUT), aldrig till VBUS eller VSYS.",
		},
	],
	sim: {
		devices: [{ kind: "ldr", pin: 26 }],
		controls: ["light"],
	},
};
